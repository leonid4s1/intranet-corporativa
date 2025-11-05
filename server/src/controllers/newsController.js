// server/src/controllers/newsController.js (ESM)
import News from '../models/News.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import { startOfDay, addDays, isAfter } from 'date-fns';

const MX_TZ = 'America/Mexico_City';

// "Hoy" a las 00:00 en MX
function startOfDayInMX(date = new Date()) {
  const local = new Date(new Date(date).toLocaleString('en-US', { timeZone: MX_TZ }));
  return startOfDay(local);
}

// mm-dd en UTC (para cumpleaños)
function mmddUTC(date) {
  const d = new Date(date);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

function toISO(d) {
  return new Date(d).toISOString();
}

// Parse robusto de Holiday.date -> Date
function toDate(value) {
  if (value instanceof Date) return value;
  // Acepta ISO o "MM/DD/YYYY" (admin)
  return new Date(value);
}

// Ancla una fecha (Y-M-D en UTC) al MEDIODÍA UTC y la lleva a 00:00 MX del mismo día.
function mxMidnightOfUTCDate(d) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const atNoonUTC = new Date(Date.UTC(y, m, day, 12)); // mediodía UTC evita corrimientos
  return startOfDayInMX(atNoonUTC); // -> 00:00 MX del mismo Y-M-D
}

/**
 * Próxima ocurrencia del festivo a las 00:00 MX.
 * - NO recurrente: respeta el año guardado y “pega” a 00:00 MX (anclando a 12:00 UTC).
 * - Recurrente: misma mm-dd en el año actual (o siguiente si ya pasó), robusto a TZ.
 */
function nextOccurrenceMX(holidayDate, isRecurring) {
  const base = toDate(holidayDate);
  const todayMX = startOfDayInMX();

  if (!isRecurring) {
    return mxMidnightOfUTCDate(base);
  }

  // Recurrente: construir en UTC y aterrizar a MX
  const mm = base.getUTCMonth();
  const dd = base.getUTCDate();

  const occThisUTCNoon = new Date(Date.UTC(todayMX.getUTCFullYear(), mm, dd, 12));
  let occMX = startOfDayInMX(occThisUTCNoon);

  if (isAfter(todayMX, occMX)) {
    const occNextUTCNoon = new Date(Date.UTC(todayMX.getUTCFullYear() + 1, mm, dd, 12));
    occMX = startOfDayInMX(occNextUTCNoon);
  }
  return occMX;
}

