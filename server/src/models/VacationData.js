// server/src/models/VacationData.js
import mongoose from 'mongoose';

const clampInt = (v) => Math.max(0, Math.floor(Number(v ?? 0)));

const VacationDataSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      // ⚠️ Importante: no poner "unique" ni "index" aquí para evitar el warning
      // de índice duplicado. Definimos el índice explícito más abajo.
    },
    total: {
      type: Number,
      default: 0,
      min: [0, 'total no puede ser negativo'],
      set: clampInt,
    },
    used: {
      type: Number,
      default: 0,
      min: [0, 'used no puede ser negativo'],
      set: clampInt,
      validate: {
        validator: function (v) {
          // Cuando se actualiza desde User/Controllers llega validado;
          // Esta validación evita "used > total" en escrituras directas.
          return typeof v !== 'number' || v <= this.total;
        },
        message: 'used no puede exceder total',
      },
    },
    // Guardado para consultas rápidas
    remaining: {
      type: Number,
      default: 0,
      min: [0, 'remaining no puede ser negativo'],
    },
    lastUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => ret,
    },
  }
);

/**
 * Índice único explícito.
 * Nota: evitamos "unique: true" e "index: true" en el campo "user"
 * para que Mongoose no emita el warning de índice duplicado.
 */
VacationDataSchema.index({ user: 1 }, { unique: true });

// Recalcular remaining en guardado directo
VacationDataSchema.pre('save', function (next) {
  this.remaining = clampInt(this.total - this.used);
  this.lastUpdate = new Date();
  next();
});

// Asegurar validaciones y actualizar lastUpdate/remaining en updates por query
VacationDataSchema.pre(['findOneAndUpdate', 'updateOne'], function (next) {
  this.setOptions({ runValidators: true });

  const update = this.getUpdate() || {};
  // Puede venir con $set o plano
  const $set = update.$set ?? update;

  if ($set) {
    const hasTotal = Object.prototype.hasOwnProperty.call($set, 'total');
    const hasUsed  = Object.prototype.hasOwnProperty.call($set, 'used');
    const hasRem   = Object.prototype.hasOwnProperty.call($set, 'remaining');

    // Si no nos enviaron remaining explícito, intenta calcularlo con lo que llegue.
    // (En nuestros controllers normalmente mandamos total, used y remaining juntos.)
    if (!hasRem && (hasTotal || hasUsed)) {
      const t = clampInt($set.total ?? 0);
      const u = clampInt($set.used  ?? 0);
      ($set.$set ?? $set).remaining = clampInt(t - u);
    }

    // Actualiza lastUpdate si tocamos algo relevante
    if (hasTotal || hasUsed || hasRem) {
      ($set.$set ?? $set).lastUpdate = new Date();
    }

    // Reinyecta en el update original
    if (update.$set) update.$set = $set.$set ?? $set;
    else Object.assign(update, $set);
    this.setUpdate(update);
  }

  next();
});

export default mongoose.models.VacationData ||
  mongoose.model('VacationData', VacationDataSchema);
