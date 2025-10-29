// server/src/services/notificationService.js
import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'
import { sendEmail } from './emailService.js'
import { startOfDay } from 'date-fns'

const MX_TZ = 'America/Mexico_City'

// === Helpers de zona MX ===
function startOfDayInMX(date = new Date()) {
  const local = new Date(new Date(date).toLocaleString('en-US', { timeZone: MX_TZ }))
  return startOfDay(local)
}
function dayKeyMX(date = new Date()) {
  // YYYY-MM-DD en zona MX (cero-relleno)
  const y = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, year: 'numeric' })
  const m = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, month: '2-digit' })
  const d = new Date(date).toLocaleString('en-CA', { timeZone: MX_TZ, day: '2-digit' })
  return `${y}-${m}-${d}`
}

/**
 * Envía un correo a TODOS los usuarios con el/los cumpleañeros del día (día MX).
 * Idempotencia por día MX usando AuditLog.
 */
export const sendBirthdayEmailsIfNeeded = async (date, birthdayUsers) => {
  // Normaliza a inicio de día MX e identifica el día con clave MX
  const day = startOfDayInMX(date)
  const dayKey = dayKeyMX(day)

  // Idempotencia (día MX)
  const already = await AuditLog.findOne({
    action: 'BIRTHDAY_DIGEST_SENT',
    'metadata.dayKey': dayKey
  }).lean()
  if (already) return false

  if (!birthdayUsers?.length) return false

  // Destinatarios: todos con email
  const allUsers = await User.find({}, { email: 1, name: 1 }).lean()
  const toList = allUsers.map(u => u.email).filter(Boolean)
  if (!toList.length) {
    console.warn('⚠ No hay destinatarios para el digest de cumpleaños')
    return false
  }

  const names = birthdayUsers.map(u => u.name || u.email).join(', ')
  const subject = '🎂 Cumpleaños de hoy en la empresa'
  const html = `
    <p>Hoy celebramos a: <strong>${names}</strong>.</p>
    <p>¡Envíales tus buenos deseos! 🎉</p>
  `

  await sendEmail({ to: toList, subject, html })

  await AuditLog.create({
    action: 'BIRTHDAY_DIGEST_SENT',
    metadata: {
      dayKey,                // ← clave consistente en MX
      users: birthdayUsers.map(u => ({
        id: u?._id ? String(u._id) : undefined,
        name: u?.name,
        email: u?.email
      }))
    }
  })

  console.log(`📨 Digest de cumpleaños enviado a ${toList.length} cuentas (dayKey=${dayKey})`)
  return true
}
