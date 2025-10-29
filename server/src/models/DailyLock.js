import mongoose from 'mongoose';

const DailyLockSchema = new mongoose.Schema({
  type: { type: String, required: true },     // p.ej. 'birthday_digest'
  dateKey: { type: String, required: true },  // 'YYYY-MM-DD' en TZ MX
  createdAt: { type: Date, default: Date.now },
});

// Un candado por (tipo, día)
DailyLockSchema.index({ type: 1, dateKey: 1 }, { unique: true });

export default mongoose.model('DailyLock', DailyLockSchema);
