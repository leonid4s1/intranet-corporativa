// controllers/authController.js
import User from "../models/User.js";
import VacationData from "../models/VacationData.js";
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { validationResult } from 'express-validator';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

dotenv.config();

// Configuración del transporter de nodemailer
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER || "intracorreo7@gmail.com",
    pass: process.env.EMAIL_PASSWORD || "fgyx zfpl qlkc nsmt",
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Funcion para formatear errores consistentemente
const formatError = (message, param = '') => {
  return {
    errors: [{
      msg: message,
      ...(param && { param })
    }]
  };
};

// Funcion para generar tokens
const generateTokens = async (user) => {
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  await user.save();

  return { accessToken, refreshToken };
};

// Registro de usuario
export const register = async (req, res) => {
  try {
    const { name, email, password, password_confirmation } = req.body;
    console.log('Body recibido en /api/auth/register:', req.body);

    // Validacion
    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!password_confirmation) missingFields.push('password_confirmation');

    if (missingFields.length > 0) {
      return res.status(400).json({
        errors: missingFields.map(field => ({
          msg: `${field} es requerido`,
          param: field
        }))
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json(formatError('Formato de email invalido', 'email'));
    }

    // Validar fortaleza de contraseña
    if (password.length < 8) {
      return res.status(400).json(formatError('La contraseña debe tener al menos 8 caracteres', 'password'));
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/.test(password)) {
      return res.status(400).json(formatError(
        'La contraseña debe contener al menos una mayuscula, una minuscula, un numero y un caracter especial', 'password'
      ));
    }

    // Validar contraseñas
    if (password !== password_confirmation) {
      return res.status(400).json(formatError('Las contraseñas no coinciden', 'password_confirmation'));
    }

    // Validar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json(formatError('El usuario ya existe', 'email'));
    }

    // Crear nuevo usuario
    const user = new User({
      name,
      email,
      password,
      role: 'user',
      vacationDays: {
        total: 0,
        used: 0
      }
    });

    // Generar token de verificación de email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 3600 * 1000);

    // Guardar usuario (incluye token de verificación)
    await user.save();

    // Crear registro especifico en VacationData
    const vacationData = new VacationData({
      user: user._id,
      total: 0,
      used: 0,
      remaining: 0
    });
    await vacationData.save();

    // Generar tokens (access y refresh)
    const { accessToken, refreshToken } = await generateTokens(user);

    // Crear enlace de verificación
    const verificationLink = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/verify-email/${verificationToken}`;

    // Enviar el correo
    await transporter.sendMail({
      to: user.email,
      from: '"intraOdes" <no-reply@intraOdes.com>',
      subject: "Verifica tu email",
      html: `
        <p>Hola ${user.name},</p>
        <p>Haz click en este enlace para verificar tu correo electrónico:</p>
        <a href="${verificationLink}">${verificationLink}</a>
      `
    });
      
    // Configuracion segura de cookies
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 días
      domain: process.env.NODE_ENV === 'production' ? '.odesconstruction.com' : undefined,
      signed: true
    });

    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Responder con los tokens y datos del usuario
    return res.status(201).json({
      success: true,
      message: 'Registro exitoso',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vacationDays: user.vacationDays
      },
      token: accessToken,
      refreshToken: refreshToken
    });
  } catch (error) {
    console.error('🔥 Error en registro:', error);

    // Manejo especifico de errores de Mongoose
    if (error.name === 'ValidationError') {
      const errors = Object.entries(error.errors).map(([field, err]) => ({
        msg: err.message,
        param: field
      }));
      return res.status(400).json({ errors });
    }

    // Error generico
    res.status(500).json(formatError('Error en el servidor'));
  }
};

// Verificación de email
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ 
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/email-verification?success=false&message=Token_inválido`);
    }

    user.isVerified = true;
    user.isActive = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    return res.redirect(`${process.env.FRONTEND_URL}/email-verification?success=true`);
  } catch (error) {
    console.error('Error en verifyEmail:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/email-verification?success=false&message=Error_interno`);
  }
};

// Reenvío de email de verificación
export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    if (user.isVerified) {
      return res.status(400).json({ 
        success: false,
        message: 'El email ya está verificado' 
      });
    }

    // Generar nuevo token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 3600 * 1000);
    
    await user.save();

    // Enviar email
    const verificationLink = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/verify-email/${verificationToken}`;
    await transporter.sendMail({
      to: user.email,
      from: '"intraOdes" <no-reply@intraOdes.com>',
      subject: "Verifica tu email",
      html: `
        <p>Hola ${user.name},</p>
        <p>Haz click en este enlace para verificar tu correo electrónico:</p>
        <a href="${verificationLink}">${verificationLink}</a>
      `
    });

    return res.json({ 
      success: true,
      message: 'Correo de verificación reenviado' 
    });

  } catch (error) {
    console.error('Error en resendVerificationEmail:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al reenviar el correo' 
    });
  }
};

// Login de usuario
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validación básica
    if (!email || !password) {
      return res.status(400).json({
        errors: [
          { msg: 'Email es requerido', param: 'email' },
          { msg: 'Contraseña es requerida', param: 'password' }
        ]
      });
    }

    // Buscar usuario con campos necesarios
    const user = await User.findOne({ email })
      .select('+password +refreshToken +loginAttempts +lockUntil +isActive +isVerified');

    if (!user) {
      return res.status(401).json(formatError('Credenciales invalidas'));
    }

    // Verificar si la cuenta está bloqueada
    if (user.isLocked) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
      return res.status(403).json(
        formatError(`Cuenta bloqueada temporalmente. Intente nuevamente en ${remainingTime} minutos`)
      );
    }

    // Comparar contraseñas
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incrementLoginAttempts();
      const attemptsLeft = 5 - (user.loginAttempts + 1);
      return res.status(401).json(
        formatError(`Credenciales inválidas. ${attemptsLeft > 0 ? `Intentos restantes: ${attemptsLeft}` : 'Cuenta bloqueada'}`)
      );
    }

    // Resetear intentos fallidos
    if (user.loginAttempts > 0 || user.lockUntil) {
      await user.resetLoginAttempts();
    }

    // Actualizar último login
    user.lastLogin = new Date();
    
    // Generar tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save();

    // Configurar cookies
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      domain: process.env.NODE_ENV === 'production' ? '.odesconstruction.com' : undefined
    });

    // Respuesta exitosa - SIEMPRE incluir ambos tokens
    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
        email_verified_at: user.email_verified_at // Asegurar este campo
      },
      token: accessToken, // Nunca undefined
      refreshToken: refreshToken
    });

  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json(formatError(error.message));
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.signedCookies.refreshToken;

    if (token) {
      const user = await User.findByRefreshToken(token);
      if (user) {
        user.refreshToken = null;
        await user.save();
      }
    }
    
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      signed: true,
      domain: process.env.NODE_ENV === 'production' ? '.odesconstruction.com' : undefined,
    });

    return res.json({ success: true, message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Error en logout:', error);
    return res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const token = req.signedCookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'Refresh token no proporcionado' });
    }

    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(payload.userId);

    if (!user || user.refreshToken !== token) {
      return res.status(403).json({ message: 'Token inválido' });
    }

    const newAccessToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();

    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      accessToken: newAccessToken
    });

  } catch (error) {
    console.error('Error en refreshToken:', error);
    return res.status(403).json({ message: 'Token inválido o expirado' });
  }
};

// Añade este nuevo método al controlador
export const getProfile = async (req, res) => {
  try {
    // El middleware authenticate ya añadió el usuario al request
    const user = req.user;
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
        email_verified_at: user.email_verified_at
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil'
    });
  }
};
