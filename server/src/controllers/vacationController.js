// server/src/controllers/vacationController.js
import dayjs from 'dayjs';
import mongoose from 'mongoose';
import VacationRequest from '../models/VacationRequest.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import VacationData from '../models/VacationData.js';
import {
  sendVacationApprovedEmail,
  sendVacationRejectedEmail,
} from '../services/emailService.js';

// LFT MX 2023 — utilidades
import {
  currentEntitlementDays,
  isWithinCurrentWindow,
  currentAnniversaryWindow,
  yearsOfService,
} from '../utils/vacationLawMX.js';
import { getUsedDaysInCurrentCycle } from '../services/vacationService.js';

/* ===========================
   Helpers de fechas (UTC)
=========================== */
const toDateUTC = (input) => {
  const d = new Date(input);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const toYMDUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

const eachDayYMDUTC = (startUTC, endUTC) => {
  const out = [];
  const cur = new Date(startUTC);
  const end = new Date(endUTC);
  cur.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    out.push(cur.toISOString().split('T')[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
};

const getHolidayDatesInRange = async (startUTC, endUTC) => {
  const holidays = await Holiday.find({ date: { $gte: startUTC, $lte: endUTC } }).lean();
  return holidays.map(h => toYMDUTC(h.date));
};

const isBusinessDay = (ymd, holidaySet) => {
  const d = toDateUTC(ymd);
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6 && !holidaySet.has(toYMDUTC(d));
};

const calculateBusinessDaysUTC = (startUTC, endUTC, holidayList) => {
  const set = new Set(holidayList || []);
  let count = 0;
  for (const ymd of eachDayYMDUTC(startUTC, endUTC)) {
    if (isBusinessDay(ymd, set)) count++;
  }
  return count;
};

// ===========================
//   Validación de rango
// ===========================
const validateVacationRequestDates = (startDateStr, endDateStr) => {
  const errors = [];
  const startUTC = toDateUTC(startDateStr);
  const endUTC = toDateUTC(endDateStr);

  if (Number.isNaN(startUTC.getTime())) errors.push('Fecha de inicio inválida');
  if (Number.isNaN(endUTC.getTime())) errors.push('Fecha de fin inválida');

  if (!Number.isNaN(startUTC.getTime()) && !Number.isNaN(endUTC.getTime()) && startUTC > endUTC) {
    errors.push('La fecha de inicio debe ser menor o igual a la de fin');
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (!Number.isNaN(startUTC.getTime()) && startUTC.getTime() <= today.getTime()) {
    errors.push('La fecha de inicio debe ser posterior a hoy');
  }

  return { isValid: errors.length === 0, errors, startUTC, endUTC };
};

/* ===========================
   Disponibilidad concurrente
=========================== */
const MAX_CONCURRENT_VACATIONS = 3;

const checkConcurrentAvailabilityCore = async (startUTC, endUTC) => {
  const reqs = await VacationRequest.find({
    status: { $in: ['approved', 'pending'] },
    startDate: { $lte: endUTC },
    endDate: { $gte: startUTC },
  })
    .populate('user', 'name')
    .lean();

  const perDay = new Map(); // ymd -> Set(userId)
  for (const r of reqs) {
    const s = toDateUTC(r.startDate);
    const e = toDateUTC(r.endDate);
    for (const ymd of eachDayYMDUTC(s, e)) {
      if (!perDay.has(ymd)) perDay.set(ymd, new Set());
      perDay.get(ymd).add(String(r.user?._id || r.user));
    }
  }

  for (const ymd of eachDayYMDUTC(startUTC, endUTC)) {
    const set = perDay.get(ymd);
    if (set && set.size >= MAX_CONCURRENT_VACATIONS) {
      return { isAvailable: false };
    }
  }
  return { isAvailable: true };
};

/* ===========================
   Sincronización de usados
=========================== */
const recomputeUserVacationUsed = async (userId) => {
  const approved = await VacationRequest.find({ user: userId, status: 'approved' }).lean();

  let used = 0;
  for (const r of approved) {
    let n = Number(r.daysRequested);
    if (!Number.isFinite(n) || n <= 0) {
      const s = toDateUTC(r.startDate);
      const e = toDateUTC(r.endDate);
      const hol = await getHolidayDatesInRange(s, e);
      n = calculateBusinessDaysUTC(s, e, hol);
    }
    used += n;
  }

  const user = await User.findById(userId).lean();
  if (!user) return { total: 0, used: 0, remaining: 0 };

  const totalCompat = Number(user?.vacationDays?.total ?? user?.totalAnnualDays ?? 0) || 0;
  const remainingCompat = Math.max(0, totalCompat - used);

  await User.findByIdAndUpdate(
    userId,
    {
      'vacationDays.total': totalCompat,
      'vacationDays.used': used,
      'vacationDays.lastUpdate': new Date()
    },
    { new: true }
  );

  await VacationData.findOneAndUpdate(
    { user: userId },
    { total: totalCompat, used, remaining: remainingCompat, lastUpdate: new Date() },
    { upsert: true, new: true, runValidators: true }
  );

  return { total: totalCompat, used, remaining: remainingCompat };
};

/* ===========================
   Handlers HTTP
=========================== */

// GET /vacations/balance  -> LFT + adminExtra
export const getVacationBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    if (!user.hireDate) {
      return res.status(400).json({ success: false, error: 'Falta fecha de ingreso (hireDate)' });
    }

    const win = currentAnniversaryWindow(user.hireDate);
    const right = currentEntitlementDays(user.hireDate);                 // DERECHO por ley
    const used  = await getUsedDaysInCurrentCycle(user._id, user.hireDate);
    const adminExtra = Number(user?.vacationDays?.adminExtra ?? 0) || 0; // BONO admin (≥0)

    const total = right + adminExtra;
    const remaining = Math.max(total - used, 0);

    const today = new Date(); today.setUTCHours(0,0,0,0);
    const daysLeft = Math.max(0, Math.ceil((win.end.getTime() - today.getTime()) / (24*60*60*1000)));

    return res.json({
      success: true,
      data: {
        current: {
          right,
          adminExtra,
          total,
          used,
          remaining,
          window: {
            start: win.start.toISOString().slice(0,10),
            end:   win.end.toISOString().slice(0,10),
            daysLeft,
          },
          policy: 'LFT MX 2023',
        }
      }
    });
  } catch (e) { next(e); }
};

// (resto de endpoints — sin cambios salvo validaciones LFT ya integradas)
export const getUserVacations = async (req, res, next) => {
  try {
    const [approved, pending, rejected] = await Promise.all([
      VacationRequest.find({ user: req.user.id, status: 'approved' })
        .populate('user', 'name email')
        .sort({ startDate: 1 })
        .lean(),
      VacationRequest.find({ user: req.user.id, status: 'pending' })
        .populate('user', 'name email')
        .sort({ startDate: 1 })
        .lean(),
      VacationRequest.find({ user: req.user.id, status: 'rejected' })
        .populate('user', 'name email')
        .sort({ startDate: -1 })
        .lean(),
    ]);

    const map = (v) => ({
      _id: String(v._id),
      id: String(v._id),
      user: { id: String(v.user?._id || req.user.id), name: v.user?.name || '', email: v.user?.email || '' },
      startDate: toYMDUTC(v.startDate),
      endDate: toYMDUTC(v.endDate),
      daysRequested: v.daysRequested,
      status: v.status,
      reason: v.reason || '',
      rejectReason: v.rejectReason || '',
      createdAt: v.createdAt?.toISOString?.() || new Date().toISOString(),
      updatedAt: v.updatedAt?.toISOString?.() || new Date().toISOString(),
    });

    return res.json({
      success: true,
      data: {
        approved: approved.map(map),
        pending: pending.map(map),
        rejected: rejected.map(map),
      },
    });
  } catch (e) { next(e); }
};

export const getPendingVacationRequests = async (_req, res, next) => {
  try {
    const pending = await VacationRequest.find({ status: 'pending' })
      .populate('user', 'name email')
      .sort({ startDate: 1 })
      .lean();

    const data = pending.map(v => ({
      id: String(v._id),
      user: {
        id: String(v.user?._id || v.user),
        name: v.user?.name || '',
        email: v.user?.email || '',
      },
      startDate: toYMDUTC(v.startDate),
      endDate: toYMDUTC(v.endDate),
      daysRequested: v.daysRequested,
      status: v.status,
      reason: v.reason || '',
      rejectReason: v.rejectReason || '',
      createdAt: v.createdAt?.toISOString?.() || new Date().toISOString(),
      updatedAt: v.updatedAt?.toISOString?.() || new Date().toISOString(),
    }));

    return res.json({ success: true, data });
  } catch (e) { next(e); }
};

export const getUserVacationsForCalendar = getUserVacations;

export const getTeamVacationsForCalendar = async (req, res) => {
  try {
    const { startDate, endDate } = req.validDates || req.query;
    const startUTC = toDateUTC(startDate);
    const endUTC   = toDateUTC(endDate);

    if (Number.isNaN(startUTC.getTime()) || Number.isNaN(endUTC.getTime()) || startUTC > endUTC) {
      return res.status(400).json({ success: false, error: 'Rango de fechas inválido' });
    }

    const vacations = await VacationRequest.find({
      status: 'approved',
      startDate: { $lte: endUTC },
      endDate: { $gte: startUTC },
    })
      .populate('user', 'name email isActive')
      .lean();

    const data = vacations
      .filter(v => !!v.user)
      .map(v => ({
        id: String(v._id),
        userId: String(v.user?._id || v.user),
        startDate: toYMDUTC(v.startDate),
        endDate: toYMDUTC(v.endDate),
        user: {
          id: String(v.user?._id || v.user),
          name: v.user?.name || '',
          email: v.user?.email || '',
          isActive: v.user?.isActive
        },
      }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getTeamVacationsForCalendar:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener vacaciones del equipo' });
  }
};

export const getHolidaysForCalendar = async (req, res, next) => {
  try {
    const { startDate, endDate } = (req.validDates || req.query);
    const startUTC = toDateUTC(String(startDate));
    const endUTC = toDateUTC(String(endDate));

    const holidays = await Holiday
      .find({ date: { $gte: startUTC, $lte: endUTC } })
      .select('date name')
      .lean();

    const data = holidays.map(h => ({
      date: toYMDUTC(h.date),
      name: h.name || 'Día festivo',
    }));

    return res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ... (requestVacation, updateVacationRequestStatus, cancelVacationRequest, manageVacationDays) — sin cambios de negocio LFT,
// ya los traías con validaciones y recompute.

export const getAllUsersVacationDays = async (_req, res, next) => {
  try {
    const users = await User
      .find()
      .select('name email role isActive hireDate position birthDate vacationDays')
      .lean();

    const usedByUser = await Promise.all(
      users.map(u => u.hireDate ? getUsedDaysInCurrentCycle(u._id, u.hireDate) : Promise.resolve(0))
    );

    const data = users.map((u, idx) => {
      const hireOk = !!u.hireDate;
      const right  = hireOk ? currentEntitlementDays(u.hireDate) : 0;
      const adminExtra = Number(u?.vacationDays?.adminExtra ?? 0) || 0;
      const total = right + adminExtra;
      const used  = hireOk ? usedByUser[idx] : 0;
      const remaining = Math.max(total - used, 0);

      return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive ?? true,
        position: u.position ?? '',
        hireDate: u.hireDate ?? null,
        birthDate: u.birthDate ?? null,
        vacationDays: { right, adminExtra, total, used, remaining },
      };
    });

    return res.json({ success: true, data });
  } catch (e) { next(e); }
};
