// server/src/services/emailService.js
import nodemailer from 'nodemailer';

const {
  EMAIL_USER,
  EMAIL_PASSWORD,
  MAIL_FROM,
  SMTP_HOST = 'smtp.gmail.com',
  SMTP_PORT = '465',
  SMTP_SECURE = 'true',
} = process.env;

if (!EMAIL_USER || !EMAIL_PASSWORD) {
  console.warn('[email] Falta EMAIL_USER o EMAIL_PASSWORD');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: String(SMTP_SECURE) === 'true', // true => 465
  auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  connectionTimeout: 30000, // 30s
  greetingTimeout: 30000,   // 30s
  socketTimeout: 45000,     // 45s
});

// verificación opcional en arranque (la llamamos desde index.js)
export async function verifyEmailTransport() {
  try {
    await transporter.verify();
    console.log('[email] SMTP listo');
  } catch (e) {
    console.error('[email] SMTP verify falló:', e?.message || e);
  }
}

/** NO romper el flujo HTTP, pero subir timeout a 45s */
export async function sendMailSafe(mail, timeoutMs = 45000) {
  const withTimeout = (p, ms) =>
    Promise.race([
      p,
      new Promise((_, r) => setTimeout(() => r(new Error('email-timeout')), ms)),
    ]);
  try {
    const info = await withTimeout(transporter.sendMail(mail), timeoutMs);
    if (info?.messageId) console.log('[email] enviado:', info.messageId);
  } catch (e) {
    console.error('[email] fallo sendMailSafe:', e?.message || e);
    // no relanzamos
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
