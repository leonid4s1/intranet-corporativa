// server/src/controllers/authController.js
import User from "../models/User.js";
import VacationData from "../models/VacationData.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";
import { sendVerificationEmail } from "../services/emailService.js";
import bcrypt from "bcryptjs";

dotenv.config();

/** ==========================
 *  Constantes y utilidades
 *  ========================== */
const ACCESS_TTL = "15m";
const REFRESH_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000; // 2 días
const COOKIE_NAME = "refreshToken";

// Helper para leer envs y avisar si faltan
const getEnv = (name) => {
  const v = process.env[name];
  if (!v) console.error(`[AUTH] ENV faltante: ${name}`);
  return v;
};

// en prod (Render) y front en Vercel -> cross-site => SameSite=None + Secure
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "None" : "Lax",
  maxAge: REFRESH_MAX_AGE_MS,
  path: "/api/auth", // limita a rutas de auth
  // domain: isProd ? ".tudominio.com" : undefined,
};

const setRefreshCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, cookieOptions);
};
const clearRefreshCookie = (res) => {
  // limpia cookie en el mismo path que fue seteada
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
};

// helpers
const formatError = (message, param = "") => ({
  errors: [{ msg: message, ...(param && { param }) }],
});

// Normaliza fechas opcionales (si llegan como string "YYYY-MM-DD")
const toUTCDateOrNull = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  isVerified: !!(u.isVerified ?? u.emailVerified),
  emailVerified: !!(u.emailVerified ?? u.isVerified),
  email_verified_at: u.email_verified_at || null,
  // 👇 nuevos campos visibles para el front
  position: u.position ?? null,
  birthDate: u.birthDate ?? null,
  hireDate: u.hireDate ?? null,
  vacationDays: u.vacationDays,
});

/** ==========================
 *  Normalizador de vacationDays (evita used > total)
 *  ========================== */
const normalizeVacForSave = (user) => {
  try {
    if (!user.vacationDays) {
      user.vacationDays = { total: 0, used: 0, adminExtra: 0, lastUpdate: new Date() };
      return;
    }
    const vd = user.vacationDays;
    vd.total = Math.max(0, Math.floor(Number(vd.total ?? 0)));
    vd.used = Math.max(0, Math.floor(Number(vd.used ?? 0)));
    vd.adminExtra = Math.max(0, Math.floor(Number(vd.adminExtra ?? 0)));

    // Regla de esquema: used <= total
    if (vd.used > vd.total) vd.total = vd.used;

    vd.lastUpdate = new Date();
  } catch {
    // no-op: nunca bloqueamos el login por normalización
  }
};

/** ==========================
 * Generación de tokens
 *  - Acepta ACCESS_TOKEN_SECRET o JWT_SECRET para el access token
 *  - Usa REFRESH_TOKEN_SECRET para el refresh token
 * ========================== */
const generateTokens = async (user) => {
  // Si el modelo define métodos propios, úsalos
  if (
    typeof user.generateAuthToken === "function" &&
    typeof user.generateRefreshToken === "function"
  ) {
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;

    normalizeVacForSave(user); // 👈 NUEVO
    await user.save();

    return { accessToken, refreshToken };
  }

  // Fallback: firmar aquí y validar secrets
  const ACCESS_SECRET =
    getEnv("ACCESS_TOKEN_SECRET") || getEnv("JWT_SECRET"); // 👈 acepta ambas
  const REFRESH_SECRET = getEnv("REFRESH_TOKEN_SECRET");

  if (!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error(
      "Configuración JWT faltante: define ACCESS_TOKEN_SECRET (o JWT_SECRET) y REFRESH_TOKEN_SECRET en el servidor."
    );
  }

  const accessToken = jwt.sign({ userId: user._id }, ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });

  const refreshToken = jwt.sign(
    { userId: user._id },
    REFRESH_SECRET,
    { expiresIn: Math.floor(REFRESH_MAX_AGE_MS / 1000) } // ~2 días
  );

  user.refreshToken = refreshToken;

  normalizeVacForSave(user); // 👈 NUEVO
  await user.save();

  return { accessToken, refreshToken };
};

// ============================
// Utilidades de verificación
// ============================
const buildVerificationLink = (token) => {
  const backend = process.env.BACKEND_URL || "http://localhost:5000";
  return `${backend}/api/auth/verify-email/${token}`;
};

