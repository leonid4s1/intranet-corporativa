// server/src/models/VacationData.js
import mongoose from 'mongoose'

const clampInt = (v) => Math.max(0, Math.floor(Number(v ?? 0)))

const VacationDataSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,        // un registro por usuario
      // ❌ quitamos index:true para no duplicar definición del índice
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
          return typeof v !== 'number' || v <= this.total
        },
        message: 'used no puede exceder total',
      },
    },
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
    toJSON: { transform: (_doc, ret) => ret },
  }
)

// Índice único explícito (solo aquí, sin duplicarlo en el campo)
VacationDataSchema.index({ user: 1 }, { unique: true })

// Recalcular en save directo
VacationDataSchema.pre('save', function (next) {
  this.remaining = clampInt(this.total - this.used)
  this.lastUpdate = new Date()
  next()
})

// Hook de actualización: SIEMPRE escribir en $set de forma plana
VacationDataSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
  this.setOptions({ runValidators: true })

  const update = this.getUpdate() || {}
  if (!update.$set) update.$set = {}
  const set = update.$set

  const touchesTotal = Object.prototype.hasOwnProperty.call(set, 'total')
  const touchesUsed  = Object.prototype.hasOwnProperty.call(set, 'used')

  if (touchesTotal || touchesUsed) {
    const total = clampInt(set.total ?? 0)
    const used  = clampInt(set.used  ?? 0)
    if (!Object.prototype.hasOwnProperty.call(set, 'remaining')) {
      set.remaining = clampInt(total - used)
    }
  }

  // marca tiempo siempre que tocamos el doc
  set.lastUpdate = new Date()

  this.setUpdate(update)
  next()
})

export default mongoose.models.VacationData ||
  mongoose.model('VacationData', VacationDataSchema)
