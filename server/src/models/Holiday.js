// server/src/models/Holiday.js
import mongoose from 'mongoose';

const normalizeToUTCDateOnly = (val) => {
  if (!val) return val;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const HolidaySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'La fecha del festivo es requerida'],
      unique: true, // único por día (YYYY-MM-DD en UTC)
    },
    name: {
      type: String,
      required: [true, 'El nombre del festivo es requerido'],
      trim: true,
      maxlength: [100, 'El nombre no puede exceder los 100 caracteres'],
    },
    recurring: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'La descripcion no puede exceder los 500 caracteres'],
    },
    customId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índices adicionales (evita duplicar el de "date")
HolidaySchema.index({ recurring: 1 });

/* =========================
 * Normalizaciones
 * ========================= */

// Normaliza nombre (Title-case simple)
HolidaySchema.pre('save', function (next) {
  if (this.name) {
    this.name =
      this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase();
  }
  // Normaliza fecha a 00:00:00 UTC
  if (this.date) {
    this.date = normalizeToUTCDateOnly(this.date);
  }
  next();
});

// También normaliza en updates
HolidaySchema.pre(['findOneAndUpdate', 'updateOne'], function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set ?? update;

  if ($set.date) {
    $set.date = normalizeToUTCDateOnly($set.date);
  }
  if ($set.name) {
    $set.name =
      $set.name.charAt(0).toUpperCase() + $set.name.slice(1).toLowerCase();
  }

  if (update.$set) update.$set = $set;
  else this.setUpdate($set);

  next();
});

/* =========================
 * Utils de búsqueda/borrado
 * ========================= */

HolidaySchema.statics.findAndDelete = async function (id) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  if (isObjectId) {
    return this.findByIdAndDelete(id);
  }
  return this.findOneAndDelete({
    $or: [{ customId: id }, { name: id }],
  });
};

export default mongoose.models.Holiday ||
  mongoose.model('Holiday', HolidaySchema);
