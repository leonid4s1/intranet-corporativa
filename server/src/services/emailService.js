// server/src/services/emailService.js
import nodemailer from 'nodemailer';

const {
  // Para Gmail con App Password
  EMAIL_USER,
  EMAIL_PASSWORD,
  MAIL_FROM,
  // Por si algún día cambias a otro SMTP
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
} = process.env;

/**
 * Transport recomendado:
 * - Si defines SMTP_* se usa host/port/secure.
 * - Si NO defines SMTP_* se usa Gmail directo.
 */
const transporter = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 465),
      secure: String(SMTP_SECURE ?? 'true') === 'true',
      auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
      pool: true,
      maxConnections: 3,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 30_000,
    })
  : nodemailer.createTransport({
      service: 'Gmail',
      auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD }, // App Password
      tls: { rejectUnauthorized: false },
      pool: true,
      maxConnections: 3,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 30_000,
    });

/**
 * Envía sin bloquear el request: registra el error pero NO lo propaga.
 */
export async function sendMailSafe(mail, timeoutMs = 15_000) {
  const withTimeout = (p, ms) =>
    Promise.race([
      p,
      new Promise((_, r) => setTimeout(() => r(new Error('email-timeout')), ms)),
    ]);

  try {
    const info = await withTimeout(transporter.sendMail(mail), timeoutMs);
    if (info?.messageId) {
      console.log('[email] enviado:', info.messageId);
    }
  } catch (e) {
    console.error('[email] fallo sendMailSafe:', e?.message || e);
    // NO relanzamos para no romper el flujo HTTP
  }
}

/**
 * Verificación de email
 * @param {{to:string, name?:string, link:string}}
 */
export async function sendVerificationEmail({ to, name, link }) {
  const from = MAIL_FROM || (EMAIL_USER ? `"Intranet Odes" <${EMAIL_USER}>` : 'no-reply@odes');
  const html = `
    <p>Hola ${name ?? ''},</p>
    <p>Haz clic para verificar tu correo electrónico:</p>
    <p><a href="${link}">${link}</a></p>
    <p style="color:#718096;font-size:12px">Si no fuiste tú, ignora este mensaje.</p>
  `;
  await sendMailSafe({ to, from, subject: 'Verifica tu email', html }, 15_000);
}
