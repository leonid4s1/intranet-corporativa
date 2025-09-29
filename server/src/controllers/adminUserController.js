// server/src/controllers/adminUserController.js
import { createUserService } from '../services/userService.js';
import { createEmailVerificationToken } from '../services/tokenService.js';
import { sendVerificationEmail } from '../services/mailer.js';

export async function createUserAsAdmin(req, res) {
  try {
    const { name, email, password, role } = req.body;

    const user = await createUserService({ name, email, password, role });

    const token = await createEmailVerificationToken(user._id);

    // 👇 Responder YA (no esperes el mail)
    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vacationTotals: user.vacationTotals ?? 0,
        vacationUsed: user.vacationUsed ?? 0,
      },
      verificationEmail: 'queued',
    });

    // 👇 Enviar el email en background (no bloquea la respuesta)
    // Maneja errores aquí (log/alerta), pero NO vuelvas a tocar la respuesta.
    Promise.resolve()
      .then(() =>
        sendVerificationEmail({
          to: user.email,
          name: user.name,
          token, // enlace será algo como `${FRONT_URL}/auth/verify/${token}`
        })
      )
      .catch((err) => {
        console.error('[mailer] Error enviando verificación', err);
      });
  } catch (err) {
    console.error('[createUserAsAdmin] ERROR', err);
    res.status(400).json({ message: err?.message || 'No se pudo crear el usuario' });
  }
}
