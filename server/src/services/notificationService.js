// server/src/services/notificationService.js
import User from '../models/User.js';
import DailyLock from '../models/DailyLock.js';
import { sendEmail } from './emailService.js';
import { startOfDay, subDays } from 'date-fns';

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

/** Calcula el inicio de ventana de aviso para un festivo según reglas:
 *  - Por defecto: 2 días antes
 *  - Si cae en lunes: desde el viernes anterior (lunes - 3 días)
 */
function getHolidayNoticeWindowStartMX(holidayDate) {
  const hDayStart = startOfDayInMX(holidayDate);
  const weekdayShort = new Date(holidayDate)
    .toLocaleString('en-CA', { timeZone: MX_TZ, weekday: 'short' })
    .toLowerCase(); // mon, tue, ...
  // Normal: 2 días antes
  let windowStart = subDays(hDayStart, 2);
  // Si es lunes => viernes anterior (lunes - 3)
  if (weekdayShort === 'mon') {
    windowStart = subDays(hDayStart, 3);
  }
  return windowStart;
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
    // Compara la fecha de nacimiento también “vista” en MX
    const dobLocal = new Date(new Date(u.birthday).toLocaleString('en-US', { timeZone: MX_TZ }));
    return dobLocal.getMonth() === month && dobLocal.getDate() === day;
  });
}

/**
 * ENVÍO ÚNICO de aviso de festivo para TODOS los usuarios, SOLO el PRIMER día que el aviso aparece.
 * Reglas:
 *  - Mostrar 2 días antes; si es lunes, desde viernes anterior.
 *  - El email se envía SOLAMENTE el primer día visible (windowStart).
 *
 * @param {{ _id:any, name:string, date:Date }} holiday
 * @returns {Promise<boolean>} true si se envió, false si no correspondía o ya estaba enviado.
 */
export async function sendUpcomingHolidayEmailIfFirstDay(holiday) {
  if (!holiday?.date || !holiday?.name || !holiday?._id) return false;

  const todayMX = startOfDayInMX(new Date());
  const holidayDateStart = startOfDayInMX(holiday.date);
  const windowStart = getHolidayNoticeWindowStartMX(holidayDateStart);

  // Solo el primer día visible
  if (todayMX.getTime() !== windowStart.getTime()) return false;

  // Lock: por festivo y por día de inicio de ventana
  const dateKey = dayKeyMX(windowStart);
  const existed = await DailyLock.findOneAndUpdate(
    { type: 'holiday_upcoming', dateKey, holidayId: String(holiday._id) },
    { $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: false }
  ).lean();

  if (existed) return false; // ya se envió

  const recipients = await User.find(
    { email: { $exists: true, $ne: null }, isActive: { $ne: false } },
    { email: 1 }
  ).lean();

  const toList = recipients.map(u => u.email).filter(Boolean);
  if (toList.length === 0) {
    console.warn('⚠ No hay destinatarios para el aviso de festivo');
    return false;
  }

  const subject = `Aviso: próximo día festivo – ${holiday.name} (${prettyDateMX(holiday.date)})`;
  const html = `
    <h2>🎉 Próximo día festivo</h2>
    <p><strong>${holiday.name}</strong> será el <strong>${prettyDateMX(holiday.date)}</strong>.</p>
    <p>Considera este descanso en tu planificación.</p>
  `;

  await sendEmail({ to: toList, subject, html });
  console.log(`📨 Aviso de festivo ENVIADO a ${toList.length} cuentas (holidayId=${holiday._id}, dateKey=${dateKey})`);
  return true;
}