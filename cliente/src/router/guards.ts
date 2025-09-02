// src/router/guards.ts
import { useAuthStore } from "@/stores/auth.store";
import type { NavigationGuardNext, RouteLocationNormalized } from "vue-router";

export const authGuard = async (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  const authStore = useAuthStore();
  const {
    requiresAuth = false,
    requiresAdmin = false,
    public: isPublic = false,
    requiresVerifiedEmail = true
  } = to.meta;

  // Initialize auth if needed
  if (!authStore.isInitialized && (requiresAuth || requiresAdmin)) {
    try {
      await authStore.initialize();
    } catch (error) {
      authStore.clearAuth();
      return redirectToLogin(to, next);
    }
  }

  // Handle public routes
  if (isPublic) {
    return handlePublicRoute(authStore, to, from, next);
  }

  // Check authentication
  if (requiresAuth && !authStore.isAuthenticated) {
    return redirectToLogin(to, next);
  }

  // Check email verification
  if (requiresVerifiedEmail && !authStore.isEmailVerified && to.name !== 'email-verification') {
    return redirectToEmailVerification(authStore, to, next);
  }

  // Check admin role
  if (requiresAdmin && !authStore.isAdmin) {
    return next({ name: 'forbidden' });
  }

  // Prevent showing verification page if already verified
  if (to.name === 'email-verification' && authStore.isEmailVerified && to.query.force !== 'true') {
    return next(authStore.isAdmin ? '/admin' : '/');
  }

  // All checks passed
  next();
};

// Helper functions
const redirectToLogin = (to: RouteLocationNormalized, next: NavigationGuardNext) => {
  const authStore = useAuthStore();
  authStore.setReturnUrl(to.fullPath);
  return next({
    name: 'login',
    query: { redirect: to.fullPath }
  });
};

const redirectToEmailVerification = (
  authStore: ReturnType<typeof useAuthStore>,
  to: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  return next({
    name: 'email-verification',
    query: {
      email: authStore.userData?.email,
      redirect: to.fullPath
    }
  });
};

const handlePublicRoute = (
  authStore: ReturnType<typeof useAuthStore>,
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  // Allow during registration/verification flow
  if (authStore.isAuthenticated && ['register', 'email-verification'].includes(from.name as string)) {
    return next();
  }

  // Redirect authenticated users away from auth pages
  if (authStore.isAuthenticated && ['login', 'register'].includes(to.name as string)) {
    return next(authStore.isAdmin ? '/admin' : '/');
  }

  return next();
};

// Admin guard (specific for admin routes)
export const adminGuard = async (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  const authStore = useAuthStore();

  if (!authStore.isInitialized) {
    try {
      await authStore.initialize();
    } catch (error) {
      authStore.clearAuth();
      return redirectToLogin(to, next);
    }
  }

  if (!authStore.isAuthenticated) {
    return redirectToLogin(to, next);
  }

  if (!authStore.isAdmin) {
    return next({ name: 'forbidden' });
  }

  next();
};
