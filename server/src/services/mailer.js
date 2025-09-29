// server/src/services/mailer.js
import transporter from './transporter.js';

export async function sendVerificationEmail({ to, name, token }) {
  const verifyUrl = `${process.env.FRONT_URL}/auth/verify/${token}`;

  const mail = {
    to,
    from: process.env.MAIL_FROM, // verifica que esté bien configurado
    subject: 'Verifica tu cuenta',
    html: `
      <p>Hola ${name || ''},</p>
      <p>Haz clic para verificar tu correo:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    `,
  };

  // Deja que propague error, pero recuerda que NO se espera en el controlador
  return transporter.sendMail(mail);
}
