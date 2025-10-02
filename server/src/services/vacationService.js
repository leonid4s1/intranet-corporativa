// server/src/services/vacationService.js
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc);

import VacationRequest from '../models/VacationRequest.js';
import Holiday from '../models/Holiday.js';
import { currentAnniversaryWindow } from '../utils/vacationLawMX.js';

/* =========================
   Helpers de fechas en UTC
========================= */
const toDateUTC = (input) => {
  const d = new Date(input);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
const toYMDUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};
const eachDayYMDUTC = (startUTC, endUTC) => {
  const out = [];
  const cur = new Date(startUTC);
  const end = new Date(endUTC);
  cur.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
};
const isBusinessDay = (ymd, holidaySet) => {
  const d = toDateUTC(ymd);
  const dow = d.getUTCDay(); // 0=Dom, 6=Sáb
  return dow !== 0 && dow !== 6 && !holidaySet.has(toYMDUTC(d));
};
const businessDaysInRange = (startUTC, endUTC, holidaySet) => {
  let n = 0;
  for (const ymd of eachDayYMDUTC(startUTC, endUTC)) {
    if (isBusinessDay(ymd, holidaySet)) n++;
  }
  return n;
};

/**
 * Días USADOS en el ciclo vigente (LFT) por usuario
 * - SOLO solicitudes del usuario, estado 'approved'
 * - Intersección (solicitud ∩ ventana actual)
 * - Cuenta **días hábiles** (excluye sábados, domingos y festivos)
 */
export async function getUsedDaysInCurrentCycle(
  userId,
  hireDate
) {
  if (!userId || !hireDate) return 0;

  const win = currentAnniversaryWindow(hireDate); // { start: Date, end: Date }
  if (!win) return 0;

  const winStart = toDateUTC(win.start);
  const winEnd   = toDateUTC(win.end);

  // 1) Traer SOLO solicitudes del USUARIO que traslapan la ventana
  const reqs = await VacationRequest.find({
    user: userId,                    // ⬅️ ¡campo correcto!
    status: 'approved',
    startDate: { $lte: winEnd },
    endDate:   { $gte: winStart },
  })
    .select('startDate endDate daysRequested') // usamos daysRequested si lo necesitas en otro sitio
    .lean();

  if (!reqs.length) return 0;

  // 2) Festivos dentro de la ventana
  const holidays = await Holiday.find({
    date: { $gte: winStart, $lte: winEnd },
  })
    .select('date')
    .lean();

  const holidaySet = new Set(holidays.map(h => toYMDUTC(h.date)));

  // 3) Sumar días hábiles en la intersección
  let used = 0;
  for (const r of reqs) {
    const rs = toDateUTC(r.startDate);
    const re = toDateUTC(r.endDate);

    // Intersección con ventana
    const isecStart = rs > winStart ? rs : winStart;
    const isecEnd   = re < winEnd   ? re : winEnd;
    if (isecStart > isecEnd) continue;

    used += businessDaysInRange(isecStart, isecEnd, holidaySet);
  }

  return used;
}
