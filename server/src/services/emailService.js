// server/src/services/emailService.js
import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';            // ← API HTTP (recomendada)
import { Resend } from 'resend';                // ← opcional: otro API HTTP

const {
  // API keys (usa al menos una)
  SENDGRID_API_KEY,
  RESEND_API_KEY,

  // SMTP (fallback)
  EMAIL_USER,
  EMAIL_PASSWORD,
  MAIL_FROM,
  SMTP_HOST = 'smtp.gmail.com',
} = process.env;

// ────────────────────────────────────────────────────────────────────────────────
// Transports SMTP (solo fallback, Render los bloquea actualmente)
const tx465 = nodemailer.createTransport({
  host: SMTP_HOST, port: 465, secure: true,
  auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
  pool: true, maxConnections: 3, maxMessages: 50,
  connectionTimeout: 30000, greetingTimeout: 30000, socketTimeout: 45000,
});

const tx587 = nodemailer.createTransport({
  host: SMTP_HOST, port: 587, secure: false, requireTLS: true,
  auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
  pool: true, maxConnections: 3, maxMessages: 50,
  connectionTimeout: 30000, greetingTimeout: 30000, socketTimeout: 45000,
});

async function sendWithTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('email-timeout')), ms)),
  ]);
}

// ────────────────────────────────────────────────────────────────────────────────
/** Llamada en el arranque: loguea qué proveedor usaremos */
export async function verifyEmailTransport() {
  try {
    if (SENDGRID_API_KEY) {
      sgMail.setApiKey(SENDGRID_API_KEY);
      console.log('[email] SendGrid listo (API)');
      return true;
    }
    if (RESEND_API_KEY) {
      // No hay verify explícito; si hay key asumimos OK
      console.log('[email] Resend listo (API)');
      return true;
    }
    // Fallback SMTP (no recomendado en Render, normalmente bloqueado)
    try {
      await tx465.verify(); console.log('[email] SMTP listo (465)'); return true;
    } catch (e1) {
      console.error('[email] verify 465 falló:', e1?.message || e1);
      await tx587.verify(); console.log('[email] SMTP listo (587)'); return true;
    }
  } catch (e2) {
    console.error('[email] verify 587 falló:', e2?.message || e2);
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
/** Envía correo sin romper el flujo HTTP; prioriza API HTTP, luego SMTP. */
export async function sendMailSafe(mail, timeoutMs = 45000) {
  const from = mail.from || MAIL_FROM || EMAIL_USER;

  // 1) SendGrid (recomendado)
  if (SENDGRID_API_KEY) {
    try {
      sgMail.setApiKey(SENDGRID_API_KEY);
      const msg = {
        to: mail.to,
        from,                                  // Debe estar verificado en SendGrid (Single Sender o dominio)
        subject: mail.subject,
        // si llega html usamos html; si no, text
        html: mail.html,
        text: mail.text || undefined,
      };
      await sendWithTimeout(sgMail.send(msg), timeoutMs);
      console.log('[email] enviado (SendGrid)');
      return;
    } catch (e) {
      console.error('[email] SendGrid fallo:', e?.message || e);
      // seguimos a otros providers
    }
  }

  // 2) Resend (opcional)
  if (RESEND_API_KEY) {
    try {
      const resend = new Resend(RESEND_API_KEY);
      await sendWithTimeout(
        resend.emails.send({
          from,                                 // Requiere dominio verificado en Resend
          to: Array.isArray(mail.to) ? mail.to : [mail.to],
          subject: mail.subject,
          html: mail.html,
          text: mail.text || undefined,
        }),
        timeoutMs
      );
      console.log('[email] enviado (Resend)');
      return;
    } catch (e) {
      console.error('[email] Resend fallo:', e?.message || e);
      // seguimos a SMTP
    }
  }

  // 3) Fallback SMTP (probablemente bloqueado en Render)
  try {
    const info = await sendWithTimeout(tx465.sendMail({ ...mail, from }), timeoutMs);
    console.log('[email] enviado (SMTP 465):', info?.messageId || 'sin-id');
    return;
  } catch (e1) {
    console.error('[email] 465 fallo:', e1?.message || e1);
    try {
      const info = await sendWithTimeout(tx587.sendMail({ ...mail, from }), timeoutMs);
      console.log('[email] enviado (SMTP 587):', info?.messageId || 'sin-id');
    } catch (e2) {
      console.error('[email] 587 fallo:', e2?.message || e2);
      // NO relanzamos: no debe romper el flujo HTTP
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────────
export async function sendVerificationEmail({ to, name, link }) {
  const from = MAIL_FROM || EMAIL_USER;
  const html = `
    <p>Hola ${name ?? ''},</p>
    <p>Haz clic para verificar tu correo:</p>
    <p><a href="${link}">${link}</a></p>
    <p style="color:#718096;font-size:12px">Si no fuiste tú, ignora este mensaje.</p>
  `;
  await sendMailSafe({ to, from, subject: 'Verifica tu email', html });
}
