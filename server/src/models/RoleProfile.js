// server/src/models/RoleProfile.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const KpiSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    value: { type: Number, required: true, min: 0, max: 100 },
    target: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const RoleProfileSchema = new Schema(
  {
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    // Clave única para buscar rápido (ej: "architect_senior")
    roleKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_]+$/,
      unique: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    reportsTo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    responsibilities: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length <= 25,
        message: 'Responsabilidades no puede tener más de 25 elementos',
      },
    },

    kpis: {
      type: [KpiSchema],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length <= 12,
        message: 'KPIs no puede exceder 12 elementos',
      },
    },

    // Permite desactivar sin borrar
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default mongoose.model('RoleProfile', RoleProfileSchema);
