// server/src/models/VacationRequest.js
import mongoose from 'mongoose';

const toUTC00 = (date) => {
  if (!date) return date;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const toYMD = (d) => (d ? new Date(d).toISOString().split('T')[0] : d);

/** Recalcula días (calendario, inclusivo) para start/end ya normalizados a UTC 00:00 */
const computeCalendarDaysInclusive = (startDate, endDate) => {
  const s = new Date(startDate);
  const e = new Date(endDate);
  const diff = Math.abs(e - s);
  // +1 para inclusivo (p.ej. 17–19 => 3)
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
};

const vacationRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es requerido'],
      index: true,
    },

    startDate: {
      type: Date,
      required: [true, 'La fecha de inicio es requerida'],
      set: toUTC00,
      validate: {
        validator(value) {
          // Inicio hoy o futuro (para nuevas solicitudes)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return value >= today;
        },
        message: 'La fecha de inicio debe ser hoy o en el futuro',
      },
      index: true,
    },

    endDate: {
      type: Date,
      required: [true, 'La fecha de fin es requerida'],
      set: toUTC00,
      validate: [
        {
          validator(value) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return value >= today;
          },
          message: 'La fecha de fin debe ser hoy o en el futuro',
        },
        {
          validator(value) {
            // Debe ser >= startDate
            return !this.startDate || value >= this.startDate;
          },
          message: 'La fecha de fin debe ser posterior a la de inicio',
        },
      ],
      index: true,
    },

    /**
     * daysRequested = DÍAS HÁBILES (lo que descuenta saldo)
     * Este valor debe venir calculado desde el controller/service.
     * El modelo NO debe recalcularlo porque requiere festivos + fines.
     */
    daysRequested: {
      type: Number,
      required: [true, 'Los días solicitados son requeridos'],
      min: [1, 'Debe solicitar al menos 1 día'],
    },

    /**
     * calendarDays = DÍAS NATURALES (informativo)
     * Se calcula automáticamente en el modelo cuando cambian fechas.
     */
    calendarDays: {
      type: Number,
      default: null,
      min: [1, 'Los días naturales deben ser al menos 1 día'],
    },

    // Motivo del USUARIO al solicitar
    reason: {
      type: String,
      maxlength: [500, 'La razón no puede exceder los 500 caracteres'],
      default: '',
      set: (v) => (typeof v === 'string' ? v.trim() : v),
    },

    // Motivo del ADMIN al rechazar
    rejectReason: {
      type: String,
      maxlength: [500, 'El motivo de rechazo no puede exceder los 500 caracteres'],
      default: '',
      set: (v) => (typeof v === 'string' ? v.trim() : v),
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected', 'cancelled'],
        message: 'Estado no válido',
      },
      default: 'pending',
      index: true,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    processedAt: Date,

    requestedAt: {
      type: Date,
      default: Date.now,
    },

    /* ========= SNAPSHOT DEL USUARIO ========= */
    userSnapshot: {
      name: { type: String, default: null },
      email: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.startDate = toYMD(doc.startDate);
        ret.endDate = toYMD(doc.endDate);
        if (doc.processedAt) ret.processedAt = toYMD(doc.processedAt);
        if (doc.requestedAt) ret.requestedAt = toYMD(doc.requestedAt);

        // Alias útil en el front: totalDays = HÁBILES
        ret.totalDays = doc.daysRequested;

        // Exponer naturales
        ret.calendarDays = doc.calendarDays ?? null;

        ret.rejectReason = doc.rejectReason || '';
        ret.reason = doc.reason || '';
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(doc, ret) {
        ret.startDate = toYMD(doc.startDate);
        ret.endDate = toYMD(doc.endDate);
        ret.totalDays = doc.daysRequested;
        ret.calendarDays = doc.calendarDays ?? null;
        return ret;
      },
    },
  }
);

/* ===================== Virtuals ===================== */
vacationRequestSchema.virtual('totalDays').get(function () {
  // totalDays = HÁBILES
  return this.daysRequested;
});

