// src/services/api.ts
import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Base URL:
 * - Dev: usamos el proxy de Vite => '/api'
 * - Prod: VITE_API_BASE_URL (ej. https://tu-backend.onrender.com/api)
 *         o fallback a tu Render con '/api'
 */
const RAW_BASE =
  import.meta.env.PROD
    ? (import.meta.env.VITE_API_BASE_URL ?? 'https://intranet-corporativa.onrender.com/api')
    : '/api';

// Normaliza (sin barras duplicadas al unir)
const trimSlashEnd = (s: string) => s.replace(/\/+$/, '');
const trimSlashStart = (s: string) => s.replace(/^\/+/, '');
const API_BASE_URL = trimSlashEnd(RAW_BASE);

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
  },
});

/**
 * Request interceptor:
 * - Si la URL es relativa ('/...') y base es absoluta, la forzamos a absoluta (a prueba de balas).
 * - Añade Authorization si hay token.
 * - Evita caché en GET y añade bust para /auth/profile.
 */
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
    if ((config.method ?? 'get').toLowerCase() === 'get') {
      headers.set('Cache-Control', 'no-store');
    }

    // Token
    try {
      const auth = useAuthStore();
      if (auth?.token) {
        headers.set('Authorization', `Bearer ${auth.token}`);
      }
    } catch {
      // Pinia aún no montada: ignorar
    }

    // Cache-busting de perfil
    if (config.url?.includes('/auth/profile')) {
      config.params = { ...(config.params ?? {}), _t: Date.now() };
      headers.set('Cache-Control', 'no-store');
    }

    return config;
  },
  (error) =>
    Promise.reject(error instanceof Error ? error : new Error(String(error)))
);

/**
 * Response interceptor:
 * - En 401: limpia sesión y redirige a /login (evitando bucles en login/refresh).
 * - Propaga mensaje del servidor si existe.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status as number | undefined;
    const reqUrl: string | undefined = error?.config?.url;

    if (status === 401) {
      const isAuthPath =
        !!reqUrl &&
        (/\/auth\/login\b/.test(reqUrl) || /\/auth\/refresh-token\b/.test(reqUrl));

      try {
        const auth = useAuthStore();
        // Evitar llamar logout contra el backend si ya estamos fallando en auth
        if (!isAuthPath) await auth.logout();
        else auth.clearAuth();
      } finally {
        // Redirigir a login
        window.location.href = '/login';
      }
    }

    const serverMsg: unknown = error?.response?.data?.message;
    const message =
      typeof serverMsg === 'string'
        ? serverMsg
        : (error?.message as string | undefined) ?? 'Error de red';

    return Promise.reject(new Error(message));
  }
);

/** API Service tipado (azúcar sintáctico) */
export const apiService = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) => api.get<T>(url, config),
  post: <T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
    api.post<T, AxiosResponse<T>, D>(url, data as D, config),
  put: <T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
    api.put<T, AxiosResponse<T>, D>(url, data as D, config),
  patch: <T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
    api.patch<T, AxiosResponse<T>, D>(url, data as D, config),
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => api.delete<T>(url, config),
};

export default api;
