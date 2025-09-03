// server/src/models/Holiday.js
import mongoose from 'mongoose';

const HolidaySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'La fecha del festivo es requerida'],
      unique: true, // crea índice único; no declares otro índice para "date"
      validate: {
        validator(value) {
          return value > new Date();
        },
        message: 'La fecha del festivo debe ser futura'
      }
    },
    name: {
      type: String,
      required: [true, 'El nombre del festivo es requerido'],
      trim: true,
      maxlength: [100, 'El nombre no puede exceder los 100 caracteres']
    },
    recurring: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'La descripcion no puede exceder los 500 caracteres']
    },
    customId: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  {
    timestamps: true,
  }
);

// Índices adicionales (evita duplicar el de "date")
HolidaySchema.index({ recurring: 1 });

// Normalización de nombre
HolidaySchema.pre('save', function (next) {
  if (this.name) {
    this.name =
      this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase();
  }
  next();
});

// Búsqueda flexible
HolidaySchema.statics.findAndDelete = async function (id) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  if (isObjectId) {
    return this.findByIdAndDelete(id);
  }
  return this.findOneAndDelete({
    $or: [{ customId: id }, { name: id }]
  });
};

export default mongoose.model('Holiday', HolidaySchema);