/* ===================== Middlewares ===================== */

// Normalizar fechas y recalcular SOLO calendarDays (naturales) antes de guardar si cambian
vacationRequestSchema.pre('save', function (next) {
  if (this.isModified('startDate')) this.startDate = toUTC00(this.startDate);
  if (this.isModified('endDate')) this.endDate = toUTC00(this.endDate);

  if (this.isModified('startDate') || this.isModified('endDate')) {
    // ✅ Naturales informativos
    this.calendarDays = computeCalendarDaysInclusive(this.startDate, this.endDate);

    // ❌ NO tocar daysRequested aquí (eso es hábil y viene del controller)
    // this.daysRequested = ...
  }
  next();
});

// Evitar solapamiento con solicitudes APROBADAS existentes
vacationRequestSchema.pre('save', async function (next) {
  try {
    if (this.status === 'pending' || this.status === 'approved') {
      const overlapping = await this.constructor
        .find({
          user: this.user,
          status: 'approved',
          _id: { $ne: this._id },
          startDate: { $lte: this.endDate },
          endDate: { $gte: this.startDate },
        })
        .lean();

      if (overlapping.length > 0) {
        return next(new Error('Ya tienes vacaciones aprobadas en este periodo'));
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

// En updates: normalizar fechas, recalcular SOLO calendarDays y fijar processedAt/snapshot si cambia status
vacationRequestSchema.pre(['findOneAndUpdate', 'updateOne'], async function (next) {
  try {
    const update = this.getUpdate() || {};
    const $set = update.$set ?? update;

    // Normaliza fechas
    if ($set.startDate) $set.startDate = toUTC00($set.startDate);
    if ($set.endDate) $set.endDate = toUTC00($set.endDate);

    // Recalcula calendarDays (naturales) si cambian fechas
    if ($set.startDate || $set.endDate) {
      const current = await this.model.findOne(this.getQuery()).select('startDate endDate').lean();
      const start = $set.startDate ?? current?.startDate;
      const end = $set.endDate ?? current?.endDate;

      if (start && end) {
        const cal = computeCalendarDaysInclusive(start, end);

        if (update.$set) update.$set.calendarDays = cal;
        else $set.calendarDays = cal;

        // ❌ NO recalcular daysRequested aquí
        // (debe venir desde controller/service donde tienes festivos + fines)
      }
    }

    // Si cambia a estado final, set processedAt
    if (typeof $set.status === 'string') {
      const newSt = $set.status;
      if (['approved', 'rejected', 'cancelled'].includes(newSt)) {
        if (update.$set) update.$set.processedAt = new Date();
        else $set.processedAt = new Date();

        // Si pasa a approved, guarda snapshot de usuario
        if (newSt === 'approved') {
          const doc = await this.model.findOne(this.getQuery()).populate('user', 'name email').lean();
          const name = doc?.user?.name ?? null;
          const email = doc?.user?.email ?? null;

          if (update.$set) {
            update.$set['userSnapshot.name'] = name;
            update.$set['userSnapshot.email'] = email;
          } else {
            $set.userSnapshot = $set.userSnapshot || {};
            $set.userSnapshot.name = name;
            $set.userSnapshot.email = email;
          }
        }
      }
      // Si NO es rejected, limpia rejectReason para no arrastrarlo
      if (newSt !== 'rejected') {
        if (update.$set) update.$set.rejectReason = '';
        else $set.rejectReason = '';
      }
    }

    if (update.$set) update.$set = $set;
    else this.setUpdate($set);

    next();
  } catch (err) {
    next(err);
  }
});

/* ===================== Índices ===================== */
vacationRequestSchema.index({ user: 1, status: 1, startDate: 1 });
vacationRequestSchema.index({ status: 1, startDate: 1 });

export default mongoose.models.VacationRequest ||
  mongoose.model('VacationRequest', vacationRequestSchema);