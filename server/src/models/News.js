// server/src/models/News.js
import mongoose from 'mongoose';

const NewsSchema = new mongoose.Schema(
  {
    /* === Base === */
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true }, // lo usa getHomeFeed
    excerpt: { type: String, maxlength: 500 },

    // Compatibilidad con código existente
    date: { type: Date, required: true, default: Date.now },
    department: { type: String, required: true, default: 'General' },

    /* === Publicación/visibilidad === */
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    visibleFrom: { type: Date, default: Date.now },
    visibleUntil: { type: Date, default: null }, // exclusivo (no visible en esta fecha)

    /* === Tipos soportados por el Home + nuevo 'announcement' === */
    type: {
      type: String,
      enum: [
        'general',
        'static',
        'holiday_notice',
        'birthday_self',
        'birthday_digest_info',
        'announcement' // <— NUEVO
      ],
      default: 'general'
    },

    isActive: { type: Boolean, default: true },

    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

    /* === Campos para comunicados (carrusel/email) === */
    imageUrl: { type: String, default: null },   // /uploads/xxx.jpg
    ctaText: { type: String, default: null },    // “Ver más”
    ctaTo: { type: String, default: null },      // URL absoluta/relativa

    /* === Auditoría === */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true, versionKey: false }
);

/* === Indexes útiles para queries por visibilidad y tipo === */
NewsSchema.index({ type: 1, status: 1, isActive: 1, visibleFrom: -1 });
NewsSchema.index({ visibleFrom: 1 });
NewsSchema.index({ visibleUntil: 1 });

/* === Normalizaciones y compatibilidad === */
NewsSchema.pre('save', function (next) {
  // Si body está vacío pero hay excerpt o title, rellena para compatibilidad
  if (!this.body || this.body.trim() === '') {
    this.body = this.excerpt || this.title || '';
  }
  // visibleFrom por defecto si no viene
  if (!this.visibleFrom) this.visibleFrom = new Date();
  // Recorta excerpt si supera límite
  if (this.excerpt && this.excerpt.length > 500) {
    this.excerpt = this.excerpt.slice(0, 500);
  }
  next();
});

const News = mongoose.model('News', NewsSchema);
export default News;
