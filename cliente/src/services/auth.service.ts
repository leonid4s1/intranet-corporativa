// src/services/auth.service.ts
import axios, { AxiosError } from "axios";
import type { AuthResponse, LoginData, RegisterData, User, RefreshTokenResponse, VerificationResponse, ResendVerificationResponse } from '@/types/auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
});

// Tipo para errores que no requieren todos los campos de AuthResponse
interface ErrorResponse {
  success: false;
  message: string;
}

const handleApiError = (error: unknown): ErrorResponse => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    if (!axiosError.response) {
      return {
        success: false,
        message: 'Error de conexión. Verifique su conexión a internet'
      };
    }

    const { status, data } = axiosError.response;
    const responseData = data as Record<string, any>;

    if (Array.isArray(responseData?.errors)) {
      const errorMessages = responseData.errors
        .map((err: { msg: string, param?: string }) =>
          `• ${err.param || 'Error'}: ${err.msg}`
        )
        .join('\n');
      return {
        success: false,
        message: `Errores de validación:\n${errorMessages}`
      };
    }

    const defaultMessages: Record<number, string> = {
      400: 'Solicitud inválida',
      401: 'No autorizado',
      403: 'Acceso denegado',
      404: 'Recurso no encontrado',
      409: 'El email ya está registrado',
      422: 'Error de validación',
      429: 'Demasiadas solicitudes',
      500: 'Error interno del servidor'
    };

    return {
      success: false,
      message: responseData?.message || defaultMessages[status] || `Error del servidor (${status})`
    };
  }

  return {
    success: false,
    message: 'Error desconocido al procesar la solicitud'
  };
};

export const AuthService = {
  async login(credentials: LoginData): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      return {
        success: true,
        message: response.data.message || 'Inicio de sesión exitoso',
        user: response.data.user,
        token: response.data.token,
        refreshToken: response.data.refreshToken
      };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  },

  async sendVerificationEmail(email: string): Promise<{ success: boolean; message?: string }> {
    try {
      await api.post('/auth/send-verification-email', { email });
      return {
        success: true,
        message: 'Correo de verificación enviado'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async verifyEmail(token: string): Promise<VerificationResponse> {
    try {
      const response = await api.get(`/auth/verify-email/${token}`);

      if (response.status !== 200 || !response.data?.success) {
        throw new Error(response.data?.message || 'Error al verificar el email');
      }

      return {
        success: true,
        verified: true,
        message: response.data?.message || 'Email verificado exitosamente'
      };
    } catch (error) {
      const { message } = handleApiError(error);
      return {
        success: false,
        verified: false,
        message
      };
    }
  },

  async resendVerificationEmail(email: string): Promise<ResendVerificationResponse> {
    try {
      const response = await api.post('/auth/resend-verification', { email });
      return {
        success: true,
        sent: true,
        message: response.data?.message || 'Correo de verificación reenviado'
      };
    } catch (error) {
      const { message } = handleApiError(error);
      return {
        success: false,
        sent: false,
        message
      };
    }
  },

  async getProfile(token: string): Promise<User> {
    try {
      const response = await api.get<User>('/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  },

  async refreshToken(): Promise<RefreshTokenResponse> {
    try {
      // Configurar withCredentials para enviar cookies automáticamente
      const response = await api.post<RefreshTokenResponse>('/auth/refresh-token', {}, {
        withCredentials: true
      });

      if (!response.data.token) {
        throw new Error('El servidor no devolvió un token válido');
      }

      return {
        success: true,
        token: response.data.token,
        refreshToken: response.data.refreshToken || null,
        message: response.data.message || 'Token actualizado correctamente'
      };
    } catch (error) {
      console.error('Error en refreshToken:', error);
      return {
        success: false,
        message: handleApiError(error).message,
        token: null,
        refreshToken: null
      };
    }
  },


  async logout(): Promise<{ success: boolean; message?: string }> {
    try {
      await api.post('/auth/logout', null);
      return {
        success: true,
        message: 'Sesión cerrada correctamente'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async register(data: RegisterData): Promise<AuthResponse & { requiresEmailVerification: boolean }> {
    try {
      const response = await api.post<AuthResponse & { requiresEmailVerification: boolean }>('/auth/register', data);
      return {
        success: true,
        message: response.data.message || 'Registro exitoso',
        user: response.data.user,
        token: response.data.token,
        refreshToken: response.data.refreshToken,
        requiresEmailVerification: response.data.requiresEmailVerification
      };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message?: string }> {
    try {
      await api.post('/auth/forgot-password', { email });
      return {
        success: true,
        message: 'Correo de recuperación enviado'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    try {
      await api.post('/auth/reset-password', { token, password: newPassword });
      return {
        success: true,
        message: 'Contraseña actualizada correctamente'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateProfile(token: string, updateData: Partial<User>): Promise<User> {
    try {
      const response = await api.patch<User>('/auth/profile', updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }
};
