// src/types/user.ts

export type UserRole = 'user' | 'admin' | 'moderator';

/**
 * Estructura de compat para vacaciones.
 * El backend (mapUserWithVacationLFT) puede mandar right/adminExtra,
 * por eso se incluyen como opcionales.
 */
export interface VacationDays {
  right?: number;       // derecho vigente (opcional)
  adminExtra?: number;  // bono admin (opcional)
  total: number;        // total = right + adminExtra
  used: number;         // usados del ciclo vigente (para la vista de usuario)
  remaining: number;    // restantes del ciclo vigente
}

/**
 * Tipo base de usuario. Para la tabla de Gestión de Usuarios,
 * el backend ahora envía también:
 *  - used:      usados del AÑO EN CURSO
 *  - total:     Disponible total (suma de restantes de todas las ventanas + bono)
 *  - available: restantes del AÑO EN CURSO
 * Estas tres son opcionales aquí para no romper otras vistas.
 */
export interface User {
  id: string;
  _id?: string; // compat Mongo
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isVerified?: boolean;
  email_verified_at?: string | null;

  // Meta opcional (admin)
  position?: string | null;
  birthDate?: string | null;
  hireDate?: string | null;

  // Legacy/compat
  vacationDays?: VacationDays;

  // Campos que la TABLA lee directamente
  used?: number;       // USADOS (año en curso)
  total?: number;      // TOTALES (Disponible total)
  available?: number;  // DISP. (restantes año en curso)
}

/**
 * Si prefieres forzar requeridos en la tabla, usa este alias:
 */
export type AdminUserRow = Omit<User, 'used' | 'total' | 'available'> & {
  used: number;
  total: number;
  available: number;
};