/**
 * Helper que pueden usar otros controladores (p.ej. userController.createUser)
 * Genera/guarda un token de verificación y envía el correo.
 * Ideal ejecutarlo en background (setImmediate/queue) por quien lo invoque.
 */
export const sendVerificationForUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    console.warn("[sendVerificationForUser] usuario no encontrado:", userId);
    return;
  }
  if (user.isVerified || user.emailVerified) {
    // nada que hacer
    return;
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  user.emailVerificationToken = verificationToken;
  user.emailVerificationExpires = new Date(Date.now() + 3600 * 1000); // 1h

  normalizeVacForSave(user); // 👈 por consistencia
  await user.save();

  const link = buildVerificationLink(verificationToken);
  await sendVerificationEmail({ to: user.email, name: user.name, link });
};

/** ==========================
 *  Registro (solo admin puede elegir rol; no auto-login si crea admin)
 *  ========================== */
export const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      password_confirmation,
      role: requestedRole, // <- opcional, solo admin puede usarlo
      // 👇 nuevos campos (opcionales)
      position,
      birthDate,
      hireDate,
    } = req.body;

    const missing = [];
    if (!name) missing.push("name");
    if (!email) missing.push("email");
    if (!password) missing.push("password");
    if (!password_confirmation) missing.push("password_confirmation");
    if (missing.length) {
      return res.status(400).json({
        errors: missing.map((f) => ({ msg: `${f} es requerido`, param: f })),
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json(formatError("Formato de email invalido", "email"));
    if (password.length < 8)
      return res
        .status(400)
        .json(formatError("La contraseña debe tener al menos 8 caracteres", "password"));
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/.test(password)) {
      return res.status(400).json(
        formatError(
          "La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial",
          "password"
        )
      );
    }
    if (password !== password_confirmation) {
      return res
        .status(400)
        .json(formatError("Las contraseñas no coinciden", "password_confirmation"));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(409).json(formatError("El usuario ya existe", "email"));

    // Solo un admin autenticado puede elegir rol. Si no, siempre 'user'.
    const isAdminCreator = Boolean(req.user && req.user.role === "admin");
    const safeRole = isAdminCreator && requestedRole ? requestedRole : "user";

    // Normaliza fechas opcionales (si no las sanitizó el validator)
    const birthDateUTC = toUTCDateOrNull(birthDate);
    const hireDateUTC = toUTCDateOrNull(hireDate);

    const user = new User({
      name,
      email,
      password,
      role: safeRole,
      isActive: true,
      isVerified: false,
      emailVerified: false,
      vacationDays: { total: 0, used: 0 },
      // 👇 nuevos campos
      position: position?.trim() || null,
      birthDate: birthDateUTC,
      hireDate: hireDateUTC,
    });

    // token de verificación
    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 3600 * 1000); // 1h

    normalizeVacForSave(user);
    await user.save();

    // crea doc de VacationData (el post-save también lo upsertea; esto es por compat)
    await new VacationData({
      user: user._id,
      total: 0,
      used: 0,
      remaining: 0,
    }).save();

    const verificationLink = buildVerificationLink(verificationToken);
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      link: verificationLink,
    });

    // Si lo crea un admin, NO lo autenticamos aquí
    if (isAdminCreator) {
      return res.status(201).json({
        success: true,
        message: "Usuario creado correctamente por un administrador",
        user: publicUser(user),
        createdBy: "admin",
        requiresEmailVerification: true,
      });
    }

    // (camino legado: auto-registro)
    const { accessToken, refreshToken } = await generateTokens(user);
    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      success: true,
      message: "Registro exitoso",
      user: publicUser(user),
      accessToken,
      token: accessToken,
      refreshToken,
      requiresEmailVerification: true,
    });
  } catch (error) {
    console.error("🔥 Error en registro:", error);
    if (error.name === "ValidationError") {
      const errors = Object.entries(error.errors).map(([field, err]) => ({
        msg: err.message,
        param: field,
      }));
      return res.status(400).json({ errors });
    }
    return res
      .status(500)
      .json({ success: false, message: error?.message || "Error en el servidor" });
  }
};

