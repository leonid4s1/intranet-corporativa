// src/services/auth.service.ts
import { isAxiosError } from 'axios';
import api from '@/services/api';
import type {
  AuthResponse,
  LoginData,
  RegisterData,
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

/* ========= Manejo de errores uniforme (sin any) ========= */
interface ErrorResponse {
  success: false;
  message: string;
}

const handleApiError = (error: unknown): ErrorResponse => {
  if (!isAxiosError(error)) {
    return { success: false, message: 'Error desconocido al procesar la solicitud' };
  }

  // Sin respuesta => problema de red / CORS
  if (!error.response) {
    return { success: false, message: 'Error de conexión. Verifique su conexión a internet' };
  }

  const status = error.response.status;
  const data = error.response.data as unknown;

  // Errores de validación tipo { errors: [{ msg, param? }, ...] }
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

/* ========= Servicio de Autenticación (usa api compartido) ========= */
export const AuthService = {
  /* POST /api/auth/login */
  async login(credentials: LoginData): Promise<AuthResponse> {
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', credentials);
      return {
        success: true,
        message: data.message ?? 'Inicio de sesión exitoso',
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
      };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  },

  /* POST /api/auth/send-verification-email */
  async sendVerificationEmail(email: string): Promise<{ success: boolean; message?: string }> {
    try {
      await api.post('/auth/send-verification-email', { email });
      return { success: true, message: 'Correo de verificación enviado' };
    } catch (error) {
      return handleApiError(error);
    }
  },

  /* GET /api/auth/verify-email/:token */
  async verifyEmail(token: string): Promise<VerificationResponse> {
    try {
      const { data, status } = await api.get<VerificationResponse>(`/auth/verify-email/${encodeURIComponent(token)}`);
      if (status !== 200 || !data?.success) {
        throw new Error(data?.message ?? 'Error al verificar el email');
      }
      return {
        success: true,
        verified: true,
        message: data?.message ?? 'Email verificado exitosamente',
      };
    } catch (error) {
      const { message } = handleApiError(error);
      return { success: false, verified: false, message };
    }
  },

  /* POST /api/auth/resend-verification */
  async resendVerificationEmail(email: string): Promise<ResendVerificationResponse> {
    try {
      const { data } = await api.post<ResendVerificationResponse>('/auth/resend-verification', { email });
      return {
        success: true,
        sent: true,
        message: data?.message ?? 'Correo de verificación reenviado',
      };
    } catch (error) {
      const { message } = handleApiError(error);
      return { success: false, sent: false, message };
    }
  },

  /* GET /api/auth/profile  (si usas Bearer; si usas cookie httpOnly, puedes omitir el header) */
  async getProfile(token?: string): Promise<User> {
    try {
      const { data } = await api.get<User>('/auth/profile', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { _t: Date.now() }, // anti-cache
      });
      return data;
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  },

  /* POST /api/auth/refresh-token  (cookies httpOnly) */
  async refreshToken(): Promise<RefreshTokenResponse> {
    try {
      const { data } = await api.post<RefreshTokenResponse>('/auth/refresh-token', {});
      if (!data?.token) throw new Error('El servidor no devolvió un token válido');
      return {
        success: true,
        token: data.token,
        refreshToken: data.refreshToken ?? null,
        message: data.message ?? 'Token actualizado correctamente',
      };
    } catch (error) {
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
      await api.post('/auth/logout', null);
      return { success: true, message: 'Sesión cerrada correctamente' };
    } catch (error) {
      return handleApiError(error);
    }
  },

  /* POST /api/auth/register */
  async register(data: RegisterData): Promise<AuthResponse & { requiresEmailVerification: boolean }> {
    try {
      const { data: res } = await api.post<AuthResponse & { requiresEmailVerification: boolean }>(
        '/auth/register',
        data
      );
      return {
        success: true,
        message: res.message ?? 'Registro exitoso',
        user: res.user,
        token: res.token,
        refreshToken: res.refreshToken,
        requiresEmailVerification: res.requiresEmailVerification,
      };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  },

  /* POST /api/auth/forgot-password */
  async forgotPassword(email: string): Promise<{ success: boolean; message?: string }> {
    try {
      await api.post('/auth/forgot-password', { email });
      return { success: true, message: 'Correo de recuperación enviado' };
    } catch (error) {
      return handleApiError(error);
    }
  },

  /* POST /api/auth/reset-password */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    try {
      await api.post('/auth/reset-password', { token, password: newPassword });
      return { success: true, message: 'Contraseña actualizada correctamente' };
    } catch (error) {
      return handleApiError(error);
    }
  },

  /* PATCH /api/auth/profile */
  async updateProfile(token: string, updateData: Partial<User>): Promise<User> {
    try {
      const { data } = await api.patch<User>('/auth/profile', updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  },
};

export default AuthService;
