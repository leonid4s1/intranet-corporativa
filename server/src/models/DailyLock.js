// server/src/models/DailyLock.js
import mongoose from 'mongoose';

const DailyLockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      set: (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    }, // p.ej. 'birthday_digest', 'holiday_upcoming_7d'

    // 'YYYY-MM-DD' en TZ MX (clave del día)
    dateKey: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'dateKey debe ser YYYY-MM-DD'],
    },

    // Opcional: asociar el lock a un recurso puntual (ej. ID del feriado)
    holidayId: { type: String, default: null },

    // Metadatos opcionales
    meta: { type: mongoose.Schema.Types.Mixed, default: null },

    // Opcional: fecha de expiración automática del lock (TTL)
    // Si la usas, crea documentos con expiresAt = nueva Fecha futura
    expiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'dailylocks', // fija el nombre y evita pluralización inesperada
  }
);

/* ==========================
 *        Índices
 * ========================== */

// 1) Un candado único POR DÍA cuando NO hay holidayId (birthday_digest, etc.)
DailyLockSchema.index(
  { type: 1, dateKey: 1 },
  {
    unique: true,
    partialFilterExpression: { holidayId: null },
    name: 'uniq_type_date_noHoliday',
  }
);

// 2) Un candado único POR DÍA Y HOLIDAY cuando SÍ hay holidayId (holiday_upcoming_7d)
DailyLockSchema.index(
  { type: 1, dateKey: 1, holidayId: 1 },
  {
    unique: true,
    partialFilterExpression: { holidayId: { $type: 'string' } },
    name: 'uniq_type_date_holiday',
  }
);

// 3) TTL opcional sobre expiresAt (solo si asignas expiresAt en los documentos)
DailyLockSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0, // al llegar la fecha, MongoDB borra el doc
    partialFilterExpression: { expiresAt: { $type: 'date' } },
    name: 'ttl_expiresAt',
  }
);

/* ==========================
 *  Helper estático (lock)
 * ========================== */
/**
 * Intenta crear el lock una sola vez.
 * @param {{type:string, dateKey:string, holidayId?:string|null, meta?:any}} params
 * @returns {Promise<boolean>} true si se creó (no existía), false si ya existía
 */
DailyLockSchema.statics.acquireOnce = async function (params = {}) {
  const { type, dateKey, holidayId = null, meta = null } = params;
  if (!type || !dateKey) throw new Error('DailyLock.acquireOnce: type y dateKey son requeridos');

  const query = { type: String(type).trim().toLowerCase(), dateKey, holidayId: holidayId ?? null };
  const update = { $setOnInsert: { createdAt: new Date(), meta } };

  const existed = await this.findOneAndUpdate(query, update, { upsert: true, new: false }).lean();
  return !existed;
};

export default mongoose.model('DailyLock', DailyLockSchema);
