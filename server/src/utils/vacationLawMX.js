// server/src/utils/vacationLawMX.js
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
dayjs.extend(utc);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

/**
 * Días de derecho por años de servicio (LFT MX 2023 “vacaciones dignas”)
 */
export function entitlementDaysByYearsMX(years) {
  if (years <= 0) return 0; // aún no cumple 1 año
  if (years === 1) return 12;
  if (years === 2) return 14;
  if (years === 3) return 16;
  if (years === 4) return 18;
  if (years === 5) return 20;
  if (years <= 10) return 20 + (years - 5) * 2; // 6..10 => 22,24,26,28,30
  // 11+ aumenta 2 días cada 5 años (11–15 =>32; 16–20 =>34; etc.)
  const blocksAfter10 = Math.floor((years - 11) / 5) + 1; // 11–15 -> 1; 16–20 -> 2; ...
  return 30 + blocksAfter10 * 2;
}

/** Años de servicio completos al 'onDate' */
export function yearsOfService(hireDate, onDate = new Date()) {
  const hd = dayjs.utc(hireDate);
  const d = dayjs.utc(onDate);
  if (!hd.isValid() || !d.isValid()) return 0;

  let yrs = d.year() - hd.year();
  const annivThisYear = hd.year(d.year());
  if (d.isBefore(annivThisYear)) yrs -= 1;
  return Math.max(0, yrs);
}

/** Ventana del ciclo vigente: aniversario actual (o último) y +6 meses */
export function currentAnniversaryWindow(hireDate, onDate = new Date()) {
  const hd = dayjs.utc(hireDate);
  const today = dayjs.utc(onDate);
  if (!hd.isValid()) return null;

  const thisYearAnniv = hd.year(today.year());
  const start = today.isSameOrAfter(thisYearAnniv) ? thisYearAnniv : thisYearAnniv.subtract(1, 'year');
  const end = start.add(6, 'month'); // LFT: 6 meses para disfrutarlas
  return { start: start.toDate(), end: end.toDate() };
}

/** Días de derecho del ciclo vigente (del año que se cumple) */
export function currentEntitlementDays(hireDate, onDate = new Date()) {
  const years = yearsOfService(hireDate, onDate) + 1; // derecho del año que se cumple
  return entitlementDaysByYearsMX(years);
}

/** ¿El rango [startDate, endDate] está dentro de la ventana de 6 meses del ciclo vigente? */
export function isWithinCurrentWindow(hireDate, startDate, endDate, onDate = new Date()) {
  const win = currentAnniversaryWindow(hireDate, onDate);
  if (!win) return false;
  const s = dayjs.utc(startDate);
  const e = dayjs.utc(endDate);
  return s.isSameOrAfter(win.start, 'day') && e.isSameOrBefore(win.end, 'day');
}
