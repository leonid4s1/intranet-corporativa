// server/src/services/notificationService.js
import User from '../models/User.js';
import Holiday from '../models/Holiday.js';
import DailyLock from '../models/DailyLock.js';
import { sendEmail } from './emailService.js';
import {
  startOfDay,
  subDays,
  addDays,
  differenceInCalendarDays
} from 'date-fns';

const MX_TZ = 'America/Mexico_City';

/* ===============================
 *   Helpers de zona horaria MX
 * =============================== */
function startOfDayInMX(date = new Date()) {
  const local = new Date(new Date(date).toLocaleString('en-US', { timeZone: MX_TZ }));
  return startOfDay(local);
}
function dayKeyMX(date = new Date()) {
  const y = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, year: 'numeric' });
  const m = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, month: '2-digit' });
  const d = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, day: '2-digit' });
  return `${y}-${m}-${d}`;
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
      .map(u => (u?.email || '').trim())
      .filter(e => e && SIMPLE_EMAIL_RE.test(e))
  );
  return Array.from(set);
}

async function safeSendEmail({ to, subject, html }) {
  if (!Array.isArray(to) || to.length === 0) {
    console.warn('⚠ safeSendEmail: lista de destinatarios vacía');
    return false;
  }
  try {
    await sendEmail({ to, subject, html });
    return true;
  } catch (err) {
    console.error('✉️  Error enviando correo:', err?.response?.body || err?.message || err);
    return false;
  }
}

/* ==========================================
 *  DIGEST DE CUMPLEAÑOS (1 vez al día MX)
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

  const names = birthdayUsers.map(u => u?.name || u?.email).join(', ');
  const subject = '🎂 Cumpleaños de hoy en la empresa';
  const html = `
    <h2>🎂 Cumpleaños de hoy en la empresa</h2>
    <p>Hoy celebramos a: <strong>${names}</strong>.</p>
    <p>¡Envíales tus buenos deseos! 🎉</p>
  `;

  const ok = await safeSendEmail({ to: toList, subject, html });
  if (ok) {
    console.log(`📨 Digest de cumpleaños ENVIADO a ${toList.length} cuentas (dayKey=${dayKey})`);
  } else {
    console.warn(`⚠ Digest de cumpleaños NO enviado (dayKey=${dayKey})`);
  }
  return ok;
};

/* =======================================
 *   CUMPLEAÑEROS HOY (campo birthDate)
 * ======================================= */
export async function getTodayBirthdayUsersMX() {
  // Comparación UTC vs UTC (evita desfaces por TZ)
  const todayMMDD = mmddUTC(new Date());

  const users = await User.find(
    { birthDate: { $exists: true, $ne: null }, isActive: { $ne: false } },
    { name: 1, email: 1, birthDate: 1 }
  ).lean();

  return users.filter(u => u.birthDate && mmddUTC(u.birthDate) === todayMMDD);
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

  const subject = `Recordatorio: faltan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} para ${holiday.name} (${prettyDateMX(holiday.date)})`;
  const html = `
    <h2>⏳ Faltan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}</h2>
    <p>Se acerca <strong>${holiday.name}</strong> el <strong>${prettyDateMX(holiday.date)}</strong>.</p>
    <p>Considera este descanso en tu planificación.</p>
  `;

  const ok = await safeSendEmail({ to: toList, subject, html });
  if (ok) {
    console.log(`📨 Aviso 7d de festivo ENVIADO a ${toList.length} cuentas (holidayId=${holiday._id}, dateKey=${dateKey})`);
  } else {
    console.warn(`⚠ Aviso 7d de festivo NO enviado (holidayId=${holiday._id}, dateKey=${dateKey})`);
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
      date: {
        $gte: today,
        $lte: futureDate
      }
    }).lean();

    console.log(`📅 Festivos encontrados en los próximos 30 días: ${upcomingHolidays.length}`);
    
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
    .map(a => (a?.email || '').trim())
    .filter(e => e && SIMPLE_EMAIL_RE.test(e));

  if (to.length === 0) {
    console.warn('⚠ notifyAdminsAboutNewRequest: no hay admins con email válido');
    return false;
  }

  // 2) Armar contenido
  const employee = user?.name || user?.email || 'Empleado';
  const start = prettyDateMX(vacationRequest?.startDate);
  const end   = prettyDateMX(vacationRequest?.endDate || vacationRequest?.startDate);
  const days  = vacationRequest?.days ?? vacationRequest?.totalDays ?? 1;

  const subject = `📅 Nueva solicitud de vacaciones: ${employee} (${start} – ${end})`;
  const html = `
    <h2>📅 Nueva solicitud de vacaciones</h2>
    <p><strong>Empleado:</strong> ${employee}</p>
    <p><strong>Período:</strong> ${start} – ${end}</p>
    <p><strong>Días solicitados:</strong> ${days}</p>
    ${vacationRequest?.reason ? `<p><strong>Motivo:</strong> ${vacationRequest.reason}</p>` : ''}
  `;

  // 3) Enviar
  const ok = await safeSendEmail({ to, subject, html });
  if (ok) {
    console.log(`📨 notifyAdminsAboutNewRequest: ENVIADO a ${to.length} admins`);
  } else {
    console.warn('⚠ notifyAdminsAboutNewRequest: NO enviado');
  }
  return ok;
}