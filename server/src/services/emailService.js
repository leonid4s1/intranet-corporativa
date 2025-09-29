// server/src/services/emailService.js
import nodemailer from 'nodemailer';

const {
  EMAIL_USER,
  EMAIL_PASSWORD,       // App Password de Gmail (SIN espacios)
  MAIL_FROM,
  SMTP_HOST = 'smtp.gmail.com',
} = process.env;

if (!EMAIL_USER || !EMAIL_PASSWORD) {
  console.warn('[email] Falta EMAIL_USER o EMAIL_PASSWORD en env');
}

// Transport TLS 465
const tx465 = nodemailer.createTransport({
  host: SMTP_HOST,
  port: 465,
  secure: true,
  auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 45000,
});

// Transport STARTTLS 587
const tx587 = nodemailer.createTransport({
  host: SMTP_HOST,
  port: 587,
  secure: false,
  requireTLS: true,
  auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 45000,
});

async function tryVerify(t, tag) {
  await t.verify();
  console.log(`[email] SMTP listo (${tag})`);
}

export async function verifyEmailTransport() {
  try {
    await tryVerify(tx465, '465');
    return true;
  } catch (e1) {
    console.error('[email] verify 465 falló:', e1?.message || e1);
    try {
      await tryVerify(tx587, '587');
      return true;
    } catch (e2) {
      console.error('[email] verify 587 falló:', e2?.message || e2);
      return false;
    }
  }
}

async function sendWith(t, mail, tag, timeoutMs) {
  const withTimeout = (p, ms) =>
    Promise.race([
      p,
      new Promise((_, r) => setTimeout(() => r(new Error('email-timeout')), ms)),
    ]);
  const info = await withTimeout(t.sendMail(mail), timeoutMs);
  console.log(`[email] enviado (${tag}):`, info?.messageId || 'sin-id');
}

export async function sendMailSafe(mail, timeoutMs = 45000) {
  try {
    await sendWith(tx465, mail, '465', timeoutMs);
  } catch (e1) {
    console.error('[email] 465 fallo:', e1?.message || e1);
    try {
      await sendWith(tx587, mail, '587', timeoutMs);
    } catch (e2) {
      console.error('[email] 587 fallo:', e2?.message || e2);
      // No relanzamos: no debe romper el flujo HTTP
    }
  }
}

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
