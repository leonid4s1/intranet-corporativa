// server/src/controllers/newsController.js
const News = require('../models/News');
const Holiday = require('../models/Holiday');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const { startOfDay, addDays, isBefore, isAfter } = require('date-fns');

/* =========================
 *        TZ MX helpers
 * ========================= */
const MX_TZ = 'America/Mexico_City';

// "Hoy" a las 00:00 en MX (Date)
function startOfDayInMX(date = new Date()) {
  const local = new Date(new Date(date).toLocaleString('en-US', { timeZone: MX_TZ }));
  return startOfDay(local);
}

// mm-dd de una fecha en zona MX (para “hoy”)
function mmddMX(date) {
  const d = new Date(date);
  const mm = d.toLocaleString('en-CA', { timeZone: MX_TZ, month: '2-digit' });
  const dd = d.toLocaleString('en-CA', { timeZone: MX_TZ, day: '2-digit' });
  return `${mm}-${dd}`;
}

// mm-dd del birthDate en UTC (no desplazamos por zona)
function mmddUTC(date) {
  const d = new Date(date);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

function toISO(d) {
  return new Date(d).toISOString();
}

// Próxima ocurrencia de un feriado (respeta recurrency; compara en MX)
function nextOccurrence(holidayDate, isRecurring) {
  const base = new Date(holidayDate);
  const todayLocal = startOfDayInMX(); // usa MX
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

/* =========================
 *        Controller
 * ========================= */
exports.getHomeFeed = async (req, res, next) => {
  try {
    const user = req.user;
    const today = startOfDayInMX(); // inicio de día en MX
    const todayMMDD = mmddMX(today);

    /* 1) Noticias publicadas */
    const published = await News.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const items = (published || []).map((n) => ({
      id: String(n._id),
      type: 'static',
      title: n.title,
      body: n.body || '',
      visibleFrom: n.visibleFrom ? toISO(n.visibleFrom) : undefined,
      visibleUntil: n.visibleUntil ? toISO(n.visibleUntil) : undefined,
    }));

    /* 2) Avisos de feriado (ventana: 2 días antes; oculta el mismo día) */
    const holidays = await Holiday.find({}).lean();
    for (const h of holidays) {
      const isRecurring = h.recurring === true || h.type === 'recurring';
      const occ = nextOccurrence(h.date, isRecurring);
      const startShow = addDays(occ, -2);
      const endHide = startOfDay(occ);

      if (isAfter(today, startOfDay(startShow)) && isBefore(today, endHide)) {
        items.unshift({
          id: `holiday-${h._id}`,
          type: 'holiday_notice',
          title: `Se acerca el feriado "${h.name}"`,
          body: `Será el ${occ.toLocaleDateString('es-MX')}. Planifica tus solicitudes con anticipación.`,
          visibleFrom: toISO(startShow),
          visibleUntil: toISO(endHide),
        });
      }
    }

    /* 3) Cumpleaños: mostrar SOLO un comunicado por usuario
          - Si el usuario autenticado cumple hoy -> SOLO 'birthday_self'
          - Si NO cumple, pero hay cumpleañeros -> SOLO 'birthday_digest_info'
          - El correo digest se envía si hay cumpleañeros (independiente de UI) */
    if (user) {
      // Trae todos los cumpleañeros de hoy (comparando birthDate en UTC)
      const all = await User.find(
        { birthday: { $ne: null } },
        { name: 1, email: 1, birthDate: 1 }
      ).lean();
      const birthdayTodayUsers = all.filter(
        (u) => mmddUTC(u.birthday) === todayMMDD
      );

      // Enviar correo digest si hay cumpleañeros (idempotencia la maneja DailyLock)
      if (birthdayTodayUsers.length > 0) {
        try {
          await notificationService.sendBirthdayEmailsIfNeeded(
            today,
            birthdayTodayUsers
          );
        } catch (errMail) {
          console.error(
            '[birthdays] error enviando correos:',
            errMail?.message || errMail
          );
        }
      }

      // ¿El usuario autenticado cumple hoy?
      const me = await User.findById(user.id).lean();
      const isMyBirthday =
        !!me?.birthDate && mmddUTC(me.birthday) === todayMMDD;

      if (isMyBirthday) {
        const first = (me?.name || 'colaborador').split(' ')[0];
        items.unshift({
          id: `birthday-self-${me._id}-${todayMMDD}`,
          type: 'birthday_self',
          title: `¡Feliz cumpleaños, ${first}!`,
          body: 'Te deseamos un día increíble. 🎉',
          visibleFrom: toISO(today),
          visibleUntil: toISO(addDays(today, 1)),
        });
      } else if (birthdayTodayUsers.length > 0) {
        const names = birthdayTodayUsers
          .map((u) => u.name || u.email)
          .join(', ');
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
