// server/src/models/VacationData.js
import mongoose from 'mongoose';

const clampInt = (v) => Math.max(0, Math.floor(Number(v ?? 0)));

const VacationDataSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,          // 👈 un registro por usuario
      index: true
    },
    total: {
      type: Number,
      default: 0,
      min: [0, 'total no puede ser negativo'],
      set: clampInt
    },
    used: {
      type: Number,
      default: 0,
      min: [0, 'used no puede ser negativo'],
      set: clampInt,
      validate: {
        validator: function (v) {
          // cuando se actualiza desde User.post('save') llega validado
          return typeof v !== 'number' || v <= this.total;
        },
        message: 'used no puede exceder total'
      }
    },
    // Guardado para consultas rápidas
    remaining: {
      type: Number,
      default: 0,
      min: [0, 'remaining no puede ser negativo']
    },
    lastUpdate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        // ya ocultamos __v con versionKey:false
        return ret;
      }
    }
  }
);

// Índice explícito por si el unique no se creó aún
VacationDataSchema.index({ user: 1 }, { unique: true });

// Recalcular remaining en guardado directo
VacationDataSchema.pre('save', function (next) {
  this.remaining = clampInt(this.total - this.used);
  this.lastUpdate = new Date();
  next();
});

// Asegurar validaciones y actualizar lastUpdate en findOneAndUpdate / updateOne
VacationDataSchema.pre(['findOneAndUpdate', 'updateOne'], function (next) {
  // fuerza validaciones
  this.setOptions({ runValidators: true });

  const update = this.getUpdate() || {};
  // Puede venir con $set o plano
  const $set = update.$set ?? update;

  if ($set) {
    const hasTotal = Object.prototype.hasOwnProperty.call($set, 'total');
    const hasUsed  = Object.prototype.hasOwnProperty.call($set, 'used');
    const hasRem   = Object.prototype.hasOwnProperty.call($set, 'remaining');

    // Solo autocalcular remaining si VIENEN total y used juntos
    if (!hasRem && hasTotal && hasUsed) {
      const total = clampInt($set.total);
      const used  = clampInt($set.used);
      ($set.$set ?? $set).remaining = clampInt(total - used);
    }

    // Actualizar lastUpdate si tocamos algo relevante
    if (hasTotal || hasUsed || hasRem) {
      ($set.$set ?? $set).lastUpdate = new Date();
    }

    // reinyecta
    if (update.$set) update.$set = $set.$set ?? $set;
    else Object.assign(update, $set);
    this.setUpdate(update);
  }

  next();
});

export default mongoose.models.VacationData ||
  mongoose.model('VacationData', VacationDataSchema);
