// server/src/models/News.js
import mongoose from 'mongoose';

const NewsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  body: {  // ⬅️ CAMBIADO: en lugar de 'content' usa 'body' que es lo que busca getHomeFeed
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    maxlength: 500
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  department: {
    type: String,
    required: true,
    default: 'General'
  },
  // ⬇️ CAMPOS QUE USA TU getHomeFeed
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published'
  },
  visibleFrom: {
    type: Date,
    default: Date.now
  },
  visibleUntil: {
    type: Date
  },
  // ⬇️ CAMPOS ADICIONALES PARA HOLIDAY NOTIFICATIONS
  type: {
    type: String,
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Middleware para asegurar compatibilidad
NewsSchema.pre('save', function(next) {
  // Si body está vacío pero tenemos excerpt, usarlo
  if (!this.body || this.body.trim() === '') {
    this.body = this.excerpt || this.title || '';
  }
  
  // Si visibleFrom no está establecido, usar la fecha actual
  if (!this.visibleFrom) {
    this.visibleFrom = new Date();
  }
  
  next();
});

const News = mongoose.model('News', NewsSchema);
export default News;