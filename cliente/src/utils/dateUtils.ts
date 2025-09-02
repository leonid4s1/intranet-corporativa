import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isBetween from 'dayjs/plugin/isBetween';

// Extender dayjs con plugins necesarios
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(isBetween);

/**
 * Interfaz para representar un día festivo
 */
export interface Holiday {
  date: string; // Formato YYYY-MM-DD
  name: string;
}

/**
 * Interfaz para representar un día del calendario
 */
export interface CalendarDay {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  isApproved: boolean;
  isPending: boolean;
  isOtherUserVacation: boolean;
  isUnavailable: boolean;
  isAvailable: boolean;
  availableCounter: number | null;
  otherUserName: string;
  vacationReason: string;
}

/**
 * Calcula los días hábiles entre dos fechas, excluyendo fines de semana y días festivos
 * @param start - Fecha de inicio (dayjs)
 * @param end - Fecha de fin (dayjs)
 * @param holidays - Array de fechas de días festivos en formato YYYY-MM-DD
 * @returns Número de días hábiles entre las fechas
 */
export function calculateBusinessDays(
  start: dayjs.Dayjs,
  end: dayjs.Dayjs,
  holidays: string[] = []
): number {
  let count = 0;
  let current = start.clone();

  // Asegurarse de que start <= end
  if (start.isAfter(end)) {
    [start, end] = [end, start];
    current = start.clone();
  }

  while (current.isSameOrBefore(end)) {
    if (!isWeekend(current) && !holidays.includes(current.format('YYYY-MM-DD'))) {
      count++;
    }
    current = current.add(1, 'day');
  }

  return count;
}

/**
 * Determina si una fecha cae en fin de semana
 * @param date - Fecha a evaluar (dayjs)
 * @returns true si es fin de semana (sábado o domingo)
 */
export function isWeekend(date: dayjs.Dayjs): boolean {
  return date.day() === 0 || date.day() === 6;
}

/**
 * Genera un array de días para mostrar en el calendario
 * @param startDate - Fecha de inicio del mes (dayjs)
 * @param holidays - Array de días festivos
 * @returns Array de CalendarDay para el mes y semanas circundantes
 */
export function generateMonthDays(
  startDate: dayjs.Dayjs,
  holidays: Holiday[] = []
): CalendarDay[] {
  const startOfMonth = startDate.startOf('month');
  const endOfMonth = startDate.endOf('month');
  const startDay = startOfMonth.startOf('week');
  const endDay = endOfMonth.endOf('week');

  const days: CalendarDay[] = [];
  let currentDay = startDay;

  while (currentDay.isSameOrBefore(endDay)) {
    const dateStr = currentDay.format('YYYY-MM-DD');
    const holiday = holidays.find(h => h.date === dateStr);

    days.push({
      date: dateStr,
      day: currentDay.date(),
      isCurrentMonth: currentDay.isSame(startDate, 'month'),
      isWeekend: isWeekend(currentDay),
      isHoliday: !!holiday,
      isApproved: false, // Estos valores se deben establecer después
      isPending: false,
      isOtherUserVacation: false,
      isUnavailable: false,
      isAvailable: false,
      availableCounter: null,
      otherUserName: '',
      vacationReason: holiday?.name || ''
    });

    currentDay = currentDay.add(1, 'day');
  }

  return days;
}

/**
 * Formatea una fecha en un string legible
 * @param date - Fecha a formatear (string o dayjs)
 * @param format - Formato deseado (por defecto 'DD/MM/YYYY')
 * @returns String con la fecha formateada
 */
export function formatDate(
  date: string | dayjs.Dayjs,
  format = 'DD/MM/YYYY'
): string {
  return dayjs(date).format(format);
}

/**
 * Valida si un rango de fechas es válido
 * @param start - Fecha de inicio
 * @param end - Fecha de fin
 * @returns true si el rango es válido (start <= end y ambas fechas son válidas)
 */
export function isValidDateRange(
  start: string | dayjs.Dayjs,
  end: string | dayjs.Dayjs
): boolean {
  const startDate = dayjs(start);
  const endDate = dayjs(end);

  return startDate.isValid() &&
         endDate.isValid() &&
         (startDate.isBefore(endDate) || startDate.isSame(endDate));
}

/**
 * Obtiene el número de días naturales entre dos fechas
 * @param start - Fecha de inicio
 * @param end - Fecha de fin
 * @returns Número de días naturales (incluyendo fines de semana y festivos)
 */
export function calculateNaturalDays(
  start: dayjs.Dayjs,
  end: dayjs.Dayjs
): number {
  return end.diff(start, 'day') + 1;
}

/**
 * Verifica si una fecha está en el pasado
 * @param date - Fecha a verificar
 * @returns true si la fecha es anterior al día actual
 */
export function isPastDate(date: string | dayjs.Dayjs): boolean {
  return dayjs(date).isBefore(dayjs(), 'day');
}

/**
 * Obtiene el nombre del mes en español
 * @param monthIndex - Índice del mes (0-11)
 * @returns Nombre del mes en español
 */
export function getMonthName(monthIndex: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[monthIndex] || '';
}

/**
 * Obtiene el nombre abreviado del día de la semana
 * @param dayIndex - Índice del día (0-6, 0=domingo)
 * @returns Nombre abreviado del día (Dom, Lun, etc.)
 */
export function getShortDayName(dayIndex: number): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return days[dayIndex] || '';
}
