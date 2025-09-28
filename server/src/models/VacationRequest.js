// server/src/models/VacationRequest.js
import mongoose from 'mongoose';

const vacationRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es requerido'],
      index: true
    },

    startDate: {
      type: Date,
      required: [true, 'La fecha de inicio es requerida'],
      set: function (date) {
        // Normaliza a UTC 00:00:00
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      },
      validate: {
        validator(value) {
          // Inicio hoy o futuro
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return value >= today;
        },
        message: 'La fecha de inicio debe ser hoy o en el futuro',
      },
      index: true
    },

    endDate: {
      type: Date,
      required: [true, 'La fecha de fin es requerida'],
      set: function (date) {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      },
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
      index: true
    },

    daysRequested: {
      type: Number,
      required: [true, 'Los días solicitados son requeridos'],
      min: [1, 'Debe solicitar al menos 1 día'],
    },

    // Motivo del USUARIO al solicitar
    reason: {
      type: String,
      maxlength: [500, 'La razón no puede exceder los 500 caracteres'],
      default: '',
    },

    // Motivo del ADMIN al rechazar
    rejectReason: {
      type: String,
      maxlength: [500, 'El motivo de rechazo no puede exceder los 500 caracteres'],
      default: '',
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected', 'cancelled'],
        message: 'Estado no válido',
      },
      default: 'pending',
      index: true
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

    /* ========= SNAPSHOT DEL USUARIO =========
       Se llena al aprobar para conservar nombre/email
       aunque el usuario cambie, se desactive o se elimine. */
    userSnapshot: {
      name: { type: String, default: null },
      email: { type: String, default: null }
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        // Formato de fechas “YYYY-MM-DD”
        ret.startDate = doc.startDate?.toISOString().split('T')[0];
        ret.endDate = doc.endDate?.toISOString().split('T')[0];
        if (doc.processedAt) ret.processedAt = doc.processedAt.toISOString().split('T')[0];
        if (doc.requestedAt) ret.requestedAt = doc.requestedAt.toISOString().split('T')[0];

        // Alias de totalDays (útil para front/controladores genéricos)
        ret.totalDays = doc.daysRequested;

        // Asegurar presencia del campo (aunque sea vacío)
        ret.rejectReason = doc.rejectReason || '';
        ret.reason = doc.reason || '';
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(doc, ret) {
        ret.startDate = doc.startDate?.toISOString().split('T')[0];
        ret.endDate = doc.endDate?.toISOString().split('T')[0];
        // También exponer totalDays en toObject
        ret.totalDays = doc.daysRequested;
        return ret;
      },
    },
  }
);

/* ===================== Virtuals ===================== */
// Alias para compatibilidad con código que usa "totalDays"
vacationRequestSchema.virtual('totalDays').get(function () {
  return this.daysRequested;
});

/* ===================== Middlewares ===================== */

// Recalcular días antes de guardar si cambian fechas
vacationRequestSchema.pre('save', function (next) {
  if (this.isModified('startDate') || this.isModified('endDate')) {
    this.startDate.setUTCHours(0, 0, 0, 0);
    this.endDate.setUTCHours(0, 0, 0, 0);

    const diffTime = Math.abs(this.endDate - this.startDate);
    // +1 para contar inclusivo (p.ej., 17–19 = 3)
    this.daysRequested = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }
  next();
});

// Evitar solapamiento con solicitudes APROBADAS existentes
vacationRequestSchema.pre('save', async function (next) {
  try {
    if (this.status === 'pending' || this.status === 'approved') {
      const overlapping = await this.constructor.find({
        user: this.user,
        status: 'approved',
        _id: { $ne: this._id },
        // Solapamiento clásico: A empieza antes de que B termine Y A termina después de que B empiece
        startDate: { $lte: this.endDate },
        endDate:   { $gte: this.startDate }
      }).lean();

      if (overlapping.length > 0) {
        return next(new Error('Ya tienes vacaciones aprobadas en este periodo'));
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

/* ===================== Índices ===================== */
// ya agregaste índices individuales arriba; añade compuestos útiles:
vacationRequestSchema.index({ user: 1, status: 1, startDate: 1 });
vacationRequestSchema.index({ status: 1, startDate: 1 });

const VacationRequest = mongoose.model('VacationRequest', vacationRequestSchema);
export default VacationRequest;
