// cliente/src/stores/auth.store.ts
import { defineStore } from 'pinia';
import { isAxiosError } from 'axios';
import router from '@/router';
import { AuthService } from '@/services/auth.service';
import type {
  AuthState,
  User,
  LoginData,
  VerificationResponse,
  ResendVerificationResponse,
} from '@/types/auth';

const ACCESS_KEY = 'app:access_token';

type ApiErrorData = { message?: string };
type AxiosLikeError = {
  message?: string;
  response?: { data?: ApiErrorData; status?: number };
};

function extractErrorMessage(err: unknown, fallback = 'Ocurrió un error'): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as AxiosLikeError;
    const apiMsg = e.response?.data?.message;
    if (typeof apiMsg === 'string' && apiMsg.trim()) return apiMsg;
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
  }
  return fallback;
}

// Helpers locales
const readAccess = () => localStorage.getItem(ACCESS_KEY);
const writeAccess = (t: string | null) => {
  if (t) localStorage.setItem(ACCESS_KEY, t);
  else localStorage.removeItem(ACCESS_KEY);
};

// Extensión local del tipo User con flags opcionales que a veces manda el backend
type UserMaybeVerified = User & {
  isVerified?: boolean;
  emailVerified?: boolean;
};

// Calcula “verificado” solo con los campos existentes en tu tipo User
function isUserVerified(u?: UserMaybeVerified | null): boolean {
  if (!u) return false;
  return Boolean(u.email_verified_at || u.isVerified || u.emailVerified);
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: readAccess(),        // solo access token
    refreshToken: null,         // compat de tipo; no se usa
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
        } else {
          // Sin token -> intenta refresh con cookie HttpOnly
          const refreshed = await this.refreshAuth();
          if (!refreshed) {
            // sin sesión; el guard decidirá si redirige a login
          }
        }
      } catch (err) {
        console.error('[Auth] initialize error:', err);
        this.clearAuth();
      } finally {
        this.isInitialized = true;
      }
    },

    async refreshAuth(): Promise<boolean> {
      try {
        const res = await AuthService.refreshToken();
        // backend devuelve { token, user } (compat con { accessToken })
        const access =
          (res as { accessToken?: string; token?: string }).accessToken ??
          (res as { token?: string }).token ??
          null;

        if (!access) throw new Error((res as { message?: string })?.message || 'Error al refrescar token');

        this.token = access;
        writeAccess(access);

        if (res.user) {
          this.user = res.user as User;
        } else if (!this.user) {
          // si no vino el user, lo pedimos
          try {
            const me = await AuthService.getProfile(this.token!);
            this.user = me as User;
          } catch {
            /* ignore */
          }
        }
        return true;
      } catch (err) {
        console.error('[Auth] refreshAuth error:', err);
        this.clearAuth();
        return false;
      }
    },

    async resendVerificationEmail(email: string): Promise<ResendVerificationResponse> {
      this.isLoading = true;
      this.error = null;

      try {
        const res = await AuthService.resendVerificationEmail(email);
        if (!res.success) throw new Error(res.message || 'Error al reenviar el correo');
        return res;
      } catch (err: unknown) {
        if (isAxiosError(err)) {
          this.error =
            (err.response?.data as Record<string, unknown> | undefined)?.['message'] as string ||
            'Error al reenviar el correo';
        } else {
          this.error = extractErrorMessage(err, 'Error al reenviar el correo');
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
            // forzamos una marca de tiempo si el backend aún no la pone
            this.user = {
              ...me,
              email_verified_at: me.email_verified_at ?? new Date().toISOString(),
            } as User;
          } catch {
            /* ignore */
          }
        }

        return { success: res.success, verified: res.verified, message: res.message || '' };
      } catch (err: unknown) {
        this.error = extractErrorMessage(err, 'Error al verificar el email');
        return { success: false, verified: false, message: this.error || 'Error desconocido' };
      } finally {
        this.isLoading = false;
      }
    },

    async fetchUser(): Promise<void> {
      if (!this.token) return;
      try {
        const me = await AuthService.getProfile(this.token);
        this.user = me as User;
      } catch (err: unknown) {
        console.error('[Auth] fetchUser error:', err);
        if (isAxiosError(err) && err.response?.status === 401) {
          const ok = await this.refreshAuth();
          if (!ok) {
            this.clearAuth();
            await router.replace({ name: 'login' });
          }
        } else {
          throw err;
        }
      }
    },

    async login(loginData: LoginData): Promise<User> {
      this.isLoading = true;
      this.error = null;

      try {
        const res = await AuthService.login(loginData);
        if (!res.success) throw new Error(res.message || 'Error en el login');

        const access =
          (res as { accessToken?: string; token?: string }).accessToken ??
          (res as { token?: string }).token ??
          null;

        if (!access) throw new Error('No se recibió access token');

        this.setAuthData(res.user as User, access);

        // normaliza perfil por si hay cambios
        try {
          await this.fetchUser();
        } catch {
          /* ignore */
        }

        return this.user!;
      } catch (err: unknown) {
        this.clearAuth();
        console.error('[Auth] login error:', err);
        this.error = extractErrorMessage(err, 'Error en el login');
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async logout(): Promise<void> {
      try {
        await AuthService.logout();
      } catch (err: unknown) {
        console.error('[Auth] logout error:', err);
      } finally {
        this.clearAuth();
        await router.replace({ name: 'login' });
      }
    },

    setAuthData(user: User, token: string | null): void {
      this.user = user;
      this.token = token;
      writeAccess(token);
    },

    clearAuth(): void {
      this.user = null;
      this.token = null;
      this.refreshToken = null; // compat con tipo
      this.error = null;
      writeAccess(null);
    },

    setReturnUrl(url: string | null): void {
      this.returnUrl = url ?? undefined;
    },
  },

  getters: {
    isAuthenticated: (state) => !!state.user && !!state.token,
    isAdmin: (state) => state.user?.role === 'admin',
    isEmailVerified: (state) => isUserVerified(state.user),
    needsEmailVerification: (state) => !!state.user && !isUserVerified(state.user),
    currentRole: (state) => state.user?.role || 'guest',
    userData: (state) => ({
      name: state.user?.name,
      email: state.user?.email,
      avatar: (state.user as { avatar_url?: string } | undefined)?.avatar_url,
      role: state.user?.role,
      isVerified: isUserVerified(state.user),
    }),
    loadingState: (state) => state.isLoading,
    lastError: (state) => state.error,
  },
});
