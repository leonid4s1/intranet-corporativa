// src/services/notificationService.js
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import { sendEmail } from "./emailService.js";

/**
 * Notifica a los administradores sobre una nueva solicitud de vacaciones.
 * @param {Object} vacationRequest - Solicitud de vacaciones creada.
 * @param {Object} user - Usuario que realizó la solicitud.
 */
export const notifyAdminsAboutNewRequest = async (vacationRequest, user) => {
  const admins = await User.find({ role: "admin" }).select("email name");

  if (!admins.length) {
    console.warn("⚠ No hay administradores para notificar");
    return;
  }

  // 1. Enviar emails (asíncrono)
  const emailPromises = admins.map((admin) => {
    const emailContent = `
      <h2>📅 Nueva solicitud de vacaciones</h2>
      <p><strong>Empleado:</strong> ${user.name}</p>
      <p><strong>Período:</strong> ${vacationRequest.startDate} - ${vacationRequest.endDate}</p>
      <p><strong>Días:</strong> ${vacationRequest.daysRequested}</p>
      <p><a href="${process.env.FRONTEND_URL}/admin/vacations">Revisar solicitud</a></p>
    `;

    return sendEmail({
      to: admin.email,
      subject: "🆕 Nueva solicitud de vacaciones pendiente",
      html: emailContent,
    });
  });

  // 2. Registrar en AuditLog (importante para trazabilidad)
  await AuditLog.create({
    action: "VACATION_REQUEST_CREATED",
    entityId: vacationRequest._id,
    userId: user._id,
    metadata: {
      daysRequested: vacationRequest.daysRequested,
      status: "pending",
    },
  });

  // 3. Ejecutar en paralelo
  await Promise.all(emailPromises);
  console.log(`📬 Notificaciones enviadas a ${admins.length} administradores`);
};