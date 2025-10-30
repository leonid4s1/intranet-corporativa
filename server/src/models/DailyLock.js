// server/src/models/DailyLock.js
import mongoose from 'mongoose';

const DailyLockSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },                // p.ej. 'birthday_digest', 'holiday_upcoming'
    dateKey: {                                            // 'YYYY-MM-DD' en TZ MX
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'dateKey debe ser YYYY-MM-DD'],
    },
    // Opcional: para candados asociados a un recurso puntual (ej. feriado)
    holidayId: { type: String, default: null },

    // (Opcional) metadatos extra
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// 1) Un candado único POR DÍA cuando NO hay holidayId (birthday_digest, etc.)
DailyLockSchema.index(
  { type: 1, dateKey: 1 },
  {
    unique: true,
    partialFilterExpression: { holidayId: null },
    name: 'uniq_type_date_noHoliday',
  }
);

// 2) Un candado único POR DÍA Y HOLIDAY cuando SÍ hay holidayId (holiday_upcoming)
DailyLockSchema.index(
  { type: 1, dateKey: 1, holidayId: 1 },
  {
    unique: true,
    partialFilterExpression: { holidayId: { $type: 'string' } },
    name: 'uniq_type_date_holiday',
  }
);

export default mongoose.model('DailyLock', DailyLockSchema);