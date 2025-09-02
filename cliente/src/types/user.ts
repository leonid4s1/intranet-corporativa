// src/types/user.ts
export type UserRole = 'user' | 'admin' | 'moderator'; // Añadí moderator para coincidir con tu schema

export interface VacationDays {
  total: number;
  used: number;
  remaining: number;
}

export interface User {
  id: string;
  _id?: string; // Para compatibilidad con MongoDB
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  email_verified_at?: string | null;
  isNextFile?: boolean; // Solo si existe en tu DB
  vacationDays?: VacationDays;
}
