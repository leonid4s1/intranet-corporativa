// server/src/controllers/newsController.js
const News = require('../models/News');
const Holiday = require('../models/Holiday');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const { startOfDay, addDays, subDays, isBefore, isAfter } = require('date-fns');

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

/** Inicio de ventana de aviso:
 *  - Normal: 2 días antes
 *  - Si el festivo es lunes: desde viernes anterior (3 días antes)
 */
function calcWindowStartMX(occDate) {
  const occStart = startOfDayInMX(occDate);
  const weekdayShort = new Date(occDate)
    .toLocaleString('en-CA', { timeZone: MX_TZ, weekday: 'short' })
    .toLowerCase(); // mon, tue, ...
  // por defecto 2 días antes
  let windowStart = subDays(occStart, 2);
  if (weekdayShort === 'mon') {
    windowStart = subDays(occStart, 3); // viernes anterior
  }
  return windowStart;
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

    /* 2) Avisos de feriado (reglas: 2 días antes; si es lunes, desde viernes; desaparece al día siguiente) */
    const holidays = await Holiday.find({}).lean();
    for (const h of holidays) {
      const isRecurring = h.recurring === true || h.type === 'recurring';
      const occ = nextOccurrence(h.date, isRecurring);                 // ocurrencia (año vigente)
      const windowStart = calcWindowStartMX(occ);                      // inicio de ventana MX
      const windowEndExclusive = addDays(startOfDayInMX(occ), 1);      // desaparece al día siguiente

      // Mostrar si today ∈ [windowStart, windowEndExclusive)
      const inWindow =
        (today.getTime() >= windowStart.getTime()) &&
        (today.getTime() < windowEndExclusive.getTime());

      if (inWindow) {
        // Item para el feed (id con año para evitar choques entre años)
        items.unshift({
          id: `holiday-${h._id}-${occ.getFullYear()}`,
          type: 'holiday_notice',
          title: `Próximo día festivo: ${h.name}`,
          body: `Se celebra el ${new Date(occ).toLocaleDateString('es-MX', { timeZone: MX_TZ, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}.`,
          visibleFrom: toISO(windowStart),
          visibleUntil: toISO(windowEndExclusive),
        });

        // Dispara correo SOLO el primer día (la función ya valida y usa DailyLock).
        try {
          // Pasamos la ocurrencia en el campo date para que el correo tenga la fecha correcta del año actual
          await notificationService.sendUpcomingHolidayEmailIfFirstDay({
            ...h,
            date: occ
          });
        } catch (errMail) {
          console.error('[holiday_notice] error enviando correo masivo:', errMail?.message || errMail);
        }
      }
    }

    /* 3) Cumpleaños: mostrar SOLO un comunicado por usuario
          - Si el usuario autenticado cumple hoy -> SOLO 'birthday_self'
          - Si NO cumple, pero hay cumpleañeros -> SOLO 'birthday_digest_info'
          - El correo digest se envía si hay cumpleañeros (independiente de UI) */
    if (user) {
      // Trae todos los cumpleañeros de hoy (comparando birthDate en UTC)
      const all = await User.find(
        { birthDate: { $ne: null } },
        { name: 1, email: 1, birthDate: 1 }
      ).lean();

      const birthdayTodayUsers = all.filter((u) => u.birthDate && mmddUTC(u.birthDate) === todayMMDD);

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
      const isMyBirthday = !!me?.birthDate && mmddUTC(me.birthDate) === todayMMDD;

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