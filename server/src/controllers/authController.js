// controllers/authController.js
import User from "../models/User.js";
import VacationData from "../models/VacationData.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";
import nodemailer from "nodemailer";

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
  // domain: isProd ? ".odesconstruction.com" : undefined,
};

const setRefreshCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, cookieOptions);
};
const clearRefreshCookie = (res) => {
  // limpia cookie en el mismo path que fue seteada
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
};

/* ==========================
 *  Email (Nodemailer)
 * ========================== */
const transporter = nodemailer.createTransport({
  service: "Gmail",
  pool: true,
  maxConnections: 1,
  maxMessages: 100,
  auth: {
    user: process.env.EMAIL_USER || "intracorreo7@gmail.com",
    pass: process.env.EMAIL_PASSWORD || "fgyx zfpl qlkc nsmt", // App Password
  },
  tls: { rejectUnauthorized: false },
});

// From recomendado (coincidir dominio/cuenta del proveedor)
const MAIL_FROM =
  process.env.MAIL_FROM ||
  `intraOdes <${process.env.EMAIL_USER || "intracorreo7@gmail.com"}>`;

/* ==========================
 *  Helpers
 * ========================== */
const formatError = (message, param = "") => ({
  errors: [{ msg: message, ...(param && { param }) }],
});

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  isVerified: !!(u.isVerified ?? u.emailVerified),
  emailVerified: !!(u.emailVerified ?? u.isVerified),
  email_verified_at: u.email_verified_at || null,
  vacationDays: u.vacationDays,
});

// Generación de tokens con validación de secrets
const generateTokens = async (user) => {
  // Si el modelo define métodos propios, úsalos
  if (
    typeof user.generateAuthToken === "function" &&
    typeof user.generateRefreshToken === "function"
  ) {
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save();
    return { accessToken, refreshToken };
  }

  // Fallback: firmar aquí y validar secrets
  const JWT_SECRET = getEnv("JWT_SECRET");
  const REFRESH_SECRET = getEnv("REFRESH_TOKEN_SECRET");
  if (!JWT_SECRET || !REFRESH_SECRET) {
    throw new Error(
      "Configuración JWT faltante: define JWT_SECRET y REFRESH_TOKEN_SECRET en el servidor."
    );
  }

  const accessToken = jwt.sign({ userId: user._id }, JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  });
  const refreshToken = jwt.sign({ userId: user._id }, REFRESH_SECRET, {
    expiresIn: Math.floor(REFRESH_MAX_AGE_MS / 1000),
  });

  user.refreshToken = refreshToken;
  await user.save();
  return { accessToken, refreshToken };
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
      role: requestedRole, // opcional, solo admin puede usarlo
    } = req.body;

    // -------- Validaciones básicas --------
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!email) missingFields.push("email");
    if (!password) missingFields.push("password");
    if (!password_confirmation) missingFields.push("password_confirmation");
    if (missingFields.length) {
      return res.status(400).json({
        errors: missingFields.map((f) => ({ msg: `${f} es requerido`, param: f })),
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail))
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

    // -------- Duplicado (case-insensitive) --------
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser)
      return res.status(409).json(formatError("El usuario ya existe", "email"));

    // -------- Rol seguro --------
    const isAdminCreator = Boolean(req.user && req.user.role === "admin");
    const safeRole = isAdminCreator && requestedRole ? requestedRole : "user";

    // -------- Crear usuario --------
    const user = new User({
      name,
      email: normalizedEmail,
      password,
      role: safeRole,
      isActive: true,
      isVerified: false,
      emailVerified: false,
      vacationDays: { total: 0, used: 0 },
    });

    // token de verificación
    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 3600 * 1000); // 1h
    await user.save();

    // crea doc de VacationData
    await new VacationData({
      user: user._id,
      total: 0,
      used: 0,
      remaining: 0,
    }).save();

    const backend = process.env.BACKEND_URL || "http://localhost:5000";
    const verificationLink = `${backend}/api/auth/verify-email/${verificationToken}`;

    // -------- RESPONDER PRIMERO (no bloquear por SMTP) --------
    if (isAdminCreator) {
      res.status(201).json({
        success: true,
        message: "Usuario creado correctamente por un administrador",
        user: publicUser(user),
        createdBy: "admin",
        requiresEmailVerification: true,
        emailQueued: true,
      });
    } else {
      // (camino auto-registro legado)
      const { accessToken, refreshToken } = await generateTokens(user);
      setRefreshCookie(res, refreshToken);

      res.status(201).json({
        success: true,
        message: "Registro exitoso",
        user: publicUser(user),
        accessToken,
        token: accessToken,
        refreshToken,
        requiresEmailVerification: true,
        emailQueued: true,
      });
    }

    // -------- Enviar correo en background (sin await) --------
    transporter
      .sendMail({
        to: user.email,
        from: MAIL_FROM,
        subject: "Verifica tu email",
        html: `<p>Hola ${user.name},</p>
               <p>Haz click en este enlace para verificar tu correo electrónico:</p>
               <p><a href="${verificationLink}">${verificationLink}</a></p>`,
      })
      .then(() => {
        console.log("[mail] Verificación enviada a", user.email);
      })
      .catch((mailErr) => {
        console.error("[mail] Error enviando verificación:", mailErr?.message || mailErr);
        // opcional: persistir un flag o auditlog para reintentar
      });
  } catch (error) {
    console.error("🔥 Error en registro:", error);
    if (error?.code === 11000) {
      return res.status(409).json(formatError("El usuario ya existe", "email"));
    }
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
    user.emailVerified = true;
    user.email_verified_at = new Date();
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
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
    const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
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
    await user.save();

    const backend = process.env.BACKEND_URL || "http://localhost:5000";
    const verificationLink = `${backend}/api/auth/verify-email/${verificationToken}`;

    await transporter.sendMail({
      to: user.email,
      from: MAIL_FROM,
      subject: "Verifica tu email",
      html: `<p>Hola ${user.name},</p>
             <p>Haz click en este enlace para verificar tu correo electrónico:</p>
             <p><a href="${verificationLink}">${verificationLink}</a></p>`,
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
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        errors: [
          { msg: "Email es requerido", param: "email" },
          { msg: "Contraseña es requerida", param: "password" },
        ],
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select(
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

    // 🔒 Bloquear si está inactivo (antes de comparar contraseña)
    if (!user.isActive) {
      return res
        .status(403)
        .json(formatError("Tu cuenta está inactiva. Contacta al administrador."));
    }

    // Comparación segura de contraseña
    let isMatch = false;
    try {
      if (typeof user.comparePassword === "function") {
        isMatch = await user.comparePassword(password);
      } else {
        console.warn("[auth] comparePassword no definido en User; tratando como invalido");
        isMatch = false;
      }
    } catch (cmpErr) {
      console.error("[auth] Error en comparePassword:", cmpErr);
      isMatch = false;
    }

    if (!isMatch) {
      try {
        if (typeof user.incrementLoginAttempts === "function") {
          await user.incrementLoginAttempts();
        } else {
          user.loginAttempts = (user.loginAttempts || 0) + 1;
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

    // 🔒 no refrescar si está inactivo
    if (!user.isActive) {
      return res.status(403).json({ message: "Cuenta inactiva" });
    }

    // Rotación simple
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateTokens(user);

    user.refreshToken = newRefreshToken;
    await user.save();
    setRefreshCookie(res, newRefreshToken);

    return res.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      message: "Token actualizado correctamente",
      user: publicUser(user),
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
