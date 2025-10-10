// server/src/utils/vacationLawMX.js
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
dayjs.extend(utc);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

/* =========================
 * Helpers
 * ========================= */

/** Devuelve el “aniversario seguro” en UTC para un año dado (ajusta 29-feb en no bisiestos). */
function safeAnniversaryUTC(hire, year) {
  const hd = dayjs.utc(hire);
  // base = primer día del mes de ingreso en 'year'
  const base = dayjs.utc(new Date(Date.UTC(year, hd.month(), 1)));
  const lastDay = base.endOf('month').date();
  const day = Math.min(hd.date(), lastDay);
  return base.date(day); // Dayjs (UTC)
}

/* =========================
 * LFT MX 2023
 * ========================= */

/**
 * Días de derecho por años de servicio completados.
 * 0 => 0, 1 => 12, 2 => 14, 3 => 16, 4 => 18, 5 => 20,
 * 6..10 => 22,24,26,28,30, 11+ => +2 cada bloque de 5 años.
 */
export function entitlementDaysByYearsMX(years) {
  if (years <= 0) return 0;
  if (years === 1) return 12;
  if (years === 2) return 14;
  if (years === 3) return 16;
  if (years === 4) return 18;
  if (years === 5) return 20;
  if (years <= 10) return 20 + (years - 5) * 2; // 6..10 => 22..30
  const blocksAfter10 = Math.floor((years - 11) / 5) + 1; // 11–15 -> 1; 16–20 -> 2; ...
  return 30 + blocksAfter10 * 2; // 11–15 => 32; 16–20 => 34; …
}

/** Años de servicio completos al 'onDate' (comparación por día en UTC). */
export function yearsOfService(hireDate, onDate = new Date()) {
  const hd = dayjs.utc(hireDate);
  const d = dayjs.utc(onDate);
  if (!hd.isValid() || !d.isValid()) return 0;

  let yrs = d.year() - hd.year();
  // aniversario “seguro” de este año
  const annivThisYear = safeAnniversaryUTC(hd, d.year());
  if (d.isBefore(annivThisYear, 'day')) yrs -= 1;
  return Math.max(0, yrs);
}

/**
 * Ventana NOMINAL del ciclo vigente:
 *  - start: aniversario más reciente (o el primero, si aún no llega)
 *  - end:   start + 1 año - 1 día
 * La VIGENCIA real de 18 meses (start + 18m) se calcula en el service.
 * Antes del primer aniversario: devuelve [primer aniversario, primer aniversario + 1y - 1d] (ambas futuras).
 */
export function currentAnniversaryWindow(hireDate, onDate = new Date()) {
  const hd = dayjs.utc(hireDate);
  const today = dayjs.utc(onDate);
  if (!hd.isValid()) return null;

  const firstAnniv = safeAnniversaryUTC(hd, hd.year() + 1);
  if (today.isBefore(firstAnniv, 'day')) {
    return {
      start: firstAnniv.toDate(),
      end: firstAnniv.add(1, 'year').subtract(1, 'day').toDate(),
    };
  }

  // último aniversario que ya ocurrió (este año o el pasado)
  let start = safeAnniversaryUTC(hd, today.year());
  if (today.isBefore(start, 'day')) start = safeAnniversaryUTC(hd, today.year() - 1);

  const end = start.add(1, 'year').subtract(1, 'day');
  return { start: start.toDate(), end: end.toDate() };
}

/**
 * Derecho del ciclo vigente (en el aniversario N corresponde el derecho N).
 * Antes del primer aniversario => 0.
 */
export function currentEntitlementDays(hireDate, onDate = new Date()) {
  const yos = yearsOfService(hireDate, onDate);
  return entitlementDaysByYearsMX(yos);
}

/** ¿[startDate, endDate] está dentro de la ventana nominal vigente (1 año)? */
export function isWithinCurrentWindow(hireDate, startDate, endDate, onDate = new Date()) {
  const win = currentAnniversaryWindow(hireDate, onDate);
  if (!win) return false;
  const s = dayjs.utc(startDate);
  const e = dayjs.utc(endDate);
  return s.isSameOrAfter(win.start, 'day') && e.isSameOrBefore(win.end, 'day');
}
