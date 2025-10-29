// server/src/services/notificationService.js
import User from '../models/User.js';
import DailyLock from '../models/DailyLock.js';
import { sendEmail } from './emailService.js';
import { startOfDay } from 'date-fns';

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
