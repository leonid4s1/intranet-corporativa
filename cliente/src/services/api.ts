// src/services/api.ts
import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
  },
});

/** ===== Interceptor de petición ===== */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authStore = useAuthStore();
    const token = authStore.token;

    // Asegura un objeto AxiosHeaders (evita el error de tipos)
    const headers = (config.headers ??= new AxiosHeaders());

    // Deshabilitar caché por defecto en GET (si quieres sólo en algunos, quita esto)
    if ((config.method ?? 'get').toLowerCase() === 'get') {
      headers.set('Cache-Control', 'no-store');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // No cachear el perfil y añadir anti-caché en query
    if (config.url?.includes('/auth/profile')) {
      config.params = { ...(config.params ?? {}), _t: Date.now() };
      headers.set('Cache-Control', 'no-store');
    }

    return config;
  },
  (error) => Promise.reject(error instanceof Error ? error : new Error(String(error)))
);

/** ===== Interceptor de respuesta ===== */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      try {
        const authStore = useAuthStore();
        await authStore.logout();
      } finally {
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

/** ===== API Service tipado ===== */
export const apiService = {
  get:   <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    api.get<T>(url, config),
  post:  <T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
    api.post<T, AxiosResponse<T>, D>(url, data as D, config),
  put:   <T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
    api.put<T, AxiosResponse<T>, D>(url, data as D, config),
  patch: <T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
    api.patch<T, AxiosResponse<T>, D>(url, data as D, config),
  delete:<T = unknown>(url: string, config?: AxiosRequestConfig) =>
    api.delete<T>(url, config),
};

export default api;
