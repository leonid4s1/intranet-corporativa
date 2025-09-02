// src/stores/auth.store.ts
import { defineStore } from "pinia";
import { AuthService } from "@/services/auth.service";
import type { AuthState, User, LoginData, RegisterData, VerificationResponse, ResendVerificationResponse } from "@/types/auth";
import Cookies from 'js-cookie';
import axios, { type AxiosError } from "axios";
import api, { apiService } from '@/services/api';
import router from "@/router";
import { isConstructorDeclaration } from "typescript";

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: Cookies.get('token') || null,
    refreshToken: Cookies.get('refreshToken') || null,
    returnUrl: undefined,
    isInitialized: false,
    isLoading: false,
    error: null
  }),

  actions: {
    async initialize(): Promise<void> {
      if (this.isInitialized) return;

      try {
        if (this.token) {
          await this.fetchUser();
        }
      } catch (error) {
        console.error("Error inicializando auth store:", error);
        this.clearAuth();
      } finally {
        this.isInitialized = true;
      }
    },

  async refreshAuth(): Promise<boolean> {
    if (!this.refreshToken) {
      console.error('No hay refreshToken disponible');
      return false;
    }

    try {
      const response = await AuthService.refreshToken();

      if (!response.success || !response.token) {
        throw new Error(response.message || 'Error al refrescar token');
      }

      // Actualizar ambos tokens
      this.setAuthData(
        this.user!,
        response.token,
        response.refreshToken || this.refreshToken
      );

      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      this.clearAuth();
      return false;
    }
  },
    async register(registerData: RegisterData): Promise<User> {
      this.isLoading = true;
      this.error = null;

      try {
        // Validaciones básicas
        if (!registerData.name?.trim()) {
          throw new Error('El nombre es requerido');
        }

        if (!registerData.email?.trim()) {
        throw new Error('El email es requerido');
        }

        if (!registerData.password) {
          throw new Error('La contraseña es requerida');
        }

        if (registerData.password !== registerData.password_confirmation) {
          throw new Error('Las contraseñas no coinciden');
        }

        const response = await AuthService.register({
          name: registerData.name.trim(),
          email: registerData.email.trim().toLowerCase(),
          password: registerData.password,
          password_confirmation: registerData.password_confirmation
        });

        console.log("Response registro", response);

        if (!response.success || !response.user) {
          throw new Error(response.message || 'Error en el registro');
        }

        // Solo redirigir sin establecer tokens si requiere verificación
        if (response.requiresEmailVerification) {
          await router.push({
            name: 'email-verification',
            query: { email: response.user.email }
          });
          return response.user;
        }

        // Si no requiere verificación, establecer sesión directamente
        if (response.token) {
          this.setAuthData(response.user, response.token, response.refreshToken ?? undefined);
        }

        return response.user;

      } catch (error) {
        console.error("[AuthStore] Error en registro:", error);

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          this.error = error.response?.data?.message ||
            (status === 400 ? 'Datos inválidos' :
            status === 409 ? 'El email ya está registrado' :
            'Error durante el registro');
        } else {
          this.error = error instanceof Error ? error.message : 'Error desconocido';
        }

        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async resendVerificationEmail(email: string): Promise<ResendVerificationResponse> {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await AuthService.resendVerificationEmail(email);

        if (!response.success) {
          throw new Error(response.message || 'Error al reenviar el correo');
        }

        return response;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          this.error = error.response?.data?.message || 'Error al reenviar el correo';
        } else if (error instanceof Error) {
          this.error = error.message;
        } else {
          this.error = 'Error desconocido al reenviar el correo';
        }

        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async verifyEmail(token: string): Promise<VerificationResponse> {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await AuthService.verifyEmail(token);
        console.log('Respuesta de verificación:', response); // Debug


        if (response.success && response.verified && this.user) {
          this.user.email_verified_at = new Date().toISOString();
        }

        await this.fetchUser();

        return {
          success: response.success,
          verified: response.verified,
          message: response.message || ''
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          this.error = error.response?.data?.message || 'Error al verificar el email';
        } else if (error instanceof Error) {
          this.error = error.message;
        } else {
          this.error = 'Error desconocido al verificar el email';
        }

        return {
          success: false,
          verified: false,
          message: this.error || 'Error desconocido'
        };
      } finally {
        this.isLoading = false;
      }
    },

    async fetchUser(): Promise<void> {
  if (!this.token) return;

  try {
    const response = await apiService.get<{ user: User }>('/auth/profile', {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Cache-Control': 'no-store'
      }
    });

    if (response?.data?.user) {
      this.user = {
        ...response.data.user,
        // Unificar campos de verificación
        email_verified_at: response.data.user.email_verified_at ||
                         (response.data.user.isVerified ? new Date().toISOString() : null)
      };
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);

    // Manejo específico de errores 401
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      this.clearAuth();
      await router.push({ name: 'login' });
    }

    throw error;
  }
},

