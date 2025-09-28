import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  service: 'Gmail', // si no usas Gmail, cambia a host/port/secure
  auth: {
    user: process.env.EMAIL_USER || 'intracorreo7@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'fgyx zfpl qlkc nsmt',
  },
  tls: { rejectUnauthorized: false },
  pool: true,
  maxConnections: 3,
  socketTimeout: 20000,     // IO
  connectionTimeout: 10000, // handshake
});

/** No dejes que un envío bloquee el request */
export async function sendMailSafe(mail, timeoutMs = 10000) {
  const withTimeout = (p, ms) =>
    Promise.race([
      p,
      new Promise((_, r) => setTimeout(() => r(new Error('email-timeout')), ms)),
    ]);
  try {
    await withTimeout(transporter.sendMail(mail), timeoutMs);
  } catch (e) {
    console.error('[email] fallo sendMailSafe:', e?.message || e);
    // no relanzamos para no romper flujo de creación de usuario
  }
}

/** Helper listo para verificación */
export async function sendVerificationEmail({ to, name, link }) {
  const from = process.env.MAIL_FROM || '"intraOdes" <no-reply@intraOdes.com>';
  const mail = {
    to,
    from,
    subject: 'Verifica tu email',
    html: `
      <p>Hola ${name},</p>
      <p>Haz clic en el siguiente enlace para verificar tu correo electrónico:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Si no fuiste tú, ignora este mensaje.</p>
    `,
  };
  await sendMailSafe(mail, 10000);
}
