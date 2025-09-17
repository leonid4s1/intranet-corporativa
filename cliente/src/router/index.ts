// src/router/index.ts
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

// Vistas (lazy)
const LoginView              = () => import('@/views/auth/LoginView.vue');
const RegisterView           = () => import('@/views/auth/RegisterView.vue');
const EmailVerificationView  = () => import('@/views/auth/EmailVerificationView.vue');

const AdminDashboard         = () => import('@/views/admin/AdminHome.vue');
const UserRolesAdmin         = () => import('@/views/admin/UserRolesAdmin.vue');
const UserManagement         = () => import('@/views/admin/UserManagement.vue');
const VacationManagement     = () => import('@/views/admin/AdminVacationManagement.vue');

const UserDashboard          = () => import('@/views/user/Home.vue');
const VacationCalendar       = () => import('@/views/user/VacationCalendar.vue');

const ForbiddenView          = () => import('@/views/errors/ForbiddenView.vue');
const NotFoundView           = () => import('@/views/errors/NotFoundView.vue');

const routes: Array<RouteRecordRaw> = [
  // Raíz: decide a dónde ir según sesión/rol/estado de verificación
  {
    path: '/',
    redirect: (to) => {
      const authStore = useAuthStore();
      if (!authStore.isInitialized) return { name: 'login' };

      if (authStore.isAuthenticated) {
        if (!authStore.isEmailVerified) {
          return {
            name: 'email-verification',
            query: { email: authStore.user?.email, redirect: to.fullPath }
          };
        }
        return authStore.isAdmin ? { name: 'admin-dashboard' } : { name: 'home' };
      }
      return { name: 'login' };
    }
  },

  // Públicas
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { public: true, guestOnly: true, title: 'Iniciar Sesión', requiresVerifiedEmail: false }
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: { public: true, guestOnly: true, title: 'Registro', requiresVerifiedEmail: false }
  },
  // token opcional: /verify-email o /verify-email/:token
  {
    path: '/verify-email/:token?',
    name: 'email-verification',
    component: EmailVerificationView,
    meta: { public: true, title: 'Verificación de Email', requiresVerifiedEmail: false }
  },

  // Admin
  {
    path: '/admin',
    name: 'admin-dashboard',
    component: AdminDashboard,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Panel de Administración' }
  },
  {
    path: '/admin/users',
    name: 'user-management',
    component: UserManagement,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Gestión de Usuarios' }
  },
  {
    path: '/admin/roles',
    name: 'role-management',
    component: UserRolesAdmin,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Gestión de Roles' }
  },
  {
    path: '/admin/vacations',
    name: 'vacation-management',
    component: VacationManagement,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Gestión de Vacaciones' }
  },

  // Usuario
  {
    path: '/home',
    name: 'home',
    component: UserDashboard,
    meta: { requiresAuth: true, title: 'Inicio' }
  },
  {
    path: '/vacaciones',
    name: 'vacations',
    component: VacationCalendar,
    meta: { requiresAuth: true, title: 'Calendario de Vacaciones' }
  },

  // Errores
  {
    path: '/forbidden',
    name: 'forbidden',
    component: ForbiddenView,
    meta: { public: true, title: 'Acceso Denegado', requiresVerifiedEmail: false }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
    meta: { public: true, title: 'Página no encontrada', requiresVerifiedEmail: false }
  }
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, saved) {
    return saved || { top: 0 };
  }
});

// Rutas que SIEMPRE deben poder abrirse aunque el usuario no esté verificado
const BYPASS_VERIFICATION = new Set(['login', 'register', 'email-verification', 'forbidden', 'not-found']);

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  // Inicializa auth una sola vez
  if (!authStore.isInitialized) {
    try { await authStore.initialize(); } catch (e) { console.error('Auth init failed:', e); }
  }

  // Título
  document.title = typeof to.meta.title === 'string' ? to.meta.title : 'Intranet Corporativa';

  const isPublic      = !!to.meta.public;
  const guestOnly     = !!to.meta.guestOnly;
  const requiresAuth  = !!to.meta.requiresAuth;
  const requiresAdmin = !!to.meta.requiresAdmin;
  const name          = String(to.name || '');

  // 1) Rutas públicas
  if (isPublic) {
    // si es solo-guest y ya hay sesión, manda al dashboard correspondiente
    if (guestOnly && authStore.isAuthenticated) {
      return authStore.isAdmin ? { name: 'admin-dashboard' } : { name: 'home' };
    }
    return true;
  }

  // 2) Requiere autenticación
  if (requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  // 3) Verificación de email (omite si la ruta pertenece al bypass)
  const shouldBypass = BYPASS_VERIFICATION.has(name);
  if (!shouldBypass && authStore.isAuthenticated && !authStore.isEmailVerified) {
    return {
      name: 'email-verification',
      query: { email: authStore.user?.email, redirect: to.fullPath }
    };
  }

  // 4) Admin
  if (requiresAdmin && !authStore.isAdmin) {
    return { name: 'forbidden' };
  }

  return true;
});

export default router;
