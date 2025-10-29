// server/src/services/notificationService.js
import User from '../models/User.js';
import DailyLock from '../models/DailyLock.js'; // <-- usamos el lock diario
import { sendEmail } from './emailService.js';
import { startOfDay } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

const MX_TZ = 'America/Mexico_City';

// === Helpers de zona MX ===
function startOfDayInMX(date = new Date()) {
  const local = new Date(new Date(date).toLocaleString('en-US', { timeZone: MX_TZ }));
  return startOfDay(local);
}
function dayKeyMX(date = new Date()) {
  // YYYY-MM-DD en zona MX (cero-relleno)
  const y = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, year: 'numeric' });
  const m = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, month: '2-digit' });
  const d = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, day: '2-digit' });
  return `${y}-${m}-${d}`;
}

/**
 * Envía un correo a TODOS los usuarios con el/los cumpleañeros del día (día MX).
 * Idempotencia por día MX usando DailyLock (índice único type+dateKey).
 *
 * @returns {Promise<boolean>} true si envió, false si se omitió (ya enviado o sin destinatarios/celebrantes)
 */
export const sendBirthdayEmailsIfNeeded = async (date, birthdayUsers) => {
  // Normaliza a inicio de día MX e identifica el día con clave MX
  const day = startOfDayInMX(date);
  const dayKey = dayKeyMX(day);

  // Si no hay cumpleañeros, no intentamos enviar ni tomar lock
  if (!Array.isArray(birthdayUsers) || birthdayUsers.length === 0) return false;

  // ===== Candado idempotente (atómico) =====
  // Si ya existe un documento con (type='birthday_digest', dateKey=YYYY-MM-DD), NO enviamos.
  const existed = await DailyLock.findOneAndUpdate(
    { type: 'birthday_digest', dateKey: dayKey },
    { $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: false } // si devuelve doc => ya existía
  ).lean();

  if (existed) {
    // Ya se envió hoy (u otro proceso tomó el lock)
    return false;
  }

  // ===== Construcción de destinatarios =====
  // Filtramos usuarios con email definido (puedes añadir { isActive: true } si tu esquema lo tiene)
  const allUsers = await User.find(
    { email: { $exists: true, $ne: null } },
    { email: 1 }
  ).lean();

  const toList = allUsers.map(u => u.email).filter(Boolean);
  if (toList.length === 0) {
    console.warn('⚠ No hay destinatarios para el digest de cumpleaños');
    return false;
  }

  // ===== Contenido del correo =====
  const names = birthdayUsers.map(u => u?.name || u?.email).filter(Boolean).join(', ');
  const subject = '🎂 Cumpleaños de hoy en la empresa';
  const html = `
    <h2>🎂 Cumpleaños de hoy en la empresa</h2>
    <p>Hoy celebramos a: <strong>${names}</strong>.</p>
    <p>¡Envíales tus buenos deseos! 🎉</p>
  `;

  // ===== Envío =====
  await sendEmail({ to: toList, subject, html });

  console.log(`📨 Digest de cumpleaños ENVIADO a ${toList.length} cuentas (dayKey=${dayKey})`);
  return true;
};

import { utcToZonedTime } from 'date-fns-tz';

export async function getTodayBirthdayUsersMX() {
  const mxNow = utcToZonedTime(new Date(), 'America/Mexico_City');
  const month = mxNow.getMonth(); // 0..11
  const day = mxNow.getDate();    // 1..31

  const users = await User.find(
    { birthday: { $exists: true, $ne: null }, isActive: { $ne: false } },
    { name: 1, email: 1, birthday: 1 }
  ).lean();

  return users.filter(u => {
    const dob = new Date(u.birthday);
    return dob.getUTCMonth() === month && dob.getUTCDate() === day;
  });
}

