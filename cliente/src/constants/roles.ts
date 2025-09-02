// src/constants/roles.ts
export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  // Agrega más roles según necesites
} as const;

// Tipo derivado automáticamente
export type RoleKeys = keyof typeof ROLES;
export type RoleValues = typeof ROLES[RoleKeys];

// Función de verificación de roles
export const isRole = (role: string): role is RoleValues => {
  return Object.values(ROLES).includes(role as RoleValues);
};

// Objeto con descripciones amigables
export const ROLE_DESCRIPTIONS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.USER]: 'Usuario estándar'
} as const;
