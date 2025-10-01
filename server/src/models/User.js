// server/src/models/User.js
import mongoose from 'mongoose';
import './VacationData.js';              // 👈 asegura que el modelo exista antes del post-save
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [50, 'El nombre no puede exceder los 50 caracteres']
  },

  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingresa un email válido'],
    maxlength: [100, 'El email no puede exceder los 100 caracteres']
  },

  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
    select: false
  },

  role: {
    type: String,
    enum: {
      values: ['admin', 'user', 'moderator'],
      message: 'Rol no válido'
    },
    default: 'user',
    required: true
  },

  // ===============================
  // 👇 NUEVOS CAMPOS DE PERFIL
  // ===============================
  birthDate: {
    type: Date,
    default: null
  }, // fecha de nacimiento

  hireDate: {
    type: Date,
    default: null
  }, // fecha de ingreso

  position: {
    type: String,
    trim: true,
    maxlength: [120, 'El puesto no puede exceder 120 caracteres'],
    default: null
  }, // puesto

  refreshToken: {
    type: String,
    select: false
  },

  passwordResetToken: String,
  passwordResetExpires: Date,

  isActive: {
    type: Boolean,
    default: false
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  email_verified_at: {
    type: Date
  },

  lastLogin: {
    type: Date
  },

  loginAttempts: {
    type: Number,
    default: 0
  },

  lockUntil: {
    type: Date
  },

  emailVerificationToken: String,
  emailVerificationExpires: Date,

  vacationDays: {
    total: {
      type: Number,
      default: 0,
      min: [0, 'Los dias de vacaciones no pueden ser negativos'],
      set: function (value) {
        return Math.max(0, Math.floor(value));
      }
    },
    used: {
      type: Number,
      default: 0,
      min: [0, 'Los dias usados no pueden ser negativos'],
      validate: {
        validator: function (value) {
          return value <= this.vacationDays.total;
        },
        message: 'Los dias usados no pueden exceder los dias totales'
      }
    },
    lastUpdate: {
      type: Date,
      default: Date.now
    }
  },

  vacationRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VacationRequest'
  }]

}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.refreshToken;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Índices para mejor performance
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ isVerified: 1 });
// (opcionales, útiles para reportes/listados)
UserSchema.index({ hireDate: 1 });
UserSchema.index({ position: 1 });

/* ================================
 *  Virtuales
 * ================================ */

// Alias virtual: emailVerified ↔ isVerified
UserSchema.virtual('emailVerified')
  .get(function () { return !!this.isVerified; })
  .set(function (v) { this.isVerified = !!v; });

// Virtual: cuenta bloqueada
UserSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual: perfil básico
UserSchema.virtual('profile').get(function () {
  return {
    id: this._id,
    email: this.email,
    role: this.role,
    isActive: this.isActive,
    isVerified: this.isVerified,
    // 👇 expón nuevos campos en el perfil básico
    birthDate: this.birthDate,
    hireDate: this.hireDate,
    position: this.position,
    createdAt: this.createdAt
  };
});

// Virtual: dias de vacaciones restantes
UserSchema.virtual('vacationDays.remaining').get(function () {
  if (!this.vacationDays) return 0;
  return Math.max(0, this.vacationDays.total - this.vacationDays.used);
});

/* ================================
 *  Hooks y métodos
 * ================================ */

// Middleware para encriptar contraseña
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(new Error('Error al encriptar la contraseña'));
  }
});

// Método para comparar contraseñas
UserSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    if (!candidatePassword) throw new Error('No se proporciono contraseña para comparar');
    if (!this.password) throw new Error('No se encontro contraseña almacenada');
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error(`Error comparando contraseñas para usuario ${this.email}:`, error);
    throw error;
  }
};

// Generar tokens
UserSchema.methods.generateAuthToken = function () {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no configurado');
  return jwt.sign(
    { userId: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );
};

UserSchema.methods.generateRefreshToken = function () {
  if (!process.env.REFRESH_TOKEN_SECRET) throw new Error('REFRESH_TOKEN_SECRET no configurado');
  const refreshToken = jwt.sign(
    { userId: this._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.RECRESH_TOKEN_EXPIRE || process.env.REFRESH_TOKEN_EXPIRE || '7d' }
  );
  this.refreshToken = refreshToken;
  return refreshToken;
};

// Métodos para reset de contraseña
UserSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutos
  return resetToken;
};

// Bloqueo de cuenta por intentos fallidos
UserSchema.methods.incrementLoginAttempts = async function () {
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCK_TIME = 15 * 60 * 1000; // 15 minutos
  if (this.lockUntil && this.lockUntil > Date.now()) throw new Error('Cuenta temporalmente bloqueada');
  this.loginAttempts += 1;
  if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) this.lockUntil = Date.now() + LOCK_TIME;
  await this.save();
};

UserSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  await this.save();
};

UserSchema.methods = {
  ...UserSchema.methods,

  // Metodo para añadir dias de vacaciones
  async addVacationDays(days) {
    if (days <= 0) throw new Error('Debe añadir al menos 1 dia');

    this.vacationDays.total += Math.floor(days);
    this.vacationDays.lastUpdate = new Date();
    await this.save();

    return this;
  },

  // Metodo para usar dias de vacaciones
  async useVacationDays(days) {
    if (days <= 0) throw new Error('Debe usar al menos 1 dia');
    if (this.vacationDays.remaining < days) {
      throw new Error('No tiene suficientes dias disponibles');
    }

    this.vacationDays.used += Math.floor(days);
    this.vacationDays.lastUpdate = new Date();
    await this.save();

    return this;
  },

  // Metodo para resetear dias de vacaciones
  async resetVacationDays() {
    this.vacationDays.total = 0;
    this.vacationDays.used = 0;
    this.vacationDays.lastUpdate = new Date();
    await this.save();

    return this;
  },

  // Metodo para establecer dias totales
  async setVacationDays(totalDays) {
    if (totalDays < 0) throw new Error('Los dias no pueden ser negativos');
    if (totalDays < this.vacationDays.used) {
      throw new Error('Los dias totales no pueden ser menores a los dias usados');
    }

    this.vacationDays.total = Math.floor(totalDays);
    this.vacationDays.lastUpdate = new Date();
    await this.save();

    return this;
  }
};

// Métodos estáticos
UserSchema.statics.findByRefreshToken = async function (refreshToken) {
  return this.findOne({ refreshToken }).select('+refreshToken');
};

UserSchema.statics.findByResetToken = async function (resetToken) {
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  return this.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
};

/* ================================
 *  Post-save: sync VacationData
 * ================================ */
UserSchema.post('save', async function (doc, next) {
  try {
    if (doc.vacationDays) {
      const VacationModel =
        mongoose.models.VacationData || mongoose.model('VacationData');

      const total = Number(doc.vacationDays.total || 0);
      const used = Number(doc.vacationDays.used || 0);
      const remaining = Math.max(0, total - used);

      await VacationModel.updateOne(
        { user: doc._id },
        {
          $set: {
            total,
            used,
            remaining,
            lastUpdate: new Date()
          },
          $setOnInsert: { user: doc._id } // 👈 crea si aún no existía
        },
        { upsert: true }
      );
    }
    next();
  } catch (error) {
    console.error('Error en post-save hook:', error);
    next(); // no interrumpe el flujo principal
  }
});

const User = mongoose.model('User', UserSchema);
export default User;
