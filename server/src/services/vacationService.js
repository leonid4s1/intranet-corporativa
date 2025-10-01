// server/src/services/vacationService.js
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc);

import VacationRequest from '../models/VacationRequest.js';
import { currentAnniversaryWindow } from '../utils/vacationLawMX.js';

/**
 * Suma de días usados en el ciclo vigente (LFT) por usuario
 * - Cuenta solicitudes 'approved' que crucen con la ventana actual.
 * - Recorta rangos a la ventana.
 * - Usa r.days si existe; si no, calcula por días naturales.
 */
export async function getUsedDaysInCurrentCycle(userId, hireDate, { preferFieldDays = true } = {}) {
  const win = currentAnniversaryWindow(hireDate);
  if (!win) return 0;

  const q = {
    userId,
    status: 'approved',
    startDate: { $lte: win.end }, // comienzan antes de que termine la ventana
    endDate: { $gte: win.start }, // terminan después de que comienza la ventana
  };

  const reqs = await VacationRequest.find(q).lean();

  let sum = 0;
  for (const r of reqs) {
    const sFull = dayjs.utc(r.startDate);
    const eFull = dayjs.utc(r.endDate);
    const s = sFull.isBefore(win.start) ? dayjs.utc(win.start) : sFull;
    const e = eFull.isAfter(win.end) ? dayjs.utc(win.end) : eFull;
    if (e.isBefore(s, 'day')) continue;

    if (preferFieldDays && r.days != null) {
      // Ajuste proporcional si recortamos el rango original
      const naturalRecortado = e.diff(s, 'day') + 1;
      const naturalOriginal = eFull.diff(sFull, 'day') + 1;
      const factor = naturalOriginal > 0 ? naturalRecortado / naturalOriginal : 1;
      sum += Math.round(r.days * factor);
    } else {
      sum += e.diff(s, 'day') + 1; // naturales
    }
  }
  return sum;
}
