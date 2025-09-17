// src/router/guards.ts
import { useAuthStore } from '@/stores/auth.store';
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';

type AuthStore = ReturnType<typeof useAuthStore>;

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

  // Inicializa si la ruta lo requiere
  if (!auth.isInitialized && (requiresAuth || requiresAdmin)) {
    try {
      await auth.initialize();
    } catch {
      auth.clearAuth();
      return redirectToLogin(auth, to, next);
    }
  }

  // Rutas públicas
  if (isPublic) {
    return handlePublicRoute(auth, to, next);
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
const redirectToLogin = (auth: AuthStore, to: RouteLocationNormalized, next: NavigationGuardNext) => {
  // guarda hacia dónde querías ir (solo si no vienes ya de login)
  auth.setReturnUrl(to.fullPath);
  return next({ name: 'login', query: { redirect: to.fullPath } });
};

const redirectToEmailVerification = (auth: AuthStore, to: RouteLocationNormalized, next: NavigationGuardNext) => {
  return next({
    name: 'email-verification',
    query: { email: auth.userData?.email, redirect: to.fullPath },
  });
};

const handlePublicRoute = (auth: AuthStore, to: RouteLocationNormalized, next: NavigationGuardNext) => {
  // Evitar que usuarios autenticados visiten login/registro
  const isAuthPage = ['login', 'register'].includes(String(to.name));
  if (auth.isAuthenticated && isAuthPage) {
    return next(auth.isAdmin ? '/admin' : '/');
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
