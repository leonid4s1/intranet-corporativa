/**
 * Datos requeridos para iniciar sesión
 */
export interface LoginData {
  email: string;
  password: string;
  remember?: boolean; // Opcional: recordar sesión
}

/**
 * Datos requeridos para registrar un nuevo usuario
 */
export interface RegisterData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  terms_accepted?: boolean; // Para aceptación de términos y condiciones

  // 👇 Nuevos campos (opcionales)
  position?: string;       // Puesto
  birthDate?: string;      // 'YYYY-MM-DD'
  hireDate?: string;       // 'YYYY-MM-DD'
}

/**
 * Datos para solicitar recuperación de contraseña
 */
export interface ForgotPasswordData {
  email: string;
}

/**
 * Datos para restablecer contraseña
 */
export interface ResetPasswordData {
  token: string;
  password: string;
  password_confirmation: string;
}

/**
 * Datos para actualizar perfil de usuario
 */
export interface UpdateProfileData {
  name?: string;
  email?: string;
  current_password?: string; // Para verificación al cambiar datos sensibles
  new_password?: string;
  avatar?: string | File; // Puede ser URL o archivo para upload

  // 👇 Nuevos campos (opcionales)
  position?: string | null;
  birthDate?: string | null; // 'YYYY-MM-DD'
  hireDate?: string | null;  // 'YYYY-MM-DD'
}

/** Tipos para el Modelo de Usuario */
export interface UserMetadata {
  last_login?: string;
  login_count?: number;
  timezone?: string;
}

export type UserRole = 'admin' | 'user' | 'moderator';

/**
 * Representación completa de un usuario
 */
export interface User {
  id: string;
  name: string;
  email: string;
  email_verified_at?: string | null;
  isVerified?: boolean;
  isActive?: boolean;
  role: UserRole;
  avatar_url?: string;

  // 👇 Nuevos campos recibidos desde el backend
  position?: string | null;
  birthDate?: string | null; // ISO date
  hireDate?: string | null;  // ISO date

  created_at: string;
  updated_at: string;
  metadata?: UserMetadata;
}

/* Tipos para Respuestas de la API */
export interface BaseResponse {
  success: boolean;
  message?: string;
}

export interface AuthTokens {
  token: string | null;
  refreshToken?: string | null;
  expiresIn?: string | number;
}

export interface AuthResponse extends BaseResponse, AuthTokens {
  user: User;
}

export interface RefreshTokenResponse extends BaseResponse, AuthTokens {
  success: boolean;
  user?: User;
}

export interface VerificationResponse extends BaseResponse {
  verified: boolean;
}

export interface ResendVerificationResponse extends BaseResponse {
  sent: boolean;
}

export interface EmailVerificationResponse extends BaseResponse {
  status: 'sent' | 'verified' | 'already_verified';
}

/* Tipos para Estado Global */
export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  returnUrl: string | undefined;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
}

/* Tipos para Configuración y Errores */
export interface AuthConfig {
  passwordResetUrl: string;
  emailVerificationUrl: string;
  loginRedirect: string;
  logoutRedirect: string;
}

export interface ValidationErrors {
  [key: string]: string[];
}

export type RegisterErrorFields =
  | 'name'
  | 'email'
  | 'password'
  | 'password_confirmation'
  | 'terms_accepted'
  // 👇 nuevos
  | 'position'
  | 'birthDate'
  | 'hireDate';

export interface RegisterErrors {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  terms_accepted: string;

  // 👇 nuevos
  position: string;
  birthDate: string;
  hireDate: string;

  [key: string]: string;
}

export interface RegisterResponse extends AuthResponse {
  requiresEmailVerification: boolean;
}
