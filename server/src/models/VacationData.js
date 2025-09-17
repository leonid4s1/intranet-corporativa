// server/src/models/VacationData.js
import mongoose from 'mongoose';

const clampInt = (v) => Math.max(0, Math.floor(Number(v ?? 0)));

const VacationDataSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,    // 👈 un registro por usuario
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
          // en updates donde no hay doc cargado, la validación se hace en User.post('save')
          return typeof v !== 'number' || v <= this.total;
        },
        message: 'used no puede exceder total'
      }
    },
    // Se guarda por conveniencia para consultas rápidas
    remaining: {
      type: Number,
      default: 0,
      min: [0, 'remaining no puede ser negativo']
    },
    // 👇 la usa tu User.post('save')
    lastUpdate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Recalcular remaining en guardado directo
VacationDataSchema.pre('save', function (next) {
  this.remaining = clampInt(this.total - this.used);
  this.lastUpdate = new Date();
  next();
});

// Asegurar validaciones también en findOneAndUpdate (por si lo usas desde otros lados)
VacationDataSchema.pre('findOneAndUpdate', function (next) {
  // fuerza runValidators en este update
  this.setOptions({ runValidators: true });
  // si vienes desde User.post('save'), ya envías remaining calculado.
  // Si no, intenta calcularlo si total/used vienen en el $set plano.
  const update = this.getUpdate() || {};
  const $set = update.$set ?? update;

  if ($set) {
    const hasTotal = Object.prototype.hasOwnProperty.call($set, 'total');
    const hasUsed = Object.prototype.hasOwnProperty.call($set, 'used');

    if (hasTotal || hasUsed) {
      const total = clampInt($set.total ?? 0);
      const used = clampInt($set.used ?? 0);
      if (!Object.prototype.hasOwnProperty.call($set, 'remaining')) {
        // solo seteamos remaining si no lo mandaron explícitamente
        ($set.$set ?? $set).remaining = clampInt(total - used);
      }
      ($set.$set ?? $set).lastUpdate = new Date();
      // reinyecta
      if (update.$set) update.$set = $set.$set ?? $set;
      else Object.assign(update, $set);
      this.setUpdate(update);
    }
  }
  next();
});

export default mongoose.model('VacationData', VacationDataSchema);