export const getHomeFeed = async (req, res, next) => {
  try {
    const user = req.user;
    const today = startOfDayInMX();
    const todayMMDD = mmddUTC(today); // cumpleaños: UTC vs UTC

    // 1) Noticias publicadas (proyección mínima)
    const published = await News.find(
      { status: 'published' },
      { title: 1, body: 1, visibleFrom: 1, visibleUntil: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const items = (published || []).map((n) => ({
      id: String(n._id),
      type: 'static',
      title: n.title || 'Aviso',
      body: n.body || '',
      visibleFrom: n.visibleFrom ? toISO(n.visibleFrom) : undefined,
      visibleUntil: n.visibleUntil ? toISO(n.visibleUntil) : undefined,
    }));

    // 2) Avisos de feriado (ventana 7d) + correo único
    const holidays = await Holiday.find(
      {},
      { name: 1, date: 1, recurring: 1, type: 1 }
    ).lean();

    for (const h of holidays) {
      if (!h?.date || !h?.name) continue;

      const isRecurring = h.recurring === true || h.type === 'recurring';
      const occStart = nextOccurrenceMX(h.date, isRecurring); // 00:00 MX del festivo
      const windowStart = addDays(occStart, -7);
      const windowEndExclusive = addDays(occStart, 1);

      // Comparación robusta en milisegundos (evita cualquier rareza de TZ)
      const t  = today.getTime();
      const ws = windowStart.getTime();
      const we = windowEndExclusive.getTime();
      const inWindow = (t >= ws && t < we);

      // Log de diagnóstico
      console.log('[feed][holiday]', {
        name: h.name,
        isRecurring,
        occStart: occStart.toISOString(),
        windowStart: windowStart.toISOString(),
        windowEndExclusive: windowEndExclusive.toISOString(),
        today: today.toISOString(),
        inWindow,
      });

      if (inWindow) {
        items.unshift({
          id: `holiday-${String(h._id)}-${occStart.getFullYear()}`, // id estable por ocurrencia
          type: 'holiday_notice',
          title: `Próximo día festivo: ${h.name}`,
          body: `Se celebra el ${new Date(occStart).toLocaleDateString('es-MX', {
            timeZone: MX_TZ,
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
          })}.`,
          visibleFrom: toISO(windowStart),        // occ - 7 días (MX)
          visibleUntil: toISO(windowEndExclusive) // occ + 1 día (MX)
        });

        // Envío de correo (único al entrar a la ventana 7d).
        try {
          const svc = await import('../services/notificationService.js');
          const fn = svc?.sendUpcomingHolidayEmailIfSevenDaysBefore;
          if (typeof fn === 'function') {
            await fn({
              ...h,
              date: occStart, // pasar la ocurrencia normalizada a MX
            });
          } else {
            console.warn('[holiday_notice] sendUpcomingHolidayEmailIfSevenDaysBefore no está exportada.');
          }
        } catch (errMail) {
          console.error('[holiday_notice 7d] error enviando correo:', errMail?.message || errMail);
        }
      }
    }

    // 3) Cumpleaños (digest + self)
    if (user) {
      const all = await User.find(
        { birthDate: { $ne: null } },
        { name: 1, email: 1, birthDate: 1 }
      ).lean();

      const birthdayTodayUsers = all.filter(
        (u) => u.birthDate && mmddUTC(u.birthDate) === todayMMDD
      );

      console.log('[feed] birthdays today:', birthdayTodayUsers.map(u => u.name || u.email));

      // Enviar digest si hay cumpleañeros (idempotencia en servicio: DailyLock)
      if (birthdayTodayUsers.length > 0) {
        try {
          const svc = await import('../services/notificationService.js');
          const fn = svc?.sendBirthdayEmailsIfNeeded;
          if (typeof fn === 'function') {
            await fn(today, birthdayTodayUsers);
          } else {
            console.warn('[birthdays] sendBirthdayEmailsIfNeeded no está exportada.');
          }
        } catch (errMail) {
          console.error('[birthdays] error enviando correos:', errMail?.message || errMail);
        }
      }

      // ¿El usuario autenticado cumple hoy?
      const me = await User.findById(user.id).lean();
      const isMyBirthday = !!me?.birthDate && mmddUTC(me.birthDate) === todayMMDD;

      if (isMyBirthday) {
        const first = (me?.name || 'colaborador').split(' ')[0];
        items.unshift({
          id: `birthday-self-${String(me._id)}-${todayMMDD}`,
          type: 'birthday_self',
          title: `¡Feliz cumpleaños, ${first}!`,
          body: 'Te deseamos un día increíble. 🎉',
          visibleFrom: toISO(today),
          visibleUntil: toISO(addDays(today, 1)),
        });
      } else if (birthdayTodayUsers.length > 0) {
        const names = birthdayTodayUsers.map((u) => u.name || u.email).join(', ');
        items.unshift({
          id: `birthday-digest-${todayMMDD}`,
          type: 'birthday_digest_info',
          title: 'Cumpleaños de hoy',
          body: `Hoy celebramos a: ${names}. ¡Felicítenl@s! 🎂`,
          visibleFrom: toISO(today),
          visibleUntil: toISO(addDays(today, 1)),
        });
      }
    }

    return res.json({ items });
  } catch (err) {
    next(err);
  }
};
