// server/src/services/notificationService.js
import User from '../models/User.js';
import DailyLock from '../models/DailyLock.js';
import { sendEmail } from './emailService.js';
import { startOfDay, subDays, addDays } from 'date-fns';

const MX_TZ = 'America/Mexico_City';

// === Helpers de zona MX (sin date-fns-tz) ===
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
function getMonthDayInMX(date = new Date()) {
  const local = new Date(date.toLocaleString('en-US', { timeZone: MX_TZ }));
  return { month: local.getMonth(), day: local.getDate() }; // 0..11, 1..31
}
function prettyDateMX(d) {
  return new Date(d).toLocaleDateString('es-MX', {
    timeZone: MX_TZ,
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

/**
 * Envía el digest de cumpleaños una vez al día (MX) con DailyLock.
 */
export const sendBirthdayEmailsIfNeeded = async (date, birthdayUsers) => {
  const day = startOfDayInMX(date);
  const dayKey = dayKeyMX(day);

  if (!Array.isArray(birthdayUsers) || birthdayUsers.length === 0) return false;

  const existed = await DailyLock.findOneAndUpdate(
    { type: 'birthday_digest', dateKey: dayKey },
    { $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: false }
  ).lean();
  if (existed) return false;

  const allUsers = await User.find(
    { email: { $exists: true, $ne: null } },
    { email: 1 }
  ).lean();

  const toList = allUsers.map(u => u.email).filter(Boolean);
  if (toList.length === 0) {
    console.warn('⚠ No hay destinatarios para el digest de cumpleaños');
    return false;
  }

  const names = birthdayUsers.map(u => u?.name || u?.email).filter(Boolean).join(', ');
  const subject = '🎂 Cumpleaños de hoy en la empresa';
  const html = `
    <h2>🎂 Cumpleaños de hoy en la empresa</h2>
    <p>Hoy celebramos a: <strong>${names}</strong>.</p>
    <p>¡Envíales tus buenos deseos! 🎉</p>
  `;

  await sendEmail({ to: toList, subject, html });
  console.log(`📨 Digest de cumpleaños ENVIADO a ${toList.length} cuentas (dayKey=${dayKey})`);
  return true;
};

/** Cumpleañeros de HOY en zona MX (sin date-fns-tz) */
export async function getTodayBirthdayUsersMX() {
  const { month, day } = getMonthDayInMX(new Date());

  const users = await User.find(
    { birthday: { $exists: true, $ne: null }, isActive: { $ne: false } },
    { name: 1, email: 1, birthday: 1 }
  ).lean();

  return users.filter(u => {
    if (!u.birthday) return false;
    const dobLocal = new Date(new Date(u.birthday).toLocaleString('en-US', { timeZone: MX_TZ }));
    return dobLocal.getMonth() === month && dobLocal.getDate() === day;
  });
}

/**
 * AVISO DE FESTIVO (REGLA NUEVA):
 *  - Ventana: [–7 días, día siguiente al festivo)
 *  - Enviar correo ÚNICO la PRIMERA VEZ que detectamos que hoy está dentro de esa ventana.
 *    (Si el día -7 se pasó o el server estuvo caído, igual se envía la primera vez que entre a la ventana)
 *
 * @param {{ _id:any, name:string, date:Date }} holiday  // holiday.date debe ser la ocurrencia del año actual
 * @returns {Promise<boolean>} true si envió, false si ya estaba enviado o fuera de ventana.
 */
export async function sendUpcomingHolidayEmailIfSevenDaysBefore(holiday) {
  if (!holiday?.date || !holiday?.name || !holiday?._id) return false;

  const todayMX = startOfDayInMX(new Date());
  const holidayDateStart = startOfDayInMX(holiday.date);
  const windowStart = subDays(holidayDateStart, 7);
  const windowEndExclusive = addDays(holidayDateStart, 1);

  // Solo si HOY está dentro de la ventana 7d
  if (todayMX < windowStart || todayMX >= windowEndExclusive) return false;

  // Lock por (type, dateKey=-7 del festivo, holidayId)
  const dateKey = dayKeyMX(windowStart);
  const existed = await DailyLock.findOneAndUpdate(
    { type: 'holiday_upcoming_7d', dateKey, holidayId: String(holiday._id) },
    { $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: false }
  ).lean();
  if (existed) return false;

  const recipients = await User.find(
    { email: { $exists: true, $ne: null }, isActive: { $ne: false } },
    { email: 1 }
  ).lean();

  const toList = recipients.map(u => u.email).filter(Boolean);
  if (toList.length === 0) {
    console.warn('⚠ No hay destinatarios para el aviso de festivo (7d)');
    return false;
  }

  const subject = `Recordatorio: falta 1 semana para ${holiday.name} (${prettyDateMX(holiday.date)})`;
  const html = `
    <h2>⏳ Falta 1 semana</h2>
    <p>Se acerca <strong>${holiday.name}</strong> el <strong>${prettyDateMX(holiday.date)}</strong>.</p>
    <p>Considera este descanso en tu planificación.</p>
  `;

  await sendEmail({ to: toList, subject, html });
  console.log(`📨 Aviso 7d de festivo ENVIADO a ${toList.length} cuentas (holidayId=${holiday._id}, dateKey=${dateKey})`);
  return true;
}
