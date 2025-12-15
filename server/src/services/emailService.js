// server/src/services/emailService.js
import nodemailer from "nodemailer";

const {
  SMTP_HOST = "smtp.gmail.com",
  SMTP_PORT = "587",          // recomendado Gmail
  SMTP_USER,
  SMTP_PASS,                 // App Password (16 chars)
  MAIL_FROM,
} = process.env;

function createTransport() {
  const port = Number(SMTP_PORT || 587);

  // Gmail recomendado: 587 con STARTTLS
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: false,      // 587 => false
    requireTLS: true,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    // timeouts para que no se quede colgado
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 45000,
  });
}

async function sendWithTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("email-timeout")), ms)
    ),
  ]);
}

// ────────────────────────────────────────────────────────────────────────────────
/** Llamada en el arranque: valida SMTP y loguea estado */
export async function verifyEmailTransport() {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      console.error("[email] faltan SMTP_USER/SMTP_PASS en variables de entorno");
      return false;
    }
    const tx = createTransport();
    await tx.verify();
    console.log(`[email] SMTP listo (Gmail ${SMTP_HOST}:${SMTP_PORT})`);
    return true;
  } catch (e) {
    console.error("[email] SMTP verify falló:", e?.message || e);
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
/**
 * Envía correo sin romper el flujo HTTP.
 * Regresa un objeto {ok, messageId?, error?} para que puedas contar éxitos reales.
 */
export async function sendMailSafe(mail, timeoutMs = 45000) {
  const from = mail.from || MAIL_FROM || SMTP_USER;

  if (!SMTP_USER || !SMTP_PASS) {
    const msg = "SMTP_USER/SMTP_PASS no configurados";
    console.error("[email] " + msg);
    return { ok: false, error: msg };
  }

  try {
    const tx = createTransport();
    const info = await sendWithTimeout(tx.sendMail({ ...mail, from }), timeoutMs);
    console.log("[email] enviado (SMTP Gmail):", info?.messageId || "sin-id");
    return { ok: true, messageId: info?.messageId || null };
  } catch (e) {
    console.error("[email] SMTP fallo:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

// ────────────────────────────────────────────────────────────────────────────────
export async function sendVerificationEmail({ to, name, link }) {
  const from = MAIL_FROM || SMTP_USER;
  const html = `
    <p>Hola ${name ?? ""},</p>
    <p>Haz clic para verificar tu correo:</p>
    <p><a href="${link}">${link}</a></p>
    <p style="color:#718096;font-size:12px">Si no fuiste tú, ignora este mensaje.</p>
  `;
  return sendMailSafe({ to, from, subject: "Verifica tu email", html });
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers de formateo locales (MX)
const fmtMX = (date) =>
  new Date(date).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });

/**
 * Envía correo: Vacaciones APROBADAS
 * @param {{to:string, name?:string, startDate:Date|string, endDate:Date|string, approverName?:string}} p
 */
export async function sendVacationApprovedEmail(p) {
  const { to, name, startDate, endDate, approverName } = p;
  const subject = "✅ Vacaciones aprobadas";
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial">
      <h2 style="margin:0 0 8px">✅ Vacaciones aprobadas</h2>
      <p>Hola <strong>${name ?? ""}</strong>,</p>
      <p>Tu solicitud de vacaciones ha sido <strong>APROBADA</strong>.</p>
      <p><strong>Fechas aprobadas:</strong><br>
        ${fmtMX(startDate)} — ${fmtMX(endDate)}
      </p>
      <p>Aprobado por: <strong>${approverName || "Recursos Humanos"}</strong></p>
      <p>¡Disfruta tus vacaciones!</p>
    </div>
  `;
  const text = `Hola ${name ?? ""},
Tu solicitud de vacaciones ha sido APROBADA.

Fechas aprobadas:
${fmtMX(startDate)} — ${fmtMX(endDate)}

Aprobado por: ${approverName || "Recursos Humanos"}`;

  return sendMailSafe({ to, subject, html, text });
}

/**
 * Envía correo: Vacaciones RECHAZADAS
 * @param {{to:string, name?:string, startDate:Date|string, endDate:Date|string, reason?:string, approverName?:string}} p
 */
export async function sendVacationRejectedEmail(p) {
  const { to, name, startDate, endDate, reason, approverName } = p;
  const subject = "❌ Vacaciones rechazadas";
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial">
      <h2 style="margin:0 0 8px">❌ Vacaciones rechazadas</h2>
      <p>Hola <strong>${name ?? ""}</strong>,</p>
      <p>Tu solicitud de vacaciones ha sido <strong>RECHAZADA</strong>.</p>
      <p><strong>Fechas no aprobadas:</strong><br>
        ${fmtMX(startDate)} — ${fmtMX(endDate)}
      </p>
      <p><strong>Motivo:</strong> ${reason || "No especificado"}</p>
      <p>Revisado por: <strong>${approverName || "Recursos Humanos"}</strong></p>
    </div>
  `;
  const text = `Hola ${name ?? ""},
Tu solicitud de vacaciones ha sido RECHAZADA.

Fechas no aprobadas:
${fmtMX(startDate)} — ${fmtMX(endDate)}

Motivo: ${reason || "No especificado"}
Revisado por: ${approverName || "Recursos Humanos"}`;

  return sendMailSafe({ to, subject, html, text });
}

// ────────────────────────────────────────────────────────────────────────────────
// Alias para compatibilidad con notificationService
export const sendEmail = async (options) => {
  return sendMailSafe(options);
};
