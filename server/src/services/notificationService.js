// server/src/services/notificationService.js
import User from '../models/User.js';
import Holiday from '../models/Holiday.js';
import DailyLock from '../models/DailyLock.js';
import News from '../models/News.js';
import { sendEmail } from './emailService.js';
import { startOfDay, subDays, addDays, differenceInCalendarDays } from 'date-fns';

const MX_TZ = 'America/Mexico_City';

/* ===============================
 *   Helpers de zona horaria MX
 * =============================== */
function startOfDayInMX(date = new Date()) {
  const local = new Date(new Date(date).toLocaleString('en-US', { timeZone: MX_TZ }));
  return startOfDay(local);
}
function nowInMX(d = new Date()) {
  return new Date(new Date(d).toLocaleString('en-US', { timeZone: MX_TZ }));
}
function dayKeyMX(date = new Date()) {
  const y = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, year: 'numeric' });
  const m = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, month: '2-digit' });
  const d = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, day: '2-digit' });
  return `${y}-${m}-${d}`;
}
function yyyymmddMX(date = new Date()) {
  const y = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, year: 'numeric' });
  const m = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, month: '2-digit' });
  const d = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, day: '2-digit' });
  return `${y}${m}${d}`;
}
function prettyDateMX(d) {
  return new Date(d).toLocaleDateString('es-MX', {
    timeZone: MX_TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// Día/mes de HOY (usamos UTC para que coincida con cómo se guardan las fechas)
function mmddTodayMX() {
  const now = new Date();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

// Día/mes de una fecha de nacimiento almacenada (usamos UTC para que no cambie)
function mmddFromBirthDate(date) {
  const d = new Date(date);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

// Día/mes en MX genérico (puede seguir usándose en otras partes si hace falta)
function mmddMX(date = new Date()) {
  const n = nowInMX(date);
  const mm = n.toLocaleString('en-CA', { timeZone: MX_TZ, month: '2-digit' });
  const dd = n.toLocaleString('en-CA', { timeZone: MX_TZ, day: '2-digit' });
  return `${mm}-${dd}`;
}
// (Aún se usa en funciones legadas)
function mmddUTC(date) {
  const d = new Date(date);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

/* ===============================
 *   Helpers de envío de correo
 * =============================== */
const SIMPLE_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function collectRecipientEmails() {
  const users = await User.find(
    { isActive: { $ne: false }, email: { $exists: true, $ne: null } },
    { email: 1 }
  ).lean();

  // dedup + validación simple
  const set = new Set(
    (users || [])
      .map((u) => (u?.email || '').trim())
      .filter((e) => e && SIMPLE_EMAIL_RE.test(e))
  );
  return Array.from(set);
}

async function safeSendEmail({ to, subject, html }) {
  if (!Array.isArray(to) || to.length === 0) {
    console.warn('⚠ safeSendEmail: lista de destinatarios vacía');
    return false;
  }

  try {
    // Enviar UN correo por destinatario para no exponer la lista completa
    await Promise.all(
      to.map((email) =>
        sendEmail({
          to: email,
          subject,
          html,
        })
      )
    );

    return true;
  } catch (err) {
    console.error(
      '✉️  Error enviando correo:',
      err?.response?.body || err?.message || err
    );
    return false;
  }
}

/* ========================================
 *   CREAR NOTIFICACIÓN EN LA INTRANET
 * ======================================== */
async function createHolidayNotification(holiday, daysLeft) {
  try {
    const notificationTitle = `Faltan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} para ${holiday.name}`;
    const notificationBody = `Se acerca ${holiday.name} el ${prettyDateMX(
      holiday.date
    )}. Considera este descanso en tu planificación.`;

    // Verificar si ya existe una notificación similar para evitar duplicados
    const existingNotification = await News.findOne({
      title: notificationTitle,
      type: 'holiday_notice',
    });

    if (existingNotification) {
      console.log(`📢 Notificación ya existe en intranet: ${notificationTitle}`);
      return existingNotification;
    }

    // Calcular fechas de visibilidad
    const today = new Date();
    const visibleUntil = new Date(holiday.date);
    visibleUntil.setDate(visibleUntil.getDate() + 1); // Visible hasta el día después del festivo

    // Crear notificación
    const newsItem = await News.create({
      title: notificationTitle,
      body: notificationBody,
      excerpt: `Recordatorio: ${holiday.name} está próximo`,
      date: today,
      department: 'General',
      status: 'published',
      visibleFrom: today,
      visibleUntil: visibleUntil,
      type: 'holiday_notice',
      isActive: true,
      priority: daysLeft <= 3 ? 'high' : 'medium',
    });

    console.log(`📢 Notificación creada en intranet: ${notificationTitle}`);
    return newsItem;
  } catch (error) {
    console.error('❌ Error creando notificación en intranet:', error);
    return null;
  }
}

/* =========================================================
 *  NUEVO: Email masivo por "Comunicado" (announcement)
 *  - Usa imageUrl/excerpt/body/cta*
 * ========================================================= */
export async function notifyAllUsersAboutAnnouncement(recipientsOrNull, news) {
  try {
    const to =
      Array.isArray(recipientsOrNull) && recipientsOrNull.length
        ? recipientsOrNull
            .map((r) => (typeof r === 'string' ? r : r?.email))
            .filter((e) => e && SIMPLE_EMAIL_RE.test(e))
        : await collectRecipientEmails();

    if (!to.length) {
      console.warn('⚠ notifyAllUsersAboutAnnouncement: no hay destinatarios válidos');
      return false;
    }

    const subject = `📰 Nuevo comunicado: ${news?.title || 'Comunicación interna'}`;

    // Construir URL absoluta para imagen si hay PUBLIC_BASE_URL
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const absImage = news?.imageUrl
      ? news.imageUrl.startsWith('http')
        ? news.imageUrl
        : `${base}${news.imageUrl}`
      : null;

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
        <h2 style="margin:0 0 8px">Nuevo comunicado</h2>
        <h3 style="margin:0 0 16px">${news?.title || ''}</h3>
        ${absImage ? `<img src="${absImage}" alt="" style="max-width:100%;border-radius:8px;margin:8px 0" />` : ''}
        ${news?.excerpt ? `<p>${news.excerpt}</p>` : ''}
        ${news?.body ? `<div style="white-space:pre-wrap">${news.body}</div>` : ''}
        ${
          news?.ctaTo
            ? `<p style="margin-top:16px"><a href="${news.ctaTo}" style="background:#111;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none">${news?.ctaText || 'Ver más'}</a></p>`
            : ''
        }
      </div>
    `;

    const ok = await safeSendEmail({ to, subject, html });
    if (ok) console.log(`📨 Comunicado enviado a ${to.length} cuentas`);
    else console.warn('⚠ Comunicado NO enviado');
    return ok;
  } catch (err) {
    console.error('❌ notifyAllUsersAboutAnnouncement error:', err?.message || err);
    return false;
  }
}

/* ==========================================
 *  DIGEST DE CUMPLEAÑOS (legacy por parámetros)
 *  -> útil si llamas manualmente desde el controller
 * ========================================== */
export const sendBirthdayEmailsIfNeeded = async (date, birthdayUsers) => {
  const day = startOfDayInMX(date);
  const dayKey = dayKeyMX(day);

  if (!Array.isArray(birthdayUsers) || birthdayUsers.length === 0) return false;

  // Evita enviar dos veces en el mismo día
  const existed = await DailyLock.findOneAndUpdate(
    { type: 'birthday_digest', dateKey: dayKey },
    { $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: false }
  ).lean();
  if (existed) return false;

  const toList = await collectRecipientEmails();
  if (toList.length === 0) {
    console.warn('⚠ No hay destinatarios para el digest de cumpleaños');
    return false;
  }

  const names = birthdayUsers.map((u) => u?.name || u?.email).join(', ');
  const subject = '🎂 Cumpleaños de hoy en la empresa';
  const html = `
    <h2>🎂 Cumpleaños de hoy en la empresa</h2>
    <p>Hoy celebramos a: <strong>${names}</strong>.</p>
    <p>¡Envíales tus buenos deseos! 🎉</p>
 `;

  const ok = await safeSendEmail({ to: toList, subject, html });
  if (ok) {
    console.log(
      `📨 Digest de cumpleaños ENVIADO a ${toList.length} cuentas (dayKey=${dayKey})`
    );
  } else {
    console.warn(`⚠ Digest de cumpleaños NO enviado (dayKey=${dayKey})`);
  }
  return ok;
};

/* =========================================================
 *  CUMPLEAÑOS: CORREO PERSONAL 08:00 MX (idempotente)
 *  -> un correo por cumpleañero (no a toda la empresa)
 * ========================================================= */
export async function sendBirthdayEmailsIfDue() {
  // v2: nuevo key para ignorar locks viejos que se crearon sin cumpleaños
  const lockKey = `bday_emails_v2_${yyyymmddMX()}`;
  const existed = await DailyLock.findOne({ key: lockKey });
  if (existed) return { sent: false, reason: 'already-sent' };

  // Cumpleañeros HOY
  const all = await User.find(
    {
      birthDate: { $exists: true, $ne: null },
      isActive: { $ne: false },
      email: { $exists: true, $ne: null },
    },
    { name: 1, email: 1, birthDate: 1 }
  ).lean();

  const tagToday = mmddTodayMX();
  const birthdayUsers = all.filter(
    (u) => u.birthDate && mmddFromBirthDate(u.birthDate) === tagToday
  );

  console.log(
    '[birthdays][cron-personal] todayMMDD',
    tagToday,
    'count',
    birthdayUsers.length
  );

  if (!birthdayUsers.length) {
    await DailyLock.create({ key: lockKey, at: new Date(), type: 'bday_personal_v2' });
    return { sent: false, reason: 'no-birthdays' };
  }

  await Promise.all(
    birthdayUsers.map((u) => {
      const html = `
        <h2>🎂 ¡Feliz cumpleaños, ${u.name || 'colaborador/a'}!</h2>
        <p>Te deseamos un gran día de parte de todo el equipo.</p>
      `;
      return sendEmail({ to: u.email, subject: '🎉 ¡Feliz cumpleaños!', html });
    })
  );

  await DailyLock.create({ key: lockKey, at: new Date(), type: 'bday_personal_v2' });
  return { sent: true, count: birthdayUsers.length };
}

/* =========================================================
 *  CUMPLEAÑOS: DIGEST A TODA LA EMPRESA 08:00 MX (idempotente)
 *  -> correo grupal con la lista del día
 * ========================================================= */
export async function sendBirthdayDigestToAllIfDue() {
  const dayKey = dayKeyMX(startOfDayInMX(new Date()));
  const existed = await DailyLock.findOneAndUpdate(
    { type: 'birthday_digest_v2', dateKey: dayKey },
    { $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: false }
  ).lean();
  if (existed) return { sent: false, reason: 'already-sent' };

  // Cumpleañeros hoy
  const tagToday = mmddTodayMX();
  const users = await User.find(
    { birthDate: { $exists: true, $ne: null }, isActive: { $ne: false } },
    { name: 1, email: 1, birthDate: 1 }
  ).lean();

  const birthdayUsers = users.filter(
    (u) => u.birthDate && mmddFromBirthDate(u.birthDate) === tagToday
  );

  console.log(
    '[birthdays][cron-digest] todayMMDD',
    tagToday,
    'count',
    birthdayUsers.length
  );

  if (!birthdayUsers.length) {
    await DailyLock.create({
      type: 'birthday_digest_v2',
      dateKey: dayKey,
      at: new Date(),
    });
    return { sent: false, reason: 'no-birthdays' };
  }

  const toList = await collectRecipientEmails();
  if (!toList.length) return { sent: false, reason: 'no-recipients' };

  const names = birthdayUsers.map((u) => u?.name || u?.email).join(', ');
  const subject = '🎂 Cumpleaños de hoy en la empresa';
  const html = `
    <h2>🎂 Cumpleaños de hoy en la empresa</h2>
    <p>Hoy celebramos a: <strong>${names}</strong>.</p>
    <p>¡Envíales tus buenos deseos! 🎉</p>
  `;

  await safeSendEmail({ to: toList, subject, html });
  await DailyLock.create({
    type: 'birthday_digest_v2',
    dateKey: dayKey,
    at: new Date(),
  });
  return { sent: true, count: toList.length };
}

/* =======================================
 *   CUMPLEAÑEROS HOY (campo birthDate)
 * ======================================= */
export async function getTodayBirthdayUsersMX() {
  const tagToday = mmddTodayMX();
  const users = await User.find(
    { birthDate: { $exists: true, $ne: null }, isActive: { $ne: false } },
    { name: 1, email: 1, birthDate: 1 }
  ).lean();

  return users.filter(
    (u) => u.birthDate && mmddFromBirthDate(u.birthDate) === tagToday
  );
}

/* ====================================================
 *   AVISO DE FESTIVO (7 días antes, con DailyLock)
 * ==================================================== */
export async function sendUpcomingHolidayEmailIfSevenDaysBefore(holiday) {
  if (!holiday?.date || !holiday?.name || !holiday?._id) return false;

  const todayMX = startOfDayInMX(new Date());
  const holidayDateStart = startOfDayInMX(holiday.date);
  const windowStart = subDays(holidayDateStart, 7);
  const windowEndExclusive = addDays(holidayDateStart, 1);

  // Solo si HOY está dentro de la ventana [–7, +1)
  if (todayMX < windowStart || todayMX >= windowEndExclusive) return false;

  // Candado único por festivo y por inicio de ventana
  const dateKey = dayKeyMX(windowStart);
  const existed = await DailyLock.findOneAndUpdate(
    { type: 'holiday_upcoming_7d', dateKey, holidayId: String(holiday._id) },
    { $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: false }
  ).lean();
  if (existed) return false;

  const toList = await collectRecipientEmails();
  if (toList.length === 0) {
    console.warn('⚠ No hay destinatarios para el aviso de festivo (7d)');
    return false;
  }

  // Días restantes (solo informativo en el copy)
  const daysLeft = Math.max(0, differenceInCalendarDays(holidayDateStart, todayMX));

  const subject = `Recordatorio: faltan ${daysLeft} ${
    daysLeft === 1 ? 'día' : 'días'
  } para ${holiday.name} (${prettyDateMX(holiday.date)})`;
  const html = `
    <h2>⏳ Faltan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}</h2>
    <p>Se acerca <strong>${holiday.name}</strong> el <strong>${prettyDateMX(
    holiday.date
  )}</strong>.</p>
    <p>Considera este descanso en tu planificación.</p>
  `;

  // ⬇️ Crear notificación en la intranet ANTES de enviar el correo
  const notificationCreated = await createHolidayNotification(holiday, daysLeft);

  const ok = await safeSendEmail({ to: toList, subject, html });
  if (ok) {
    console.log(
      `📨 Aviso 7d de festivo ENVIADO a ${toList.length} cuentas (holidayId=${holiday._id}, dateKey=${dateKey})`
    );
    if (notificationCreated) {
      console.log(`📢 Notificación interna creada para: ${holiday.name}`);
    }
  } else {
    console.warn(
      `⚠ Aviso 7d de festivo NO enviado (holidayId=${holiday._id}, dateKey=${dateKey})`
    );
  }
  return ok;
}

/* ========================================
 *   JOB PROGRAMADO: Verificar festivos
 * ======================================== */
export async function checkAllUpcomingHolidays() {
  try {
    console.log('🔍 Buscando festivos próximos para notificación...');

    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 30); // Buscar en los próximos 30 días

    const upcomingHolidays = await Holiday.find({
      date: { $gte: today, $lte: futureDate },
    }).lean();

    console.log(
      `📅 Festivos encontrados en los próximos 30 días: ${upcomingHolidays.length}`
    );

    let notificationsSent = 0;
    for (const holiday of upcomingHolidays) {
      const sent = await sendUpcomingHolidayEmailIfSevenDaysBefore(holiday);
      if (sent) notificationsSent++;
    }

    console.log(`📨 Notificaciones de festivos enviadas: ${notificationsSent}`);
    return notificationsSent;
  } catch (error) {
    console.error('❌ Error en checkAllUpcomingHolidays:', error);
    return 0;
  }
}

/* ========================================
 *   FUNCIÓN PARA TESTING MANUAL
 * ======================================== */
export async function testHolidayNotifications() {
  try {
    console.log('🧪 Iniciando prueba manual de notificaciones de festivos...');
    const result = await checkAllUpcomingHolidays();
    console.log(`✅ Prueba completada. Notificaciones enviadas: ${result}`);
    return result;
  } catch (error) {
    console.error('❌ Error en prueba manual:', error);
    throw error;
  }
}

/* ===========================================================
 *   CORREO A ADMINs: nueva solicitud de vacaciones (inmediato)
 * =========================================================== */
export async function notifyAdminsAboutNewRequest(vacationRequest, user) {
  // 1) Obtener admins activos con email válido
  const admins = await User.find(
    { role: 'admin', isActive: { $ne: false }, email: { $exists: true, $ne: null } },
    { email: 1, name: 1 }
  ).lean();

  const to = (admins || [])
    .map((a) => (a?.email || '').trim())
    .filter((e) => e && SIMPLE_EMAIL_RE.test(e));

  if (!to.length) {
    console.warn('⚠ notifyAdminsAboutNewRequest: no hay admins con email válido');
    return false;
  }

  // 2) Armar contenido
  const employee = user?.name || user?.email || 'Empleado';
  const start = prettyDateMX(vacationRequest?.startDate);
  const end = prettyDateMX(
    vacationRequest?.endDate || vacationRequest?.startDate
  );
  const days = vacationRequest?.days ?? vacationRequest?.totalDays ?? 1;

  const subject = `📅 Nueva solicitud de vacaciones: ${employee} (${start} – ${end})`;
  const html = `
    <h2>📅 Nueva solicitud de vacaciones</h2>
    <p><strong>Empleado:</strong> ${employee}</p>
    <p><strong>Período:</strong> ${start} – ${end}</p>
    <p><strong>Días solicitados:</strong> ${days}</p>
    ${
      vacationRequest?.reason
        ? `<p><strong>Motivo:</strong> ${vacationRequest.reason}</p>`
        : ''
    }
  `;

  // 3) Enviar
  const ok = await safeSendEmail({ to, subject, html });
  if (ok) {
    console.log(
      `📨 notifyAdminsAboutNewRequest: ENVIADO a ${to.length} admins`
    );
  } else {
    console.warn('⚠ notifyAdminsAboutNewRequest: NO enviado');
  }
  return ok;
}
