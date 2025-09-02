import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "@/stores/auth.store";

// Vistas
const LoginView = () => import('@/views/auth/LoginView.vue');
const RegisterView = () => import('@/views/auth/RegisterView.vue');
const EmailVerificationView = () => import('@/views/auth/EmailVerificationView.vue');

// Admin
const AdminDashboard = () => import('@/views/admin/AdminHome.vue'); // Principal admin
const UserRolesAdmin = () => import('@/views/admin/UserRolesAdmin.vue'); // Administrador de roles
const UserManagement = () => import('@/views/admin/UserManagement.vue'); // Administrador de usuarios
const VacationManagement = () => import('@/views/admin/AdminVacationManagement.vue'); // Administrador de vacaciones

// Usuarios
const UserDashboard = () => import('@/views/user/Home.vue'); // Principal Usuarios
const VacationCalendar = () => import("@/views/user/VacationCalendar.vue");

// Errores
const ForbiddenView = () => import('@/views/errors/ForbiddenView.vue');
const NotFoundView = () => import('@/views/errors/NotFoundView.vue');

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: (to) => {
      const authStore = useAuthStore();
      if (!authStore.isInitialized) return '/login';

      if (authStore.isAuthenticated) {
        if (!authStore.isEmailVerified) {
          return {
            name: 'email-verification',
            query: { email: authStore.user?.email, redirect: to.fullPath }
          };
        }
        return authStore.isAdmin ? '/admin' : '/home';
      }

      return '/login';
    }
  },

  // Rutas públicas de auth
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { public: true, guestOnly: true, title: 'Iniciar Sesión' }
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: { public: true, guestOnly: true, title: 'Registro' }
  },
  {
    path: '/verify-email/:token?',
    name: 'email-verification',
    component: EmailVerificationView,
    meta: { public: true, title: 'Verificación de Email', requiresVerification: false }
  },

  // Rutas admin
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
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Gestion de Vacaciones'}
  },

  // Rutas usuario normal
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
    meta: { public: true, title: 'Acceso Denegado' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
    meta: { public: true, title: 'Página no encontrada' }
  }
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0, behavior: 'smooth' };
  }
});

// Guard de navegacion
router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (!authStore.isInitialized) {
    try {
      await authStore.initialize();
    } catch (error) {
      console.error('Auth initialization failed:', error);
    }
  }

  const {
    public: isPublic = false,
    guestOnly = false,
    requiresAuth = false,
    requiresAdmin = false,
    requiresVerifiedEmail = true,
    requiresVerification = true
  } = to.meta;

  document.title = typeof to.meta.title === 'string' ? to.meta.title : 'Intranet Corporativa';

  if (isPublic) {
    if (guestOnly && authStore.isAuthenticated) {
      return authStore.isAdmin ? '/admin' : '/home';
    }
    return true;
  }

  if (requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (requiresVerifiedEmail && !authStore.isEmailVerified && requiresVerification) {
    return {
      name: 'email-verification',
      query: { email: authStore.user?.email, redirect: to.fullPath }
    };
  }

  if (requiresAdmin && !authStore.isAdmin) {
    return { name: 'forbidden' };
  }

  return true;
});

export default router;
