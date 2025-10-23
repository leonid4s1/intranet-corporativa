// server/src/controllers/newsController.js
const News = require('../models/News');
const Holiday = require('../models/Holiday');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const { startOfDay, addDays, isBefore, isAfter } = require('date-fns');

// === TZ MX helpers ===
const MX_TZ = 'America/Mexico_City';
function startOfDayInMX(date = new Date()) {
  const local = new Date(new Date(date).toLocaleString('en-US', { timeZone: MX_TZ }));
  return startOfDay(local);
}
function mmddMX(date) {
  const d = new Date(date);
  const mm = d.toLocaleString('en-CA', { timeZone: MX_TZ, month: '2-digit' });
  const dd = d.toLocaleString('en-CA', { timeZone: MX_TZ, day: '2-digit' });
  return `${mm}-${dd}`;
}

function toISO(d) { return new Date(d).toISOString(); }
function nextOccurrence(holidayDate, isRecurring) {
  const base = new Date(holidayDate);
  const todayLocal = startOfDayInMX(); // usa MX
  let occurrence = new Date(todayLocal.getFullYear(), base.getMonth(), base.getDate());
  if (!isRecurring) return occurrence;
  if (isAfter(startOfDay( todayLocal ), startOfDay( occurrence ))) {
    occurrence = new Date(todayLocal.getFullYear() + 1, base.getMonth(), base.getDate());
  }
  return occurrence;
}

exports.getHomeFeed = async (req, res, next) => {
  try {
    const user = req.user;
    const today = startOfDayInMX(); // <-- antes: startOfDay(new Date())

    // 1) Noticias publicadas
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

    // 2) Aviso de feriado (ventana 2 días antes; oculta el mismo día)
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

    // 3) Cumpleaños (self) y 4) Digest para todos (TZ MX, no bloquear por email)
    if (user) {
      const me = await User.findById(user.id).lean();
      const todayMMDD = mmddMX(today);

      // Self
      if (me?.birthDate && mmddMX(me.birthDate) === todayMMDD) {
        items.unshift({
          id: `birthday-self-${me._id}-${todayMMDD}`,
          type: 'birthday_self',
          title: `¡Feliz cumpleaños, ${me.name?.split(' ')[0] || 'colaborador'}!`,
          body: 'Te deseamos un día increíble. 🎉',
          visibleFrom: toISO(today),
          visibleUntil: toISO(addDays(today, 1)),
        });
      }

      // Digest (para todos)
      const all = await User.find(
        { birthDate: { $ne: null } },
        { name: 1, email: 1, birthDate: 1 }
      ).lean();

      const birthdayTodayUsers = all.filter(u => mmddMX(u.birthDate) === todayMMDD);

      if (birthdayTodayUsers.length > 0) {
        const names = birthdayTodayUsers.map(u => u.name || u.email).join(', ');
        // Inserta SIEMPRE el digest
        items.unshift({
          id: `birthday-digest-${todayMMDD}`,
          type: 'birthday_digest_info',
          title: 'Cumpleaños de hoy',
          body: `Hoy celebramos a: ${names}. ¡Felicítenl@s! 🎂`,
          visibleFrom: toISO(today),
          visibleUntil: toISO(addDays(today, 1)),
        });

        // Email sin bloquear
        try {
          await notificationService.sendBirthdayEmailsIfNeeded(today, birthdayTodayUsers);
        } catch (errMail) {
          console.error('[birthdays] error enviando correos:', errMail?.message || errMail);
        }
      }
    }

    res.json({ items });
  } catch (err) {
    next(err);
  }
};
