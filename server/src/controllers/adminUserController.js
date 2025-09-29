// server/src/controllers/adminUserController.js
import { sendVerificationEmail } from '../services/emailService.js';
import { createUserService } from '../services/userService.js';              // tu servicio actual
import { createEmailVerificationToken } from '../services/tokenService.js';  // tu generador de token

export async function createUserAsAdmin(req, res) {
  try {
    const { name, email, password, role } = req.body;

    // 1) Crear usuario
    const user = await createUserService({ name, email, password, role });

    // 2) Generar token de verificación y armar link con FRONTEND_URL
    const token = await createEmailVerificationToken(user._id);
    const base =
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      'http://localhost:5173';
    const link = `${String(base).replace(/\/$/, '')}/auth/verify/${token}`;

    // 3) Responder de inmediato
    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        email_verified_at: user.email_verified_at ?? null,
        vacationDays: user.vacationDays ?? { total: 0, used: 0 },
      },
      requiresEmailVerification: true,
      verificationEmail: 'queued',
    });

    // 4) Enviar el correo en background (no bloquea)
    Promise.resolve()
      .then(() =>
        sendVerificationEmail({
          to: user.email,
          name: user.name,
          link,
        })
      )
      .catch((err) => {
        console.error('[createUserAsAdmin] Falló el envío del correo:', err);
      });
  } catch (err) {
    console.error('[createUserAsAdmin] ERROR', err);
    res.status(400).json({
      success: false,
      message: err?.message || 'No se pudo crear el usuario',
    });
  }
}
