// src/services/auth.service.ts
import { isAxiosError } from 'axios';
import api from '@/services/api';
import type {
  AuthResponse,
  LoginData,
  // RegisterData,  // ⛔️ ya no se usa (registro público deshabilitado)
  User,
  RefreshTokenResponse,
  VerificationResponse,
  ResendVerificationResponse,
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
  return Array.isArray(v) ? v : undefined;
}

/* ========= Manejo de errores uniforme ========= */
interface ErrorResponse {
  success: false;
  message: string;
}

const handleApiError = (error: unknown): ErrorResponse => {
  if (!isAxiosError(error)) {
    return { success: false, message: 'Error desconocido al procesar la solicitud' };
  }
  if (!error.response) {
    return { success: false, message: 'Error de conexión. Verifique su conexión a internet' };
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

// ⛔️ RegisterResponseWire eliminado (registro público deshabilitado)

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
      throw new Error(handleApiError(error).message);
    }
  },

  /* POST /api/auth/resend-verification */
  async resendVerificationEmail(email: string): Promise<ResendVerificationResponse> {
    try {
      const { data } = await api.post<ResendResponseWire>('/auth/resend-verification', { email });
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

  // ⛔️ Registro público deshabilitado: usar createUserAsAdmin() en user.service.ts
  // async register(...) { ... },

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
      const { data } = await api.patch<{ user: User }>('/auth/profile', updateData, {
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
