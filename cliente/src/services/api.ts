// src/services/api.ts
import axios, {
  AxiosHeaders,
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Base URL:
 * - Dev: proxy de Vite => '/api'
 * - Prod: VITE_API_BASE_URL (ej. https://tu-backend.onrender.com/api)
 */
const RAW_BASE =
  import.meta.env.PROD
    ? (import.meta.env.VITE_API_BASE_URL ?? 'https://intranet-corporativa.onrender.com/api')
    : '/api';

// Normaliza (sin barras duplicadas al unir)
const trimSlashEnd = (s: string) => s.replace(/\/+$/, '');
const trimSlashStart = (s: string) => s.replace(/^\/+/, '');
const API_BASE_URL = trimSlashEnd(RAW_BASE);

// Forma esperada del error que devuelve tu backend
type ServerError = {
  message?: string;
  error?: string;
  errors?: Array<{ msg?: string; param?: string }>;
};

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ✅ ya no usamos "as any" gracias al augment
api.defaults.timeoutErrorMessage =
  'La solicitud tardó más de lo esperado. Verifica si la acción se completó.';

/** ===== Request interceptor ===== */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Forzar absoluta si base es absoluta y url empieza con '/'
    const baseIsAbsolute = /^https?:\/\//i.test(API_BASE_URL);
    if (baseIsAbsolute && config.url && config.url.startsWith('/')) {
      const base = trimSlashEnd(API_BASE_URL);
      const path = trimSlashStart(config.url);
      config.url = `${base}/${path}`;
    }

    // Headers
    const headers = (config.headers ??= new AxiosHeaders());

    // Token (si existe)
    try {
      const auth = useAuthStore();
      if (auth?.token) headers.set('Authorization', `Bearer ${auth.token}`);
    } catch {
      /* Pinia aún no montada */
    }

    // Cache-busting de perfil SIN tocar headers
    const u = config.url || '';
    if (u.includes('/auth/me') || u.includes('/auth/profile')) {
      config.params = { ...(config.params ?? {}), _t: Date.now() };
    }

    return config;
  },
  (err) => Promise.reject(err instanceof Error ? err : new Error(String(err)))
);

/** ===== Response interceptor con refresh y cola ===== */
let refreshing = false;
const queue: Array<() => void> = [];

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function goToLoginIfNeeded() {
  try {
    const p = `${window.location.pathname}${window.location.hash || ''}`;
    if (!/(^|\/|#)login(\/|$|\?|#)/.test(p)) window.location.assign('/login');
  } catch { /* ignore */ }
}

api.interceptors.response.use(
  (response) => response,
  async (rawErr) => {
    const err = rawErr as AxiosError<ServerError>;
    const status = err.response?.status;
    const original = err.config as RetriableConfig | undefined;
    const reqUrl: string | undefined = original?.url;

    // Solo manejamos 401 con posibilidad de refresh
    if (status === 401 && original && !original._retry) {
      const isAuthPath =
        !!reqUrl &&
        (/\/auth\/login\b/.test(reqUrl) ||
         /\/auth\/refresh\b/.test(reqUrl) ||
         /\/auth\/logout\b/.test(reqUrl));

      if (isAuthPath) {
        return Promise.reject(err);
      }

      const auth = useAuthStore();

      if (refreshing) {
        return new Promise((resolve) => {
          queue.push(() => {
            const retried: RetriableConfig = { ...original, _retry: true };
            resolve(api(retried));
          });
        });
      }

      refreshing = true;
      try {
        const ok = await auth.refreshAuth(); // usa cookie HttpOnly
        queue.splice(0).forEach((run) => run());

        if (ok) {
          const retried: RetriableConfig = { ...original, _retry: true };
          return api(retried);
        }

        auth.clearAuth();
        goToLoginIfNeeded();
        return Promise.reject(err);
      } finally {
        refreshing = false;
      }
    }

    // Otros errores: mensaje amigable y tipado
    const data = err.response?.data;
    const serverMsg =
      (data?.message && String(data.message)) ||
      (Array.isArray(data?.errors) && data.errors[0]?.msg) ||
      (data?.error && String(data.error)) ||
      undefined;

    const message =
      serverMsg ||
      (err.code === 'ECONNABORTED' ? api.defaults.timeoutErrorMessage : undefined) ||
      err.message ||
      'Error de red';

    return Promise.reject(new Error(message));
  }
);

/** API Service tipado (azúcar sintáctico) */
export const apiService = {
  get:  <T = unknown>(url: string, config?: AxiosRequestConfig) => api.get<T>(url, config),
  post: <T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
    api.post<T, AxiosResponse<T>, D>(url, data as D, config),
  put:  <T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
    api.put<T, AxiosResponse<T>, D>(url, data as D, config),
  patch:<T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
    api.patch<T, AxiosResponse<T>, D>(url, data as D, config),
  delete:<T = unknown>(url: string, config?: AxiosRequestConfig) => api.delete<T>(url, config),
};

export default api;
