// server/src/services/notificationService.js
import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'
import { sendEmail } from './emailService.js'
import { startOfDay } from 'date-fns'

/**
 * Notifica a los administradores sobre una nueva solicitud de vacaciones.
 * @param {Object} vacationRequest - Solicitud de vacaciones creada.
 * @param {Object} user - Usuario que realizó la solicitud.
 */
export const notifyAdminsAboutNewRequest = async (vacationRequest, user) => {
  const admins = await User.find({ role: 'admin' }).select('email name')

  if (!admins.length) {
    console.warn('⚠ No hay administradores para notificar')
    return
  }

  // 1) Enviar emails
  const emailPromises = admins.map((admin) => {
    const emailContent = `
      <h2>📅 Nueva solicitud de vacaciones</h2>
      <p><strong>Empleado:</strong> ${user.name}</p>
      <p><strong>Período:</strong> ${vacationRequest.startDate} - ${vacationRequest.endDate}</p>
      <p><strong>Días:</strong> ${vacationRequest.daysRequested}</p>
      <p><a href="${process.env.FRONTEND_URL}/admin/vacations">Revisar solicitud</a></p>
    `

    return sendEmail({
      to: admin.email,
      subject: '🆕 Nueva solicitud de vacaciones pendiente',
      html: emailContent
    })
  })

  // 2) Registrar en AuditLog
  await AuditLog.create({
    action: 'VACATION_REQUEST_CREATED',
    entityId: vacationRequest._id,
    userId: user._id,
    metadata: {
      daysRequested: vacationRequest.daysRequested,
      status: 'pending'
    }
  })

  // 3) Ejecutar en paralelo
  await Promise.all(emailPromises)
  console.log(`📬 Notificaciones enviadas a ${admins.length} administradores`)
}

/**
 * Envía un correo a TODOS los usuarios con el/los cumpleañeros del día.
 * - Se garantiza idempotencia diaria usando AuditLog.
 * - No envía nada si no hay destinatarios o no hay cumpleañeros.
 * @param {Date} date - Fecha base (normalmente hoy).
 * @param {Array<{name?: string, email?: string, _id?: any}>} birthdayUsers - Cumpleañeros del día.
 * @returns {Promise<boolean>} true si envió, false si se omitió por idempotencia o sin destinatarios.
 */
export const sendBirthdayEmailsIfNeeded = async (date, birthdayUsers) => {
  const day = startOfDay(new Date(date))
  const dayKey = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`

  // Idempotencia: ¿ya se envió hoy?
  const already = await AuditLog.findOne({
    action: 'BIRTHDAY_DIGEST_SENT',
    'metadata.dayKey': dayKey
  }).lean()

  if (already) {
    return false
  }

  // Si no hay cumpleañeros, no enviamos
  if (!birthdayUsers?.length) {
    return false
  }

  // Lista de destinatarios (todos los usuarios con email)
  const allUsers = await User.find({}, { email: 1, name: 1 }).lean()
  const toList = allUsers.map((u) => u.email).filter(Boolean)

  if (!toList.length) {
    console.warn('⚠ No hay destinatarios para el digest de cumpleaños')
    return false
  }

  const names = birthdayUsers.map((u) => u.name || u.email).join(', ')
  const subject = '🎂 Cumpleaños de hoy en la empresa'
  const html = `
    <p>Hoy celebramos a: <strong>${names}</strong>.</p>
    <p>¡Envíales tus buenos deseos! 🎉</p>
  `

  await sendEmail({
    to: toList,
    subject,
    html
  })

  // Registrar envío para no duplicar en el mismo día
  await AuditLog.create({
    action: 'BIRTHDAY_DIGEST_SENT',
    metadata: {
      dayKey,
      users: birthdayUsers.map((u) => ({
        id: u?._id ? String(u._id) : undefined,
        name: u?.name,
        email: u?.email
      }))
    }
  })

  console.log(`📨 Digest de cumpleaños enviado a ${toList.length} cuentas (dayKey=${dayKey})`)
  return true
}