/** ==========================
 *  Verificación de email
 *  ========================== */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    });

    const front =
      process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173";

    if (!user) {
      return res.redirect(
        `${front}/#/verify-email?success=false&message=Token_invalido`
      );
    }

    user.isVerified = true;
    user.emailVerified = true; // virtual: setea isVerified
    user.email_verified_at = new Date();
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    normalizeVacForSave(user);
    await user.save();

    return res.redirect(`${front}/#/verify-email?success=true`);
  } catch (error) {
    console.error("Error en verifyEmail:", error);
    const front =
      process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173";
    return res.redirect(
      `${front}/#/verify-email?success=false&message=Error_interno`
    );
  }
};

/** ==========================
 *  Reenviar verificación
 *  ========================== */
export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    if (user.isVerified || user.emailVerified)
      return res
        .status(400)
        .json({ success: false, message: "El email ya está verificado" });

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 3600 * 1000);

    normalizeVacForSave(user);
    await user.save();

    const verificationLink = buildVerificationLink(verificationToken);
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      link: verificationLink,
    });

    return res.json({
      success: true,
      message: "Correo de verificación reenviado",
    });
  } catch (error) {
    console.error("Error en resendVerificationEmail:", error);
    return res
      .status(500)
      .json({ success: false, message: error?.message || "Error al reenviar el correo" });
  }
};

/** ==========================
 *  Login (robusto, sin 500)
 *  ========================== */
export const login = async (req, res) => {
  try {
    // 👇 normaliza email y password
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        errors: [
          { msg: "Email es requerido", param: "email" },
          { msg: "Contraseña es requerida", param: "password" },
        ],
      });
    }

    const user = await User.findOne({ email }).select(
      "+password +refreshToken +loginAttempts +lockUntil +isActive +isVerified +emailVerified"
    );

    // Usuario no existe
    if (!user) {
      return res.status(401).json(formatError("Credenciales invalidas"));
    }

    // 🔒 Bloqueo temporal si aplica
    const locked = Boolean(user.lockUntil && user.lockUntil > Date.now());
    if (locked) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
      return res
        .status(403)
        .json(
          formatError(
            `Cuenta bloqueada temporalmente. Intente nuevamente en ${remainingTime} minutos`
          )
        );
    }

    // 🔒 bloquear si está inactivo (antes de comparar contraseña)
    if (!user.isActive) {
      return res
        .status(403)
        .json(formatError("Tu cuenta está inactiva. Contacta al administrador."));
    }

    // Comparación segura de contraseña (con fallback a bcrypt)
    let isMatch = false;
    try {
      if (typeof user.comparePassword === 'function') {
        isMatch = await user.comparePassword(password);
      } else {
        isMatch = await bcrypt.compare(password, user.password || '');
      }
    } catch (cmpErr) {
      console.error('[auth] Error en comparePassword, fallback bcrypt:', cmpErr);
      try {
        isMatch = await bcrypt.compare(password, user.password || '');
      } catch (bErr) {
        console.error('[auth] Fallback bcrypt falló:', bErr);
        isMatch = false;
      }
    }

    if (!isMatch) {
      try {
        if (typeof user.incrementLoginAttempts === "function") {
          await user.incrementLoginAttempts();
        } else {
          user.loginAttempts = (user.loginAttempts || 0) + 1;

          normalizeVacForSave(user); // 👈 NUEVO
          await user.save();
        }
      } catch (incErr) {
        console.warn("[auth] No se pudo incrementar intentos de login:", incErr?.message || incErr);
      }

      const attemptsLeft = Math.max(0, 5 - ((user.loginAttempts ?? 0) + 1));
      return res
        .status(401)
        .json(
          formatError(
            `Credenciales inválidas. ${
              attemptsLeft ? `Intentos restantes: ${attemptsLeft}` : "Cuenta bloqueada"
            }`
          )
        );
    }

    // Reset de intentos si procede
    try {
      if (typeof user.resetLoginAttempts === "function") {
        await user.resetLoginAttempts();
      } else {
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        user.lastLogin = new Date();

        normalizeVacForSave(user); // 👈 NUEVO
        await user.save();
      }
    } catch (rstErr) {
      console.warn("[auth] No se pudo resetear intentos:", rstErr?.message || rstErr);
    }

    // Generar tokens y setear cookie refresh
    const { accessToken, refreshToken } = await generateTokens(user);
    setRefreshCookie(res, refreshToken);

    return res.json({
      success: true,
      message: "Inicio de sesión exitoso",
      user: publicUser(user),
      // compat con front
      accessToken,
      token: accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("[auth] Error inesperado en login:", error);
    // No exponemos detalles; el front siempre recibe un { message }
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

/** ==========================
 *  Logout
 *  ========================== */
export const logout = async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      const user = await User.findOne({ refreshToken: token });
      if (user) {
        user.refreshToken = null;

        normalizeVacForSave(user); // 👈 NUEVO
        await user.save();
      }
    }
    clearRefreshCookie(res);
    return res.json({ success: true, message: "Sesión cerrada exitosamente" });
  } catch (error) {
    console.error("Error en logout:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al cerrar sesión" });
  }
};

