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
    requiresVerifiedEmail?: boolean; // se exige SOLO si está en true explícitamente
    verificationFlowOnly?: boolean;  // para /verify-email (opcional)
  };

  const isPublic = !!meta.public;
  const guestOnly = !!meta.guestOnly;
  const requiresAdmin = !!meta.requiresAdmin;
  const requiresAuth = !!meta.requiresAuth || requiresAdmin;
  // 👇 default = false (ya no fuerza verificación global)
  const requiresVerifiedEmail = meta.requiresVerifiedEmail === true;
  const verificationFlowOnly = !!meta.verificationFlowOnly;

  // 1) Inicialización solo si la ruta lo requiere
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

  // 5) Verificación de email SOLO si la ruta lo pide explícitamente
  if (requiresVerifiedEmail && !auth.isEmailVerified && to.name !== 'email-verification') {
    const target = isSafePath(to.fullPath) ? to.fullPath : '/';
    return next({
      name: 'email-verification',
      query: { redirect: encodeURIComponent(target) }
    });
  }

  // 6) /verify-email: flujo post-registro o desde enlace con token
  if (to.name === 'email-verification') {
    const fromParam = typeof to.query.from === 'string' ? to.query.from : '';
    const fromRegister = fromParam === 'register';
    const force = typeof to.query.force === 'string' ? to.query.force === 'true' : false;

    // Si esta vista está marcada como "solo flujo" y no vienes del registro, redirige
    if (verificationFlowOnly && !fromRegister && auth.isEmailVerified && !force) {
      return next(auth.isAdmin ? '/admin' : '/home');
    }

    // Si ya está verificado, no quedarse aquí salvo force=true
    if (auth.isEmailVerified && !force) {
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
