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
 * La tabla está indexada por AÑOS COMPLETOS cumplidos.
 * 0 => 0, 1 => 12, 2 => 14, 3 => 16, 4 => 18, 5 => 20,
 * 6..10 => 22,24,26,28,30, 11+ => +2 cada bloque de 5 años.
 */
export function entitlementDaysByYearsMX(years) {
  if (years <= 0) return 0;          // aún no cumple 1 año
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

/**
 * Ventana del ciclo vigente (aniversario “vigente” + 6 meses)
 * - Antes del primer aniversario: la ventana empieza en el PRIMER aniversario (futura).
 * - Después: toma el último aniversario que ya ocurrió y suma 6 meses.
 */
export function currentAnniversaryWindow(hireDate, onDate = new Date()) {
  const hd = dayjs.utc(hireDate);
  const today = dayjs.utc(onDate);
  if (!hd.isValid()) return null;

  const firstAnniv = hd.add(1, 'year');

  // Si aún no llega el primer aniversario, la ventana no ha abierto;
  // devolvemos [primer aniversario, +6 meses] (ambas futuras).
  if (today.isBefore(firstAnniv, 'day')) {
    return {
      start: firstAnniv.toDate(),
      end: firstAnniv.add(6, 'month').toDate(),
    };
  }

  // Ya pasó el primer aniversario: usamos el último aniversario ocurrido (este año o el pasado)
  let start = hd.year(today.year()); // aniversario de este año
  if (today.isBefore(start, 'day')) {
    start = start.subtract(1, 'year'); // todavía no llega el de este año ⇒ usar el del año pasado
  }
  const end = start.add(6, 'month');
  return { start: start.toDate(), end: end.toDate() };
}

/**
 * Días de derecho del ciclo vigente.
 * IMPORTANTE: NO sumar +1. El derecho es por AÑOS COMPLETOS cumplidos.
 * Antes del primer aniversario => 0.
 */
export function currentEntitlementDays(hireDate, onDate = new Date()) {
  const yos = yearsOfService(hireDate, onDate); // 0 si aún no cumple 1 año
  return entitlementDaysByYearsMX(yos);
}

/** ¿El rango [startDate, endDate] está dentro de la ventana de 6 meses del ciclo vigente? */
export function isWithinCurrentWindow(hireDate, startDate, endDate, onDate = new Date()) {
  const win = currentAnniversaryWindow(hireDate, onDate);
  if (!win) return false;
  const s = dayjs.utc(startDate);
  const e = dayjs.utc(endDate);
  return s.isSameOrAfter(win.start, 'day') && e.isSameOrBefore(win.end, 'day');
}
