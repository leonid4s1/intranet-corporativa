// server/src/controllers/newsController.js (ESM)
import News from '../models/News.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import { startOfDay, addDays, isAfter, differenceInCalendarDays } from 'date-fns';

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
  return new Date(value);
}

// Ancla Y-M-D (UTC) al mediodía UTC y lo lleva a 00:00 MX del mismo día
function mxMidnightOfUTCDate(d) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const atNoonUTC = new Date(Date.UTC(y, m, day, 12));
  return startOfDayInMX(atNoonUTC);
}

// Detecta si es recurrente: true | "recurring" | "recurrente" | "recurrencia" | etc.
function isRecurringFlag(h) {
  if (h?.recurring === true) return true;
  const t = String(h?.type || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  return t === 'recurring' || t === 'recurrente' || t === 'recurrent' || t === 'recurrencia';
}

/**
 * Próxima ocurrencia (00:00 MX):
 * - Único: respeta el año guardado
 * - Recurrente: misma mm-dd este año o siguiente si ya pasó (robusto a TZ)
 */
function nextOccurrenceMX(holidayDate, isRecurring) {
  const base = toDate(holidayDate);
  const todayMX = startOfDayInMX();

  if (!isRecurring) {
    return mxMidnightOfUTCDate(base);
  }

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

// ⬇️ CAMBIO PRINCIPAL: Renombrar getHomeFeed a getHomeNews
export const getHomeNews = async (req, res, next) => {
  try {
    const user = req.user;
    const today = startOfDayInMX();

    // 🔒 Anti-cache: forzar 200 y ejecutar handler
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    res.set('ETag', `homefeed-${today.toISOString().slice(0,10)}`);

    const todayMMDD = mmddUTC(today);

    // 1) Noticias publicadas (mínimo) - INCLUYENDO holiday_notification
    const published = await News.find(
      { 
        $or: [
          { status: 'published' },
          { type: 'holiday_notification', isActive: true } // ⬅️ INCLUIR NOTIFICACIONES DE FESTIVOS
        ]
      },
      { title: 1, body: 1, excerpt: 1, visibleFrom: 1, visibleUntil: 1, createdAt: 1, type: 1 }
    ).sort({ createdAt: -1 }).limit(10).lean();

    const items = (published || []).map((n) => ({
      id: String(n._id),
      type: n.type || 'static', // ⬅️ RESPETAR EL TYPE DE LA NOTIFICACIÓN
      title: n.title || 'Aviso',
      body: n.body || '',
      excerpt: n.excerpt || '',
      visibleFrom: n.visibleFrom ? toISO(n.visibleFrom) : undefined,
      visibleUntil: n.visibleUntil ? toISO(n.visibleUntil) : undefined,
    }));

    console.log('[feed] Noticias desde BD:', items.map(i => ({ type: i.type, title: i.title })));

    // 2) Días festivos: ventana 7d + fallback por proximidad
    const holidays = await Holiday.find({}, { name: 1, date: 1, recurring: 1, type: 1 }).lean();

    for (const h of holidays) {
      if (!h?.date || !h?.name) continue;

      const recurring = isRecurringFlag(h);
      const occStart = nextOccurrenceMX(h.date, recurring); // 00:00 MX del día de la ocurrencia
      const windowStart = addDays(occStart, -7);
      const windowEndExclusive = addDays(occStart, 1);

      const inWindow = today >= windowStart && today < windowEndExclusive;

      // Fallback: si faltan de 0 a 7 días, mostrarlo igual (cubrir edge TZ)
      const diff = differenceInCalendarDays(occStart, today); // MX vs MX
      const fallbackHit = !inWindow && diff >= 0 && diff <= 7;

      console.log('[feed][holiday-check]', {
        name: h.name,
        type: h.type ?? null,
        recurring,
        dateRaw: h.date,
        occStart: occStart.toISOString(),
        windowStart: windowStart.toISOString(),
        windowEndExclusive: windowEndExclusive.toISOString(),
        today: today.toISOString(),
        inWindow,
        diffDays: diff,
        fallbackHit,
      });

      if (inWindow || fallbackHit) {
        // ⬇️ VERIFICAR SI YA EXISTE UNA NOTIFICACIÓN PARA ESTE FESTIVO
        const existingHolidayNotification = items.find(item => 
          item.type === 'holiday_notice' && item.title.includes(h.name)
        );

        if (!existingHolidayNotification) {
          items.unshift({
            id: `holiday-${String(h._id)}-${occStart.getFullYear()}`,
            type: 'holiday_notice',
            title: `Próximo día festivo: ${h.name}`,
            body: `Se celebra el ${new Date(occStart).toLocaleDateString('es-MX', {
              timeZone: MX_TZ,
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
            })}.`,
            visibleFrom: toISO(windowStart),
            visibleUntil: toISO(windowEndExclusive),
          });

          // Email único al entrar a la ventana de 7 días
          try {
            const svc = await import('../services/notificationService.js');
            const fn = svc?.sendUpcomingHolidayEmailIfSevenDaysBefore;
            if (typeof fn === 'function') {
              await fn({ ...h, date: occStart });
            } else {
              console.warn('[holiday_notice] sendUpcomingHolidayEmailIfSevenDaysBefore no está exportada.');
            }
          } catch (errMail) {
            console.error('[holiday_notice 7d] error enviando correo:', errMail?.message || errMail);
          }
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

    console.log('[feed] items finales generados:', items.map(i => i.type + ':' + i.title));
    return res.json({ items });
  } catch (err) {
    next(err);
  }
};

// ⬇️ MANTENER getHomeFeed COMO ALIAS PARA COMPATIBILIDAD
export const getHomeFeed = getHomeNews;