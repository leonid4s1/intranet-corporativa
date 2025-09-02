// server/src/models/VacationRequest.js
import mongoose from 'mongoose';

const vacationRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido']
  },
  startDate: {
    type: Date,
    required: [true, 'La fecha de inicio es requerida'],
    set: function(date) {
      // Normalizar fecha a UTC sin componente horario
      const d = new Date(date);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
  },
  endDate: {
    type: Date,
    required: [true, 'La fecha de fin es requerida'],
    validate: {
      validator: function(value) {
        return value >= this.startDate;
      },
      message: 'La fecha de fin debe ser posterior a la de inicio'
    },
    set: function(date) {
      // Normalizar fecha a UTC sin componente horario
      const d = new Date(date);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
  },
  daysRequested: {
    type: Number,
    required: [true, 'Los días solicitados son requeridos'],
    min: [1, 'Debe solicitar al menos 1 día']
  },
  reason: {
    type: String,
    maxlength: [500, 'La razón no puede exceder los 500 caracteres']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'cancelled'],
      message: 'Estado no válido'
    },
    default: 'pending'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,
  requestedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // Formatear fechas para respuesta API
      ret.startDate = doc.startDate.toISOString().split('T')[0];
      ret.endDate = doc.endDate.toISOString().split('T')[0];
      if (doc.processedAt) {
        ret.processedAt = doc.processedAt.toISOString().split('T')[0];
      }
      if (doc.requestedAt) {
        ret.requestedAt = doc.requestedAt.toISOString().split('T')[0];
      }
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.startDate = doc.startDate.toISOString().split('T')[0];
      ret.endDate = doc.endDate.toISOString().split('T')[0];
      return ret;
    }
  }
});

// Middleware para calcular días solicitados
vacationRequestSchema.pre('save', function(next) {
  if (this.isModified('startDate') || this.isModified('endDate')) {
    // Asegurar fechas en UTC
    this.startDate.setUTCHours(0, 0, 0, 0);
    this.endDate.setUTCHours(0, 0, 0, 0);
    
    // Calcular días considerando solo fechas (sin horas)
    const diffTime = Math.abs(this.endDate - this.startDate);
    this.daysRequested = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }
  next();
});

// Middleware para prevenir solicitudes superpuestas
vacationRequestSchema.pre('save', async function(next) {
  if (this.status === 'pending') {
    const overlappingRequests = await this.constructor.find({
      user: this.user,
      status: 'approved',
      $or: [
        { startDate: { $lte: this.endDate }, endDate: { $gte: this.startDate } }
      ],
      _id: { $ne: this._id }
    });

    if (overlappingRequests.length > 0) {
      throw new Error('Ya tienes vacaciones aprobadas en este periodo');
    }
  }
  next();
});

vacationRequestSchema.path('startDate').validate(function(value) {
  return value >= new Date( new Date().setHours(0, 0, 0, 0));
}, 'La fecha de inicio debe ser hoy o en el futuro');

vacationRequestSchema.path('endDate').validate(function(value) {
  return value >= new Date(new Date().setHours(0, 0, 0, 0));
}, 'La feche de fin debe ser hoy o en el futuro');

// Índices para mejorar el rendimiento
vacationRequestSchema.index({ user: 1 });
vacationRequestSchema.index({ startDate: 1 });
vacationRequestSchema.index({ endDate: 1 });
vacationRequestSchema.index({ status: 1 });
vacationRequestSchema.index({ user: 1, status: 1 });

const VacationRequest = mongoose.model('VacationRequest', vacationRequestSchema);

export default VacationRequest;