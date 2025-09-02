// server/src/models/Holiday.js
import mongoose from 'mongoose';
import { type } from 'os';
import list from 'postcss/lib/list';

const { space } = list;

const holidaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'La fecha del festivo es requerida'],
    unique: true,
    validate: {
      validator: function(value) {
        return value > new Date ();
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
    required: [true, 'Debe especificar si el festivo es recurrente'],
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
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimización
holidaySchema.index({ date: 1 });
holidaySchema.index({ recurring: 1 });

// Middleware para asegurar formato consistente
holidaySchema.pre('save', function(next) {
  if (this.name) {
    this.name = this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase();
  }
  next();
});

// Busqueda flexible
holidaySchema.static.findAndDelete = async function(id) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

  if (isObjectId) {
    return this.findByIdAndDelete(id);
  } else {
    return this.findOneAndDelete({
      $or: [
        { customId: id},
        { name: id }
      ]
    });
  }
};

const Holiday = mongoose.model('Holiday', holidaySchema);

export default Holiday;