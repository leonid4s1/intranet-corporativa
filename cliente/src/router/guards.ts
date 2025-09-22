// src/router/guards.ts
import { useAuthStore } from '@/stores/auth.store';
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';

// --- utils ---
const isSafePath = (p?: string): p is string =>
  !!p && p.startsWith('/') && !p.startsWith('//') && p !== '/login';

const goLogin = (
  to: RouteLocationNormalized,
  next: NavigationGuardNext,
  setReturn?: (p: string) => void
) => {
  const target = isSafePath(to.fullPath) ? to.fullPath : '/';
  setReturn?.(target);
  return next({ name: 'login', query: { redirect: encodeURIComponent(target) } });
};

// --- guard principal ---
export const authGuard = async (
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  const auth = useAuthStore();

  const meta = to.meta as {
    public?: boolean;
    guestOnly?: boolean;
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
    requiresVerifiedEmail?: boolean; // ahora SOLO si se pone explícito en la ruta
    verificationFlowOnly?: boolean;  // para /verify-email
  };

  const isPublic = !!meta.public;
  const guestOnly = !!meta.guestOnly;
  const requiresAuth = !!meta.requiresAuth || !!meta.requiresAdmin;
  const requiresAdmin = !!meta.requiresAdmin;
  const requiresVerifiedEmail = meta.requiresVerifiedEmail === true; // por defecto NO se exige
  const verificationFlowOnly = !!meta.verificationFlowOnly;

  // 1) Inicialización (intenta refresh + me) SOLO si la ruta lo requiere
  if (!auth.isInitialized && (requiresAuth || requiresAdmin)) {
    try {
      await auth.initialize();
    } catch {
      auth.clearAuth();
      return goLogin(to, next, auth.setReturnUrl);
    }
  }

  // 2) Si ya está autenticado y viene a /login o /register -> a home/admin
  if (auth.isAuthenticated && (to.name === 'login' || to.name === 'register')) {
    return next(auth.isAdmin ? '/admin' : '/home');
  }

  // 3) Rutas públicas
  if (isPublic && !requiresAuth) {
    if (guestOnly && auth.isAuthenticated) {
      return next(auth.isAdmin ? '/admin' : '/home');
    }
    return next();
  }

  // 4) Requiere autenticación
  if (requiresAuth && !auth.isAuthenticated) {
    try {
      if (!auth.isInitialized) await auth.initialize();
    } catch {
      auth.clearAuth();
    }
    if (!auth.isAuthenticated) {
      return goLogin(to, next, auth.setReturnUrl);
    }
  }

  // 5) Verificación de email (opcional, solo si la ruta lo pide explícito)
  if (requiresVerifiedEmail && !auth.isEmailVerified && to.name !== 'email-verification') {
    // Aquí podrías bloquear si alguna ruta lo requiere realmente.
    // return next({ name: 'forbidden' });
  }

  // 6) Acceso a /verify-email: solo flujo post-registro
  if (to.name === 'email-verification') {
    const fromRegister = to.query.from === 'register';
    if (!auth.isAuthenticated) {
      return goLogin(to, next, auth.setReturnUrl);
    }
    if (auth.isEmailVerified && to.query.force !== 'true') {
      return next(auth.isAdmin ? '/admin' : '/home');
    }
    if (verificationFlowOnly && !fromRegister) {
      return next(auth.isAdmin ? '/admin' : '/home');
    }
  }

  // 7) Admin
  if (requiresAdmin && !auth.isAdmin) {
    return next({ name: 'forbidden' });
  }

  return next();
};

// Guard específico para rutas admin (si quieres aplicarlo en rutas sueltas)
export const adminGuard = async (
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  const auth = useAuthStore();

  if (!auth.isInitialized) {
    try {
      await auth.initialize();
    } catch {
      auth.clearAuth();
      return goLogin(to, next, auth.setReturnUrl);
    }
  }

  if (!auth.isAuthenticated) {
    return goLogin(to, next, auth.setReturnUrl);
  }
  if (!auth.isAdmin) {
    return next({ name: 'forbidden' });
  }
  return next();
};
