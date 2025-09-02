// Configuración base de la API
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${BASE_URL}/api/auth/login`,
    REGISTER: `${BASE_URL}/api/auth/register`,
    PROFILE: `${BASE_URL}/api/auth/profile`
  },
  USERS: `${BASE_URL}/api/users`, // Aquí noté que en el backend usas /api/admin/users
};
