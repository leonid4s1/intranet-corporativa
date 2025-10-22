// server/src/controllers/newsController.js
const News = require('../models/News');
const Holiday = require('../models/Holiday');
const User = require('../models/User');
const notificationService = require('../services/notificationService'); // ya existe
const { startOfDay, addDays, isBefore, isAfter } = require('date-fns');

function toISO(d) { return new Date(d).toISOString(); }

// === TZ-aware (CDMX) ===
const TZ = 'America/Mexico_City';
function mmddTZ(date) {
  // Devuelve "MM-DD" en la zona horaria de CDMX
  const d = (typeof date === 'string' || typeof date === 'number') ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, month: '2-digit', day: '2-digit'
  }).format(d); // p.ej. "10-21"
}

function nextOccurrence(holidayDate, isRecurring) {
  const base = new Date(holidayDate);
  const today = new Date();
  let occurrence = new Date(today.getFullYear(), base.getMonth(), base.getDate());
  if (!isRecurring) return occurrence; // único (año de holidayDate)
  // si ya pasó este año, usa el siguiente
  if (isAfter(startOfDay(today), startOfDay(occurrence))) {
    occurrence = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate());
  }
  return occurrence;
}

exports.getHomeFeed = async (req, res, next) => {
  try {
    const user = req.user; // viene del auth middleware
    const today = startOfDay(new Date());
    const todayMD = mmddTZ(today);

    // 1) Noticias estáticas publicadas
    const published = await News.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const items = (published || []).map(n => ({
      id: String(n._id),
      type: 'static',
      title: n.title,
      body: n.body || '',
      visibleFrom: n.visibleFrom ? toISO(n.visibleFrom) : undefined,
      visibleUntil: n.visibleUntil ? toISO(n.visibleUntil) : undefined,
    }));

    // 2) Aviso de feriado (muestra 2 días antes y oculta el día del feriado)
    const holidays = await Holiday.find({}).lean();
    for (const h of holidays) {
      const isRecurring = h.recurring === true || h.type === 'recurring';
      const occ = nextOccurrence(h.date, isRecurring);
      const startShow = addDays(occ, -2); // 2 días antes
      const endHide = startOfDay(occ);    // el propio día no se muestra

      if (isAfter(today, startOfDay(startShow)) && isBefore(today, endHide)) {
        items.unshift({
          id: `holiday-${h._id}`,
          type: 'holiday_notice',
          title: 'Nueva política de vacaciones',
          body:
            `Se acerca el feriado "${h.name}" el ${occ.toLocaleDateString()}. ` +
            `Planifica tus solicitudes con anticipación.`,
          visibleFrom: toISO(startShow),
          visibleUntil: toISO(endHide),
        });
      }
    }

    // 3) Cumpleaños del usuario (solo ese día)
    let birthdayTodayUsers = [];
    if (user) {
      const me = await User.findById(user.id).lean();
      if (me?.birthDate) {
        if (mmddTZ(me.birthDate) === todayMD) {
          items.unshift({
            id: `birthday-self-${me._id}-${todayMD}`,
            type: 'birthday_self',
            title: `¡Feliz cumpleaños, ${me.name?.split(' ')[0] || 'colaborador'}!`,
            body: 'Te deseamos un día increíble. 🎉',
            visibleFrom: toISO(today),
            visibleUntil: toISO(addDays(today, 1)),
          });
        }
      }

      // 4) Detectar cumpleañeros del día y enviar correo (una vez por día)
      birthdayTodayUsers = await User.find({
        birthDate: { $ne: null },
      }, { name: 1, email: 1, birthDate: 1 }).lean();

      birthdayTodayUsers = birthdayTodayUsers.filter(u => mmddTZ(u.birthDate) === todayMD);

      if (birthdayTodayUsers.length > 0) {
        await notificationService.sendBirthdayEmailsIfNeeded(today, birthdayTodayUsers);
        // (opcional) añadir un ítem informativo para el carrusel
        const names = birthdayTodayUsers.map(u => u.name || u.email).join(', ');
        items.unshift({
          id: `birthday-digest-${todayMD}`,
          type: 'birthday_digest_info',
          title: 'Cumpleaños de hoy',
          body: `Hoy celebramos a: ${names}. ¡Felicítenl@s! 🎂`,
          visibleFrom: toISO(today),
          visibleUntil: toISO(addDays(today, 1)),
        });
      }
    }

    res.json({ items });
  } catch (err) {
    next(err);
  }
};