/** ==========================
 *  Refresh
 *  ========================== */
export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: "Refresh token no proporcionado" });

    const REFRESH_SECRET = getEnv("REFRESH_TOKEN_SECRET");
    if (!REFRESH_SECRET) {
      return res.status(500).json({ message: "Configuración JWT faltante (REFRESH_TOKEN_SECRET)" });
    }

    let payload;
    try {
      payload = jwt.verify(token, REFRESH_SECRET);
    } catch {
      return res.status(403).json({ message: "Token inválido o expirado" });
    }

    const user = await User.findById(payload.userId);
    if (!user || user.refreshToken !== token) {
      return res.status(403).json({ message: "Token inválido" });
    }

    // 🔒 NUEVO: no refrescar si está inactivo
    if (!user.isActive) {
      return res.status(403).json({ message: "Cuenta inactiva" });
    }

    // Rotación simple
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateTokens(user);

    user.refreshToken = newRefreshToken;

    normalizeVacForSave(user); // 👈 NUEVO
    await user.save();

    setRefreshCookie(res, newRefreshToken);

    // Compat exacta con AuthService.refreshToken()
    return res.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      message: "Token actualizado correctamente",
      user: publicUser(user), // útil para rehidratar el store en frío
    });
  } catch (error) {
    console.error("Error en refreshToken:", error);
    return res.status(403).json({ message: error?.message || "Token inválido o expirado" });
  }
};

/** ==========================
 *  Perfil
 *  ========================== */
export const getProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.error("Error obteniendo perfil:", error);
    res.status(500).json({ success: false, message: "Error al obtener perfil" });
  }
};

/**
 * ==========================
 *  Cambiar contraseña (autenticado)
 *  Body: { currentPassword, newPassword }
 * ==========================
 */
export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { currentPassword = "", newPassword = "" } = req.body || {};

    // Validaciones básicas de presencia
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        errors: [
          { msg: "Contraseña actual requerida", param: "currentPassword" },
          { msg: "Nueva contraseña requerida", param: "newPassword" },
        ],
      });
    }

    // Mismas reglas que register()
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json(formatError("La nueva contraseña debe tener al menos 8 caracteres", "newPassword"));
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/.test(newPassword)) {
      return res.status(400).json(
        formatError(
          "La nueva contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial",
          "newPassword"
        )
      );
    }

    // Cargar usuario con password
    const user = await User.findById(userId).select("+password");
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // Verificar actual
    let isMatch = false;
    try {
      if (typeof user.comparePassword === "function") {
        isMatch = await user.comparePassword(currentPassword);
      } else {
        isMatch = await bcrypt.compare(currentPassword, user.password || "");
      }
    } catch (err) {
      console.error("[changePassword] compare error:", err);
      isMatch = false;
    }
    if (!isMatch) {
      return res.status(401).json(formatError("La contraseña actual no es correcta", "currentPassword"));
    }

    // Evitar que la nueva sea igual a la actual
    const sameAsOld = await bcrypt.compare(newPassword, user.password || "");
    if (sameAsOld) {
      return res
        .status(400)
        .json(formatError("La nueva contraseña no puede ser igual a la anterior", "newPassword"));
    }

    // Guardar nueva contraseña SIN hashear aquí.
    
    // Deja que el pre-save del modelo (o setPassword) haga el hash.
    if (typeof user.setPassword === 'function') {
      await user.setPassword(newPassword);
    } else {
      user.password = newPassword;           // ← texto plano, el hook lo hashea
    }


    // (Opcional) invalidar refresh token actual
    user.refreshToken = null;

    normalizeVacForSave(user); // mantener consistencia con el resto del controlador
    await user.save();

    // Limpia cookie refresh si existe (para obligar re-login/refresh)
    try { clearRefreshCookie(res); } catch (_) {}

    return res.json({ ok: true, message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("[changePassword] Error:", error);
    return res.status(500).json({ error: "No se pudo actualizar la contraseña" });
  }
};
