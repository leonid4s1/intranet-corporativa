// src/services/holiday.service.ts
import api from './api';

/* =========================
 * Tipos
 * ========================= */

export interface Holiday {
  id: string;
  name: string;
  date: string;         // YYYY-MM-DD
  recurring: boolean;
  description?: string;
  customId?: string;
}

export interface HolidayCreateData {
  name: string;
  date: string;         // YYYY-MM-DD o ISO
  recurring?: boolean;
  description?: string;
  customId?: string;
}

export type HolidayUpdateData = Partial<HolidayCreateData>;

type DeletedMeta = { id: string; name?: string; customId?: string };

export interface DeleteHolidayResponse {
  success: boolean;
  remaining: number;
  deleted?: DeletedMeta;
}

/* =========================
 * Constantes y helpers
 * ========================= */

const MIN_NAME_LENGTH = 3;
const DATE_FORMAT = 'YYYY-MM-DD';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function toMidnightUTC(isoOrYmd: string): string {
  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Formato de fecha inválido. Use ${DATE_FORMAT}`);
  }
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function normalizeHolidayError(error: unknown, action: string): Error {
  // Errores lanzados manualmente
  if (error instanceof Error && !(isRecord((error as unknown as { response?: unknown }).response))) {
    return error;
  }

  const axiosLike = error as { response?: { data?: unknown; status?: number } };
  const data = axiosLike.response?.data;

  let serverError: string | undefined;
  let details: unknown;

  if (isRecord(data)) {
    const errVal = data.error;
    const msgVal = data.message;
    if (typeof errVal === 'string') serverError = errVal;
    else if (typeof msgVal === 'string') serverError = msgVal;

    details = data.details;
  }

  let msg = `Error al ${action} día festivo`;
  if (serverError) msg += `: ${serverError}`;
  if (details) msg += ` (${JSON.stringify(details)})`;
  return new Error(msg);
}

function mapApiHoliday(h: unknown): Holiday | null {
  if (!isRecord(h)) return null;

  const id =
    (typeof h.id === 'string' && h.id) ||
    (typeof h._id === 'string' && h._id) ||
    '';

  const name = typeof h.name === 'string' ? h.name : '';
  const dateStr = typeof h.date === 'string' ? h.date : '';
  const recurring = Boolean(h.recurring);
  const description =
    typeof h.description === 'string' ? h.description : undefined;
  const customId =
    typeof h.customId === 'string' ? h.customId : undefined;

  if (!id || !name || !dateStr) return null;

  return {
    id,
    name,
    date: toMidnightUTC(dateStr),
    recurring,
    description,
    customId,
  };
}

/* =========================
 * Servicio
 * ========================= */

const holidayService = {
  /** Crear festivo */
  async createHoliday(payload: HolidayCreateData): Promise<Holiday> {
    try {
      const name = (payload.name ?? '').trim();
      if (!name || name.length < MIN_NAME_LENGTH) {
        throw new Error(`El nombre debe tener al menos ${MIN_NAME_LENGTH} caracteres`);
      }
      if (!payload.date) throw new Error('La fecha es obligatoria');

      const body: HolidayCreateData = {
        ...payload,
        name,
        date: toMidnightUTC(payload.date),
      };

      const { data } = await api.post<{ success: boolean; data?: unknown; error?: string }>(
        '/vacations/holidays',
        body
      );

      if (!data?.success || !data.data) {
        throw new Error(data?.error || 'No se pudo crear el festivo');
      }

      const mapped = mapApiHoliday(data.data);
      if (!mapped) throw new Error('Respuesta inválida del servidor al crear festivo');
      return mapped;
    } catch (e) {
      throw normalizeHolidayError(e, 'crear');
    }
  },

  /** Listar festivos */
  async getHolidays(startDate?: string, endDate?: string): Promise<Holiday[]> {
    try {
      const params =
        startDate && endDate
          ? {
              startDate,
              endDate,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : {};

      const { data } = await api.get<{ success: boolean; data?: unknown; error?: string }>(
        '/vacations/holidays',
        { params }
      );

      if (!data?.success || !data.data) {
        throw new Error(data?.error || 'No se pudieron obtener los festivos');
      }

      const arr = Array.isArray(data.data) ? data.data : [];
      return arr
        .map(mapApiHoliday)
        .filter((x): x is Holiday => x !== null);
    } catch (e) {
      throw normalizeHolidayError(e, 'obtener');
    }
  },

  /** Eliminar festivo */
  async deleteHoliday(identifier: string | { id?: string; customId?: string }): Promise<DeleteHolidayResponse> {
    try {
      const id = typeof identifier === 'string' ? identifier : (identifier.id || identifier.customId);
      if (!id) throw new Error('Identificador de festivo inválido');

      const { data } = await api.delete<{
        success: boolean;
        data?: { deleted: DeletedMeta; remaining: number };
        error?: string;
        suggestions?: Array<{ id?: string; name?: string }>;
      }>(`/vacations/holidays/${encodeURIComponent(id)}`, {
        validateStatus: (s) => s < 500, // tratar 4xx como respuesta manejable
      });

      if (data?.success && data?.data) {
        return {
          success: true,
          remaining: data.data.remaining,
          deleted: data.data.deleted,
        };
      }

      let msg = data?.error || 'No se pudo eliminar el día festivo';
      if (Array.isArray(data?.suggestions) && data!.suggestions.length > 0) {
        const names = data!.suggestions.map((s) => s?.name || 'sin nombre').join(', ');
        msg += `. Sugerencias: ${names}`;
      }
      throw new Error(msg);
    } catch (e) {
      throw normalizeHolidayError(e, 'eliminar');
    }
  },

  /** Actualizar festivo (PATCH) */
  async updateHoliday(holidayId: string, patch: HolidayUpdateData): Promise<Holiday> {
    try {
      const body: HolidayUpdateData = { ...patch };

      if (typeof body.name === 'string') {
        body.name = body.name.trim();
        if (body.name.length > 0 && body.name.length < MIN_NAME_LENGTH) {
          throw new Error(`El nombre debe tener al menos ${MIN_NAME_LENGTH} caracteres`);
        }
      }

      if (typeof body.date === 'string') {
        body.date = toMidnightUTC(body.date);
      }

      const { data } = await api.patch<{ success: boolean; data?: unknown; error?: string }>(
        `/vacations/holidays/${encodeURIComponent(holidayId)}`,
        body
      );

      if (!data?.success || !data.data) {
        throw new Error(data?.error || 'No se pudo actualizar el festivo');
      }

      const mapped = mapApiHoliday(data.data);
      if (!mapped) throw new Error('Respuesta inválida del servidor al actualizar festivo');
      return mapped;
    } catch (e) {
      throw normalizeHolidayError(e, 'actualizar');
    }
  },
};

export default holidayService;
