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

/** 👇 NUEVO: dominio absoluto para recursos estáticos servidos en /uploads */
export const UPLOADS_BASE_URL =
  import.meta.env.VITE_UPLOADS_URL ?? 'https://intranet-corporativa.onrender.com';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    // 👇 Dejamos solo Accept. Content-Type lo decide Axios según el body.
    Accept: 'application/json',
    // ❌ No enviar Cache-Control desde el cliente (evita preflight bloqueado)
  },
});

/** ===== Request interceptor =====
 * - Forzar URL absoluta si base es absoluta y config.url empieza con '/'
 * - Añadir Authorization si hay access token
 * - Cache-busting de perfil vía query param (sin headers)
 * - 👇 NUEVO: si el body es FormData, eliminar Content-Type para que el navegador ponga multipart/form-data
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

    // Token
    try {
      const auth = useAuthStore();
      if (auth?.token) {
        headers.set('Authorization', `Bearer ${auth.token}`);
      }
    } catch {
      // Pinia aún no montada
    }

    // Cache-busting de perfil SIN tocar headers
    if (config.url?.includes('/auth/me') || config.url?.includes('/auth/profile')) {
      config.params = { ...(config.params ?? {}), _t: Date.now() };
    }

    // 👇 MUY IMPORTANTE: si el cuerpo es FormData, no forzamos Content-Type
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      const h = headers as AxiosHeaders;

      // AxiosHeaders tiene .delete
      if (h.delete) {
        h.delete('Content-Type');
        h.delete('content-type');
      }
    }

    return config;
  },
  (error) =>
    Promise.reject(error instanceof Error ? error : new Error(String(error)))
);

/** ===== Response interceptor con refresh y cola ===== */
let refreshing = false;
const queue: Array<() => void> = [];

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Redirección segura: solo si NO estamos ya en /login */
function goToLoginIfNeeded() {
  try {
    const p = `${window.location.pathname}${window.location.hash || ''}`;
    if (!/(^|\/|#)login(\/|$|\?|#)/.test(p)) {
      window.location.assign('/login');
    }
  } catch {
    // ignore
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status as number | undefined;
    const original = error?.config as RetriableConfig | undefined;
    const reqUrl: string | undefined = original?.url;

    // Solo manejamos 401 con posibilidad de refresh
    if (status === 401 && original && !original._retry) {
      const isAuthPath =
        !!reqUrl &&
        (/\/auth\/login\b/.test(reqUrl) || /\/auth\/refresh\b/.test(reqUrl) || /\/auth\/logout\b/.test(reqUrl));

      // Si el 401 viene de /auth/login|refresh|logout, no redirigimos
      if (isAuthPath) {
        return Promise.reject(error);
      }

      const auth = useAuthStore();

      // Si ya hay un refresh en curso, encola y reintenta cuando termine
      if (refreshing) {
        return new Promise((resolve) => {
          queue.push(() => {
            const retried: RetriableConfig = { ...original, _retry: true };
            resolve(api(retried));
          });
        });
      }

      // Primer hilo que entra: dispara refresh
      refreshing = true;
      try {
        const ok = await auth.refreshAuth(); // usa cookie HttpOnly en /auth/refresh
        // Despierta a los que esperaban
        queue.splice(0).forEach((run) => run());

        if (ok) {
          const retried: RetriableConfig = { ...original, _retry: true };
          return api(retried);
        }

        // Si no se pudo refrescar, limpia y manda a login (solo si no estamos ya allí)
        auth.clearAuth();
        goToLoginIfNeeded();
        return Promise.reject(error);
      } finally {
        refreshing = false;
      }
    }

    // Otros errores: propaga mensaje del servidor si existe
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

