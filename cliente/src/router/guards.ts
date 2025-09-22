// src/router/guards.ts
import { useAuthStore } from '@/stores/auth.store';
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';

type AuthStore = ReturnType<typeof useAuthStore>;

// --- util ---
const isSafePath = (p?: string): p is string =>
  !!p && p.startsWith('/') && !p.startsWith('//') && p !== '/login';

// --- guard principal ---
export const authGuard = async (
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  const auth = useAuthStore();

  const meta = to.meta as {
    public?: boolean;
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
    requiresVerifiedEmail?: boolean;
  };

  const requiresAuth = !!meta.requiresAuth;
  const requiresAdmin = !!meta.requiresAdmin;
  const isPublic = !!meta.public;
  const requiresVerifiedEmail = meta.requiresVerifiedEmail ?? true;

  // Hidratar estado de auth si la ruta lo requiere y aún no se ha hecho
  if (!auth.isInitialized && (requiresAuth || requiresAdmin)) {
    try {
      await auth.initialize();
    } catch {
      auth.clearAuth();
      return redirectToLogin(auth, to, next);
    }
  }

  // Si ya está autenticado y viene a /login o /register, redirigir a su home
  if (auth.isAuthenticated && (to.name === 'login' || to.name === 'register')) {
    return next(auth.isAdmin ? '/admin' : '/');
  }

  // Rutas públicas pasan tal cual
  if (isPublic) {
    return next();
  }

  // Requiere autenticación
  if (requiresAuth && !auth.isAuthenticated) {
    return redirectToLogin(auth, to, next);
  }

  // Verificación de email (no bloquear tu propia página de verificación)
  if (
    requiresVerifiedEmail &&
    !auth.isEmailVerified &&
    to.name !== 'email-verification'
  ) {
    return redirectToEmailVerification(auth, to, next);
  }

  // Requiere admin
  if (requiresAdmin && !auth.isAdmin) {
    return next({ name: 'forbidden' });
  }

  // Si ya está verificado, no mostrar la página de verificación (a menos que force=true)
  if (to.name === 'email-verification' && auth.isEmailVerified && to.query.force !== 'true') {
    return next(auth.isAdmin ? '/admin' : '/');
  }

  return next();
};

// === Helpers ===
const redirectToLogin = (
  auth: AuthStore,
  to: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  // Guardar a dónde querías ir, pero sólo si es una ruta interna segura
  const target = isSafePath(to.fullPath) ? to.fullPath : '/';

  auth.setReturnUrl(target);

  // Pasar redirect codificado; evita open-redirects y loops hacia /login
  return next({
    name: 'login',
    query: { redirect: encodeURIComponent(target) },
  });
};

const redirectToEmailVerification = (
  auth: AuthStore,
  to: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  const safe = isSafePath(to.fullPath) ? to.fullPath : '/';
  return next({
    name: 'email-verification',
    query: {
      email: auth.userData?.email,
      redirect: encodeURIComponent(safe),
    },
  });
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
      return redirectToLogin(auth, to, next);
    }
  }

  if (!auth.isAuthenticated) {
    return redirectToLogin(auth, to, next);
  }
  if (!auth.isAdmin) {
    return next({ name: 'forbidden' });
  }
  return next();
};
