// server/src/services/vacationSync.js
import User from '../models/User.js';
import VacationData from '../models/VacationData.js';
import VacationRequest from '../models/VacationRequest.js';

/**
 * Suma los días de todas las solicitudes aprobadas de un usuario.
 * Intenta usar, en este orden: daysCount -> days.length -> (endDate - startDate + 1)
 */
function countRequestDays(req) {
  if (typeof req.daysCount === 'number' && Number.isFinite(req.daysCount)) return req.daysCount;
  if (Array.isArray(req.days)) return req.days.length;

  // fallback por fechas (asume días calendario; si manejas hábiles, adapta aquí)
  const start = req.startDate ? new Date(req.startDate) : null;
  const end   = req.endDate ? new Date(req.endDate) : null;
  if (start && end && !isNaN(start) && !isNaN(end)) {
    const ms = end.setHours(0,0,0,0) - start.setHours(0,0,0,0);
    const days = Math.floor(ms / 86400000) + 1;
    return Math.max(0, days);
  }
  return 0;
}

/**
 * Recalcula los días usados de vacaciones de un usuario (suma solicitudes aprobadas)
 * y sincroniza User.vacationDays y VacationData.
 */
export async function recomputeUserVacationUsed(userId) {
  // 1) sumar usados por solicitudes aprobadas
  const approved = await VacationRequest.find({ user: userId, status: 'approved' }).lean();
  const used = approved.reduce((sum, r) => sum + countRequestDays(r), 0);

  // 2) obtener el total actual (desde User o desde VacationData si existe)
  const user = await User.findById(userId).lean();
  const vd   = await VacationData.findOne({ user: userId }).lean();
  const total = (user?.vacationDays?.total ?? vd?.total ?? 0);

  // 3) actualizar User (no necesitamos el hook post-save aquí, actualizamos ambas colecciones explícitamente)
  await User.findByIdAndUpdate(
    userId,
    {
      'vacationDays.used': used,
      'vacationDays.lastUpdate': new Date()
    },
    { new: true }
  );

  // 4) actualizar/crear VacationData
  await VacationData.findOneAndUpdate(
    { user: userId },
    {
      total,
      used,
      remaining: Math.max(0, total - used),
      lastUpdate: new Date()
    },
    { upsert: true, new: true, runValidators: true }
  );

  return { total, used, remaining: Math.max(0, total - used) };
}

/**
 * (Opcional) Recalcula usados para todos los usuarios.
 */
export async function recomputeAllUsersVacationUsed() {
  const users = await User.find().select('_id').lean();
  const results = [];
  for (const u of users) {
    const r = await recomputeUserVacationUsed(u._id);
    results.push({ user: u._id.toString(), ...r });
  }
  return results;
}
