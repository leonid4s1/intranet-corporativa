// src/services/holiday.service.ts
import api from "./api";

interface HolidayBase {
  id: string;
  name: string;
  date: string;
  recurring: boolean;
  description?: string;
  customId?: string;
}

interface Holiday extends HolidayBase {
  id: string;
  date: string; // ISO format
}

interface HolidayCreateData {
  name: string;
  date: string; // YYYY-MM-DD or ISO
  recurring?: boolean;
  description?: string;
  customId?: string;
}

interface HolidayUpdateData extends Partial<HolidayCreateData> {
  id: string;
}

interface DeleteHolidayResponse {
  success: boolean;
  remaining: number;
  deletedHoliday?: Pick<Holiday, 'id' | 'name' | 'date'>;
}

interface ApiError {
  error?: string;
  details?: Record<string, unknown>;
  suggestions?: Array<Pick<Holiday, 'id' | 'name'>>;
}

const MIN_NAME_LENGTH = 5;
const DATE_FORMAT = 'YYYY-MM-DD';

// Función helper para normalizar errores (ahora fuera del objeto)
function normalizeHolidayError(error: unknown, action: string): Error {
  // Error de validación manual
  if (error instanceof Error && !('response' in error)) {
    return error;
  }

  // Error de Axios
  const axiosError = error as { response?: { data?: ApiError } };
  const serverError = axiosError.response?.data?.error;
  const details = axiosError.response?.data?.details;

  let errorMessage = `Error al ${action} día festivo`;
  if (serverError) errorMessage += `: ${serverError}`;
  if (details) errorMessage += ` (${JSON.stringify(details)})`;

  return new Error(errorMessage);
}

const holidayService = {
  /**
   * Crea un nuevo día festivo
   * @throws {Error} Con mensaje descriptivo cuando falla
   */
  async createHoliday(data: HolidayCreateData): Promise<Holiday> {
    try {
      // Validación avanzada del frontend
      if (!data.name?.trim() || data.name.trim().length < MIN_NAME_LENGTH) {
        throw new Error(`El nombre debe tener al menos ${MIN_NAME_LENGTH} caracteres`);
      }

      if (!data.date) {
        throw new Error('La fecha es obligatoria');
      }

      const dateObj = new Date(data.date);
      if (isNaN(dateObj.getTime())) {
        throw new Error(`Formato de fecha inválido. Use ${DATE_FORMAT}`);
      }

      // Ajustar a medianoche UTC
      dateObj.setUTCHours(0, 0, 0, 0);

      // Normalización de datos
      const payload = {
        ...data,
        date: dateObj.toISOString().split('T')[0], // Ensure YYYY-MM-DD
        name: data.name.trim()
      };

      const response = await api.post<{ data: Holiday; error?: string }>(
        '/vacations/holidays',
        payload
      );

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      // Ajustar fecha recibida a medianoche UTC para evitar desfase
      const returnedDate = new Date(response.data.data.date);
      returnedDate.setUTCHours(0, 0, 0, 0);

      return {
        ...response.data.data,
        date: returnedDate.toISOString().split('T')[0] // Ensure ISO format
      };
    } catch (error: unknown) {
      throw normalizeHolidayError(error, 'crear');
    }
  },

  /**
   * Obtiene días festivos en un rango de fechas
   */
  async getHolidays(startDate?: string, endDate?: string): Promise<Holiday[]> {
    try {
      const params = startDate && endDate ? {
        startDate,
        endDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      } : {};

      const response = await api.get<{ data: Holiday[]; error?: string }>(
        '/vacations/holidays',
        { params }
      );

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      return response.data.data.map(holiday => {
        const d = new Date(holiday.date);
        d.setUTCHours(0, 0, 0, 0);
        return {
          ...holiday,
          date: d.toISOString().split('T')[0]
        };
      });
    } catch (error: unknown) {
      throw normalizeHolidayError(error, 'obtener');
    }
  },

  /**
   * Elimina un día festivo por ID, customId u objeto Holiday
   * @returns Información sobre la operación y conteo restante
   */
  async deleteHoliday(
    identifier: string | Pick<Holiday, 'id' | 'customId'>
  ): Promise<DeleteHolidayResponse> {
    try {
      const id = typeof identifier === 'string'
        ? identifier
        : identifier.id || identifier.customId;

      if (!id) {
        throw new Error('Identificador de festivo inválido');
      }

      const response = await api.delete<DeleteHolidayResponse & ApiError>(
        `/vacations/holidays/${encodeURIComponent(id)}`,
        { validateStatus: status => status < 500 }
      );

      if (response.data.success) {
        return response.data;
      }

      // Manejo de errores estructurado
      const { error, suggestions } = response.data;
      let errorMessage = error || 'No se pudo eliminar el día festivo';

      if (suggestions?.length) {
        const safeNames = suggestions.map(s => s?.name || 'sin nombre');
        errorMessage += `. Sugerencias: ${safeNames.join(', ')}`;
      }

      throw new Error(errorMessage);
    } catch (error: unknown) {
      throw normalizeHolidayError(error, 'eliminar');
    }
  },

  /**
   * Actualiza un día festivo existente
   */
  async updateHoliday(
    holidayId: string,
    data: HolidayUpdateData
  ): Promise<Holiday> {
    try {
      // Validación de fecha
      if (data.date) {
        const dateObj = new Date(data.date);
        if (isNaN(dateObj.getTime())) {
          throw new Error(`Formato de fecha inválido. Use ${DATE_FORMAT}`);
        }
        // Ajustar a medianoche UTC
        dateObj.setUTCHours(0, 0, 0, 0);
        data.date = dateObj.toISOString().split('T')[0];
      }

      // Validación de nombre
      if (data.name && data.name.trim().length < MIN_NAME_LENGTH) {
        throw new Error(`El nombre debe tener al menos ${MIN_NAME_LENGTH} caracteres`);
      }

      const response = await api.put<{ data: Holiday; error?: string }>(
        `/vacations/holidays/${holidayId}`,
        data
      );

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const returnedDate = new Date(response.data.data.date);
      returnedDate.setUTCHours(0, 0, 0, 0);

      return {
        ...response.data.data,
        date: returnedDate.toISOString().split('T')[0]
      };
    } catch (error: unknown) {
      throw normalizeHolidayError(error, 'actualizar');
    }
  }
};

export default holidayService;
export type { Holiday, HolidayCreateData, HolidayUpdateData, DeleteHolidayResponse };
