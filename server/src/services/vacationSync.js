// server/src/services/vacationSync.js
import User from '../models/User.js';
import VacationData from '../models/VacationData.js';
import VacationRequest from '../models/VacationRequest.js';

/**
 * Suma los días de una solicitud:
 * - daysCount -> days.length -> rango de fechas (calendario)
 */
function countRequestDays(req) {
  if (typeof req.daysCount === 'number' && Number.isFinite(req.daysCount)) return req.daysCount;
  if (Array.isArray(req.days)) return req.days.length;

  const start = req.startDate ? new Date(req.startDate) : null;
  const end   = req.endDate ? new Date(req.endDate) : null;
  if (start && end && !isNaN(start) && !isNaN(end)) {
    const ms = end.setHours(0,0,0,0) - start.setHours(0,0,0,0);
    const days = Math.floor(ms / 86400000) + 1;
    return Math.max(0, days);
  }
  return 0;
}

const toInt = (v, def = 0) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(0, n) : def;
};

/**
 * Recalcula los días USADOS de un usuario a partir de sus solicitudes aprobadas
 * y sincroniza tanto User.vacationDays como la colección VacationData.
 *
 * Política aplicada: **CAP** → used = min(approvedUsed, total)
 * (si prefieres elevar total automáticamente, avísame y te dejo la variante).
 */
export async function recomputeUserVacationUsed(userId) {
  // 1) Sumar usados por solicitudes aprobadas
  const [approved, user, vd] = await Promise.all([
    VacationRequest.find({ user: userId, status: 'approved' }).lean(),
    User.findById(userId).select('vacationDays').lean(),
    VacationData.findOne({ user: userId }).lean(),
  ]);

  const approvedUsed = toInt(approved.reduce((sum, r) => sum + countRequestDays(r), 0), 0);

  // 2) Total actual (User tiene prioridad; si no, VacationData)
  const total = toInt(user?.vacationDays?.total ?? vd?.total ?? 0, 0);

  // 3) CAP: nunca dejar que used supere total
  const safeUsed = Math.min(approvedUsed, total);
  const remaining = Math.max(0, total - safeUsed);
  const now = new Date();

  // 4) Actualizar User con validadores
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        'vacationDays.used': safeUsed,
        'vacationDays.lastUpdate': now,
      },
    },
    { runValidators: true, context: 'query' }
  );

  // 5) Actualizar/crear VacationData (resumen)
  await VacationData.updateOne(
    { user: userId },
    {
      $set: {
        total,
        used: safeUsed,
        remaining,
        lastUpdate: now,
      },
      $setOnInsert: { user: userId },
    },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  return { total, used: safeUsed, remaining };
}

/**
 * Recalcula usados para todos los usuarios (continúa aunque alguno falle).
 */
export async function recomputeAllUsersVacationUsed() {
  const users = await User.find().select('_id').lean();
  const results = [];
  for (const u of users) {
    try {
      const r = await recomputeUserVacationUsed(u._id);
      results.push({ user: u._id.toString(), ok: true, ...r });
    } catch (err) {
      console.error('[vacations] Error recomputing user', u._id?.toString(), err?.message || err);
      results.push({ user: u._id.toString(), ok: false, error: err?.message || String(err) });
    }
  }
  return results;
}
