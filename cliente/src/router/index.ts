// src/router/index.ts
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { authGuard } from './guards';

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
  // Raíz: no consultamos el store aquí para evitar condiciones de inicialización.
  // Dejamos que el guard decida a dónde va el usuario.
  {
    path: '/',
    redirect: { name: 'home' }
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

// Usa el guard centralizado (maneja auth, admin, verificación y redirect seguro)
router.beforeEach(authGuard);

// Título de página (lo mantenemos separado para no mezclar con auth)
router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'Intranet Corporativa';
  // Evita excepciones en SSR/herramientas
  if (typeof document !== 'undefined') {
    document.title = title;
  }
});

export default router;
