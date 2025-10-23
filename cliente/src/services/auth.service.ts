// src/services/auth.service.ts
import { isAxiosError } from 'axios';
import api from '@/services/api';
import type {
  AuthResponse,
  LoginData,
  RegisterData,                // ✅ usamos registro para crear usuarios (admin o público si habilitado)
  User,
  RefreshTokenResponse,
  VerificationResponse,
  ResendVerificationResponse,
  RegisterResponse,
} from '@/types/auth';

/* ========= Helpers de tipo/guards ========= */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function get<T = unknown>(o: Record<string, unknown>, k: string): T | undefined {
  return o[k] as T | undefined;
}
function toStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function toArr(v: unknown): unknown[] | undefined {
  return Array.isArray(v) ? Array.from(v) : undefined;
}

/* ========= Normalización de fechas ========= */
const toISODate = (d?: string | Date | null): string | undefined => {
  if (!d) return undefined;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return undefined;
  // formateo YYYY-MM-DD
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/* ========= Manejo de errores uniforme ========= */
interface ErrorResponse {
  success: false;
  message: string;
}

const handleApiError = (error: unknown): ErrorResponse => {
  // 👇 Mensaje claro si fue timeout de Axios
  if (isAxiosError(error) && error.code === 'ECONNABORTED') {
    return { success: false, message: 'La operación tardó más de lo esperado. Inténtalo de nuevo.' };
  }

  if (!isAxiosError(error)) {
    return { success: false, message: 'Error desconocido al procesar la solicitud' };
  }
  if (!error.response) {
    return { success: false, message: 'Error de conexión. Verifica tu internet' };
  }

  const status = error.response.status;
  const data = error.response.data as unknown;

  if (isRecord(data)) {
    const errors = toArr(get(data, 'errors'));
    if (errors) {
      const msg = errors
        .map((e) => (isRecord(e) ? `• ${toStr(get(e, 'param')) ?? 'Error'}: ${toStr(get(e, 'msg')) ?? ''}` : ''))
        .filter(Boolean)
        .join('\n');
      return { success: false, message: msg || 'Errores de validación' };
    }
  }

  const defaultMessages: Record<number, string> = {
    400: 'Solicitud inválida',
    401: 'No autorizado',
    403: 'Acceso denegado',
    404: 'Recurso no encontrado',
    409: 'El email ya está registrado',
    422: 'Error de validación',
    429: 'Demasiadas solicitudes',
    500: 'Error interno del servidor',
  };

  const serverMsg =
    (isRecord(data) && toStr(get(data, 'message'))) ||
    defaultMessages[status] ||
    `Error del servidor (${status})`;

  return { success: false, message: serverMsg };
};

/* ========= Tipos de respuesta locales (compatibles) ========= */
type LoginResponseWire = {
  success?: boolean;
  message?: string;
  user: User;
  accessToken?: string; // backend nuevo
  token?: string;       // compat antiguo
};

type RegisterResponseWire = {
  success?: boolean;
  message?: string;
  user: User;
  requiresEmailVerification?: boolean;
  accessToken?: string;
  token?: string;
};

type RefreshResponseWire = {
  accessToken?: string;
  token?: string; // compat
  user?: User;
  message?: string;
};

type ResendResponseWire = {
  success: boolean;
  message?: string;
};

/* ========= Servicio de Autenticación ========= */
export const AuthService = {
  /* POST /api/auth/login */
  async login(credentials: LoginData): Promise<AuthResponse> {
    try {
      const { data } = await api.post<LoginResponseWire>('/auth/login', credentials);
      return {
        success: true,
        message: data.message ?? 'Inicio de sesión exitoso',
        user: data.user,
        token: data.accessToken ?? data.token ?? null,
        refreshToken: null, // el refresh va por cookie HttpOnly; no lo exponemos en cliente
      };
    } catch (error: unknown) {
      // ⬇️ Mapeo explícito para mostrar mensajes claros en el formulario
      if (isAxiosError(error) && error.response) {
        const status = error.response.status;
        const serverMsg = isRecord(error.response.data)
          ? toStr(get(error.response.data as Record<string, unknown>, 'message'))
          : undefined;

        if (status === 401) {
          // Credenciales inválidas (usuario existe pero password incorrecta)
          throw new Error(serverMsg || 'Contraseña incorrecta');
        }
        if (status === 404) {
          // Usuario no encontrado
          throw new Error(serverMsg || 'Usuario no encontrado');
        }
        if (status === 403) {
          // Cuenta no verificada/bloqueada/inactiva
          throw new Error(serverMsg || 'No puedes iniciar sesión: verifica tu correo o contacta al administrador');
        }
      }
      // Resto de errores: usa el manejador genérico
      throw new Error(handleApiError(error).message);
    }
  },

  /* ✅ POST /api/auth/register
     Úsalo en el modal de "Crear usuario" (admin) o en registro público si lo habilitas */
  async register(payload: RegisterData): Promise<RegisterResponse> {
    try {
      const body = {
        name: payload.name?.trim(),
        email: payload.email?.trim().toLowerCase(),
        password: payload.password,
        password_confirmation: payload.password_confirmation,
        ...(payload.terms_accepted != null ? { terms_accepted: !!payload.terms_accepted } : {}),

        // 👇 nuevos campos (solo si vienen con valor)
        ...(payload.position?.trim() ? { position: payload.position.trim() } : {}),
        ...(toISODate(payload.birthDate) ? { birthDate: toISODate(payload.birthDate) } : {}),
        ...(toISODate(payload.hireDate) ? { hireDate: toISODate(payload.hireDate) } : {}),
      };

      const { data } = await api.post<RegisterResponseWire>('/auth/register', body);

      return {
        success: !!data?.user,
        message: data?.message ?? 'Usuario creado correctamente',
        user: data.user,
        token: data.accessToken ?? data.token ?? null,
        refreshToken: null,
        requiresEmailVerification: !!data?.requiresEmailVerification,
      };
    } catch (error: unknown) {
      // Deja caer mensajes de validación de backend
      throw new Error(handleApiError(error).message);
    }
  },

  /* POST /api/auth/resend-verification */
  async resendVerificationEmail(email: string): Promise<ResendVerificationResponse> {
    try {
      // Puede tardar si el backend aún espera al proveedor de email
      const { data } = await api.post<ResendResponseWire>(
        '/auth/resend-verification',
        { email },
        { timeout: 30000 } // opcional: ampliar solo aquí
      );
      return {
        success: !!data?.success,
        sent: !!data?.success,
        message: data?.message ?? (data?.success ? 'Correo de verificación reenviado' : 'No se pudo reenviar'),
      };
    } catch (error: unknown) {
      const { message } = handleApiError(error);
      return { success: false, sent: false, message };
    }
  },

  /* (Info) GET /api/auth/verify-email/:token
     Tu backend redirige al frontend, por lo que llamar esto vía XHR no es útil. */
  async verifyEmail(token: string): Promise<VerificationResponse> {
    void token; // evita 'no-unused-vars' sin ejecutar nada
    return {
      success: false,
      verified: false,
      message: 'Usa el enlace del correo (flujo por URL) para verificar tu email.',
    };
  },

  /* GET /api/auth/me */
  async getProfile(token?: string): Promise<User> {
    try {
      const { data } = await api.get<{ success?: boolean; user: User }>('/auth/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { _t: Date.now() },
      });
      return data.user;
    } catch (error: unknown) {
      throw new Error(handleApiError(error).message);
    }
  },

  /* POST /api/auth/refresh (usa cookie HttpOnly) */
  async refreshToken(): Promise<RefreshTokenResponse> {
    try {
      const { data } = await api.post<RefreshResponseWire>('/auth/refresh', {});
      const token = data.accessToken ?? data.token ?? null;
      return {
        success: !!token,
        token,
        refreshToken: null, // no se usa en cliente
        message: token ? (data.message ?? 'Token actualizado correctamente') : (data.message ?? 'No se recibió token'),
        ...(data.user ? { user: data.user } : {}),
      } as RefreshTokenResponse;
    } catch (error: unknown) {
      return {
        success: false,
        token: null,
        refreshToken: null,
        message: handleApiError(error).message,
      };
    }
  },

  /* POST /api/auth/logout */
  async logout(): Promise<{ success: boolean; message?: string }> {
    try {
      await api.post('/auth/logout', {});
      return { success: true, message: 'Sesión cerrada correctamente' };
    } catch (error: unknown) {
      return handleApiError(error);
    }
  },

    /* POST /api/auth/change-password */
  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await api.post<{ ok?: boolean; message?: string; error?: string }>(
        '/auth/change-password',
        payload
      );
      return {
        success: !!(data?.ok ?? true),
        message: data?.message ?? 'Contraseña actualizada correctamente',
      };
    } catch (error: unknown) {
      const { message } = handleApiError(error);
      return { success: false, message };
    }
  },

  /* Opcionales (si los implementas en backend) */
  async forgotPassword(email: string): Promise<{ success: boolean; message?: string }> {
    try {
      await api.post('/auth/forgot-password', { email });
      return { success: true, message: 'Correo de recuperación enviado' };
    } catch (error: unknown) {
      return handleApiError(error);
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    try {
      await api.post('/auth/reset-password', { token, password: newPassword });
      return { success: true, message: 'Contraseña actualizada correctamente' };
    } catch (error: unknown) {
      return handleApiError(error);
    }
  },

  async updateProfile(token: string, updateData: Partial<User> | FormData): Promise<User> {
    try {
      const isFormData = typeof FormData !== 'undefined' && updateData instanceof FormData;

      // Normaliza fechas si NO es FormData y vienen como strings/Date
      let body: Partial<User> | FormData = updateData;
      if (!isFormData && isRecord(updateData)) {
        const u = updateData as Partial<User>;
        body = {
          ...u,
          ...(u.birthDate ? { birthDate: toISODate(u.birthDate) } : {}),
          ...(u.hireDate ? { hireDate: toISODate(u.hireDate) } : {}),
          ...(u.position ? { position: String(u.position).trim() } : {}),
        };
      }

      const { data } = await api.patch<{ user: User }>('/auth/profile', body, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(isFormData ? { 'Content-Type': 'multipart/form-data' } : {}),
        },
      });
      return data.user;
    } catch (error: unknown) {
      throw new Error(handleApiError(error).message);
    }
  },
};

export default AuthService;