async login(loginData: LoginData): Promise<User> {
  this.isLoading = true;
  this.error = null;

  try {
    const response = await AuthService.login(loginData);
    console.log('Login response:', response);

    if (!response.success) {
      throw new Error(response.message || 'Error en el login');
    }

    // Verificar que ambos tokens existen
    if (!response.token || !response.refreshToken) {
      throw new Error('No se recibieron tokens válidos');
    }

    // Establecer datos de autenticación
    this.setAuthData(response.user, response.token, response.refreshToken);

    // Verificación MEJORADA de cuenta
    const isVerified = response.user?.isVerified ||
                      !!response.user?.email_verified_at ||
                      (this.user ? this.user.isVerified ||
                        !!this.user.email_verified_at : false
                      );

    console.log('Estado de verificación:', {
      user: response.user,
      isVerified
    });

    // Redirección basada en estado de verificación
    if (!isVerified) {
      await router.push({
        name: 'email-verification',
        query: { email: response.user?.email }
      });
    } else {
      const redirectTo = this.returnUrl ||
                       (this.isAdmin ? { name: 'admin-dashboard' } : { name: 'home' });
      await router.push(redirectTo);
    }

    return this.user!;

  } catch (error) {
    this.clearAuth();
    console.error('Error completo en login:', error);

    this.error = error instanceof Error ? error.message : 'Error desconocido';
    throw error;
  } finally {
    this.isLoading = false;
  }
},

    async logout() {
      try {
        await AuthService.logout(); // realiza POST al backend
      } catch (error) {
        console.error('Error during logout:', error);
      } finally {
        this.clearAuth();
        await router.push({ name: 'login' });
      }
    },

    setAuthData(user: User, token: string | null, refreshToken: string | null = null): void {
      // Convertir null a undefined para js-cookie
      const cookieToken = token ?? undefined;
      const cookieRefreshToken = refreshToken ?? undefined;

      // Actualizar estado
      this.user = user;
      this.token = token;
      this.refreshToken = refreshToken;

      const cookieOptions = {
        secure: import.meta.env.PROD,
        sameSite: 'strict' as const,
        expires: token ? 1 : 0 // 1 día para token, 0 elimina si es null
      };

      // Manejar cookie de token
      if (cookieToken !== undefined) {
        Cookies.set('token', cookieToken, cookieOptions);
      } else {
        Cookies.remove('token');
      }

      // Manejar cookie de refresh token
      if (cookieRefreshToken !== undefined) {
        Cookies.set('refreshToken', cookieRefreshToken, {
          ...cookieOptions,
          expires: 7 // 7 días para refresh token
        });
      } else {
        Cookies.remove('refreshToken');
      }
    },

    clearAuth(): void {
      this.user = null;
      this.token = null;
      this.refreshToken = null;
      this.isInitialized = false;
      this.error = null;
      Cookies.remove('token');
      Cookies.remove('refreshToken');
    },

    setReturnUrl(url: string | null): void {
      this.returnUrl = url ?? undefined;
    }
  },

  getters: {
  isAuthenticated: (state) => !!state.user && !!state.token,
  isAdmin: (state) => state.user?.role === 'admin',
  isEmailVerified: (state) => !!state.user?.email_verified_at || !!state.user?.isVerified,
  needsEmailVerification: (state) => !!state.user && !state.user.email_verified_at,
  currentRole: (state) => state.user?.role || 'guest',
  userData: (state) => ({
    name: state.user?.name,
    email: state.user?.email,
    avatar: state.user?.avatar_url,
    role: state.user?.role,
    isVerified: !!state.user?.email_verified_at
  }),
  loadingState: (state) => state.isLoading,
  lastError: (state) => state.error
}
});
