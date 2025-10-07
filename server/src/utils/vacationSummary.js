// server/src/utils/vacationSummary.js
export function summarizeWindows(windows = [], adminBonus = 0) {
  const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;

  const remainingOf = (w) =>
    num(w?.remaining, num(w?.days, 0) - num(w?.used, 0));

  const isCurrent = (w) => w?.isCurrent || w?.label === 'Año en curso';
  const current = windows.find(isCurrent) ?? windows[0];

  const availableTotal =
    windows.reduce((acc, w) => acc + remainingOf(w), 0) + num(adminBonus, 0);

  return {
    usedCurrent: num(current?.used, 0),       // USADOS (año en curso)
    remainingCurrent: remainingOf(current),   // DISP.  (restantes año en curso)
    availableTotal                            // TOTALES (Disponible total = suma de restantes + bono)
  };
}
