// src/stores/auth.store.ts
import { defineStore } from 'pinia';
import { isAxiosError } from 'axios';
import router from '@/router';
import Cookies from 'js-cookie';

import { AuthService } from '@/services/auth.service';
import type {
  AuthState,
  User,
  LoginData,
  RegisterData,
  VerificationResponse,
  ResendVerificationResponse,
} from '@/types/auth';

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: Cookies.get('token') || null,
    refreshToken: Cookies.get('refreshToken') || null,
    returnUrl: undefined,
    isInitialized: false,
    isLoading: false,
    error: null,
  }),

  actions: {
    async initialize(): Promise<void> {
      if (this.isInitialized) return;
      try {
        if (this.token) {
          await this.fetchUser();
        }
      } catch (err) {
        console.error('[Auth] initialize error:', err);
        this.clearAuth();
      } finally {
        this.isInitialized = true;
      }
    },

    async refreshAuth(): Promise<boolean> {
      if (!this.refreshToken) {
        console.error('[Auth] No hay refreshToken disponible');
        return false;
      }
      try {
        const res = await AuthService.refreshToken();
        if (!res.success || !res.token) {
          throw new Error(res.message || 'Error al refrescar token');
        }
        // Mantén el usuario actual; si no lo hay, intenta obtenerlo
        if (!this.user) {
          try {
            const me = await AuthService.getProfile(res.token);
            this.user = me;
          } catch {
            /* ignore */
          }
        }
        this.setAuthData(this.user!, res.token, res.refreshToken ?? this.refreshToken);
        return true;
      } catch (err) {
        console.error('[Auth] refreshAuth error:', err);
        this.clearAuth();
        return false;
      }
    },

    async register(registerData: RegisterData): Promise<User> {
      this.isLoading = true;
      this.error = null;

      try {
        if (!registerData.name?.trim()) throw new Error('El nombre es requerido');
        if (!registerData.email?.trim()) throw new Error('El email es requerido');
        if (!registerData.password) throw new Error('La contraseña es requerida');
        if (registerData.password !== registerData.password_confirmation) {
          throw new Error('Las contraseñas no coinciden');
        }

        const res = await AuthService.register({
          name: registerData.name.trim(),
          email: registerData.email.trim().toLowerCase(),
          password: registerData.password,
          password_confirmation: registerData.password_confirmation,
        });

        if (!res.success || !res.user) {
          throw new Error(res.message || 'Error en el registro');
        }

        if (res.requiresEmailVerification) {
          await router.push({
            name: 'email-verification',
            query: { email: res.user.email },
          });
          return res.user;
        }

        if (res.token) {
          this.setAuthData(res.user, res.token, res.refreshToken ?? undefined);
        }

        return res.user;
      } catch (err) {
        console.error('[AuthStore] Error en registro:', err);
        if (isAxiosError(err)) {
          const status = err.response?.status;
          this.error =
            (err.response?.data as Record<string, unknown> | undefined)?.['message'] as string ||
            (status === 400
              ? 'Datos inválidos'
              : status === 409
              ? 'El email ya está registrado'
              : 'Error durante el registro');
        } else {
          this.error = err instanceof Error ? err.message : 'Error desconocido';
        }
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async resendVerificationEmail(email: string): Promise<ResendVerificationResponse> {
      this.isLoading = true;
      this.error = null;

      try {
        const res = await AuthService.resendVerificationEmail(email);
        if (!res.success) throw new Error(res.message || 'Error al reenviar el correo');
        return res;
      } catch (err) {
        if (isAxiosError(err)) {
          this.error =
            (err.response?.data as Record<string, unknown> | undefined)?.['message'] as string ||
            'Error al reenviar el correo';
        } else if (err instanceof Error) {
          this.error = err.message;
        } else {
          this.error = 'Error desconocido al reenviar el correo';
        }
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async verifyEmail(token: string): Promise<VerificationResponse> {
      this.isLoading = true;
      this.error = null;

      try {
        const res = await AuthService.verifyEmail(token);

        if (res.success && res.verified) {
          try {
            const me = await AuthService.getProfile(this.token ?? undefined);
            this.user = {
              ...me,
              email_verified_at: me.email_verified_at ?? new Date().toISOString(),
            };
          } catch {
            /* ignore */
          }
        }

        return { success: res.success, verified: res.verified, message: res.message || '' };
      } catch (err) {
        if (isAxiosError(err)) {
          this.error =
            (err.response?.data as Record<string, unknown> | undefined)?.['message'] as string ||
            'Error al verificar el email';
        } else if (err instanceof Error) {
          this.error = err.message;
        } else {
          this.error = 'Error desconocido al verificar el email';
        }
        return { success: false, verified: false, message: this.error || 'Error desconocido' };
      } finally {
        this.isLoading = false;
      }
    },

    async fetchUser(): Promise<void> {
      if (!this.token) return;
      try {
        const me = await AuthService.getProfile(this.token);
        this.user = {
          ...me,
          email_verified_at:
            me.email_verified_at || (me as unknown as { isVerified?: boolean }).isVerified
              ? new Date().toISOString()
              : me.email_verified_at ?? null,
        };
      } catch (err) {
        console.error('[Auth] fetchUser error:', err);
        if (isAxiosError(err) && err.response?.status === 401) {
          this.clearAuth();
          await router.push({ name: 'login' });
        }
        throw err;
      }
    },

    async login(loginData: LoginData): Promise<User> {
      this.isLoading = true;
      this.error = null;

      try {
        const res = await AuthService.login(loginData);
        if (!res.success) throw new Error(res.message || 'Error en el login');

        if (!res.token || !res.refreshToken) {
          throw new Error('No se recibieron tokens válidos');
        }

        this.setAuthData(res.user, res.token, res.refreshToken);

        const isVerified =
          res.user?.isVerified ||
          !!res.user?.email_verified_at ||
          (this.user ? this.user.isVerified || !!this.user.email_verified_at : false);

        if (!isVerified) {
          await router.push({
            name: 'email-verification',
            query: { email: res.user?.email },
          });
        } else {
          const redirectTo =
            this.returnUrl ?? (this.isAdmin ? { name: 'admin-dashboard' } : { name: 'home' });
          await router.push(redirectTo);
        }

        return this.user!;
      } catch (err) {
        this.clearAuth();
        console.error('[Auth] login error:', err);
        this.error = err instanceof Error ? err.message : 'Error desconocido';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async logout(): Promise<void> {
      try {
        await AuthService.logout();
      } catch (err) {
        console.error('[Auth] logout error:', err);
      } finally {
        this.clearAuth();
        await router.push({ name: 'login' });
      }
    },

    setAuthData(user: User, token: string | null, refreshToken: string | null = null): void {
      const cookieToken = token ?? undefined;
      const cookieRefreshToken = refreshToken ?? undefined;

      this.user = user;
      this.token = token;
      this.refreshToken = refreshToken;

      const cookieOptions = {
        secure: import.meta.env.PROD,
        sameSite: 'strict' as const,
        expires: token ? 1 : 0, // 1 día token
      };

      if (cookieToken !== undefined) Cookies.set('token', cookieToken, cookieOptions);
      else Cookies.remove('token');

      if (cookieRefreshToken !== undefined) {
        Cookies.set('refreshToken', cookieRefreshToken, { ...cookieOptions, expires: 7 });
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
    },
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
      avatar: (state.user as unknown as { avatar_url?: string })?.avatar_url,
      role: state.user?.role,
      isVerified: !!state.user?.email_verified_at,
    }),
    loadingState: (state) => state.isLoading,
    lastError: (state) => state.error,
  },
});
