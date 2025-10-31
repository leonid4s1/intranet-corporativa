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

// Próxima ocurrencia de feriado (respeta recurrencia, compara en MX)
function nextOccurrence(holidayDate, isRecurring) {
  const base = new Date(holidayDate);
  const todayLocal = startOfDayInMX();
  let occurrence = new Date(
    todayLocal.getFullYear(),
    base.getMonth(),
    base.getDate()
  );
  if (!isRecurring) return occurrence;
  if (isAfter(startOfDay(todayLocal), startOfDay(occurrence))) {
    occurrence = new Date(
      todayLocal.getFullYear() + 1,
      base.getMonth(),
      base.getDate()
    );
  }
  return occurrence;
}

export const getHomeFeed = async (req, res, next) => {
  try {
    const user = req.user;
    const today = startOfDayInMX();
    const todayMMDD = mmddUTC(today); // ✅ cumpleaños: UTC vs UTC

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
      const occ = nextOccurrence(h.date, isRecurring);
      const occStart = startOfDayInMX(occ);

      const windowStart = addDays(occStart, -7);
      const windowEndExclusive = addDays(occStart, 1);

      const inWindow = today >= windowStart && today < windowEndExclusive;

      if (inWindow) {
        console.log('[feed] holiday in window:', h.name, 'occ=', occ.toISOString());

        items.unshift({
          id: `holiday-${String(h._id)}-${occ.getFullYear()}`,
          type: 'holiday_notice',
          title: `Próximo día festivo: ${h.name}`,
          body: `Se celebra el ${new Date(occ).toLocaleDateString('es-MX', {
            timeZone: MX_TZ,
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
          })}.`,
          visibleFrom: toISO(windowStart),
          visibleUntil: toISO(windowEndExclusive),
        });

        // Envío de correo (único al entrar a ventana 7d)
        try {
          const svc = await import('../services/notificationService.js');
          await svc.sendUpcomingHolidayEmailIfSevenDaysBefore({
            ...h,
            date: occ, // usar ocurrencia actual
          });
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

      // Enviar digest si hay cumpleañeros (idempotencia: DailyLock)
      if (birthdayTodayUsers.length > 0) {
        try {
          const svc = await import('../services/notificationService.js');
          await svc.sendBirthdayEmailsIfNeeded(today, birthdayTodayUsers);
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
