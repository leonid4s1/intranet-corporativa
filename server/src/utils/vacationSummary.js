// server/src/utils/vacationSummary.js

/**
 * Resume ventanas para pintar la tabla de admin.
 * - usedCurrent: usados de la ventana "current"
 * - remainingCurrent: restantes de "current"
 * - availableTotal: suma de restantes de ventanas NO vencidas + bono admin
 *
 * Acepta objetos de ventana con al menos: { label, days, used, start, end, expiresAt }.
 * Tolera estructuras legacy (por si viene remaining o label diferente).
 */
export function summarizeWindows(windows = [], adminBonus = 0) {
  const num = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const clampInt = (v) => Math.max(0, Math.floor(num(v, 0)));

  // Normaliza fechas a YYYY-MM-DD y compara en UTC
  const toISODateOnly = (v) => {
    if (!v) return undefined;
    if (typeof v === 'string') return v.slice(0, 10);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return undefined;
  };
  const toDateUTC = (ymd) => (ymd ? new Date(`${ymd}T00:00:00Z`) : undefined);
  const todayUTC = () => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  };

  // Restantes de una ventana: priority remaining (legacy) → (days - used)
  const remainingOf = (w) => {
    const fallback = Math.max(0, num(w?.days, 0) - num(w?.used, 0));
    const legacy = w?.remaining;
    return clampInt(legacy != null ? legacy : fallback);
  };

  // ¿Ventana no vencida? (hoy < expiresAt) — si no hay expiresAt, usamos end
  const isNotExpired = (w, today) => {
    const expYmd = toISODateOnly(w?.expiresAt) || toISODateOnly(w?.end);
    const exp = toDateUTC(expYmd);
    if (!exp) return true; // si no tenemos fecha, no descartamos
    return today.getTime() <= exp.getTime();
  };

  // Identifica ventana "current" (label 'current'); tolera textos legacy
  const isCurrent = (w) =>
    w?.label === 'current' ||
    w?.isCurrent === true ||
    (typeof w?.label === 'string' && /curso|current/i.test(w.label));

  const current =
    Array.isArray(windows) && windows.length
      ? windows.find(isCurrent) ?? windows[0]
      : undefined;

  const today = todayUTC();

  // availableTotal = suma de restantes de ventanas NO vencidas + bono admin
  const baseRemaining = Array.isArray(windows)
    ? windows.reduce((acc, w) => {
        if (!w) return acc;
        return isNotExpired(w, today) ? acc + remainingOf(w) : acc;
      }, 0)
    : 0;

  const availableTotal = clampInt(baseRemaining + adminBonus);

  return {
    // USADOS (año en curso)
    usedCurrent: clampInt(current?.used),
    // DISPONIBLES (restantes año en curso)
    remainingCurrent: remainingOf(current || {}),
    // TOTALES (Disponible total = suma de restantes (no vencidas) + bono)
    availableTotal,
  };
}
