// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { authGuard } from './guards';

// Vistas (lazy)
const LoginView               = () => import('@/views/auth/LoginView.vue');
// ⛔️ Registro eliminado del router (solo admin crea usuarios)
// const RegisterView         = () => import('@/views/auth/RegisterView.vue');
const EmailVerificationView   = () => import('@/views/auth/EmailVerificationView.vue');

const AdminDashboard          = () => import('@/views/admin/AdminHome.vue');
const UserRolesAdmin          = () => import('@/views/admin/UserRolesAdmin.vue');
const UserManagement          = () => import('@/views/admin/UserManagement.vue');
const VacationManagement      = () => import('@/views/admin/AdminVacationManagement.vue');
const VacationsApprovedAdmin  = () => import('@/views/admin/VacationsApprovedAdmin.vue'); // NUEVO

const UserDashboard           = () => import('@/views/user/Home.vue');
const VacationCalendar        = () => import('@/views/user/VacationCalendar.vue');

const ForbiddenView           = () => import('@/views/errors/ForbiddenView.vue');
const NotFoundView            = () => import('@/views/errors/NotFoundView.vue');

const routes: Array<RouteRecordRaw> = [
  // Raíz -> el guard decidirá según sesión
  { path: '/', redirect: { name: 'home' } },

  // Públicas (solo invitados)
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { public: true, guestOnly: true, title: 'Iniciar Sesión', requiresVerifiedEmail: false }
  },
  // 🔁 Redirect legado de /register -> /login
  {
    path: '/register',
    redirect: { name: 'login' },
    meta: { public: true }
  },

  // Verificación de email (pública para soportar el enlace desde el correo)
  {
    path: '/verify-email/:token?',
    name: 'email-verification',
    component: EmailVerificationView,
    props: true,
    meta: {
      public: true,
      title: 'Verificación de Email',
      requiresVerifiedEmail: false
    }
  },
  // Alias interno
  {
    path: '/email-verification/:token?',
    redirect: (to) => ({
      name: 'email-verification',
      params: to.params,
      query: to.query
    }),
    meta: { public: true }
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
  {
    path: '/admin/vacations/approved',                             // ← NUEVO
    name: 'vacations-approved-admin',                              // ← NUEVO
    component: VacationsApprovedAdmin,                             // ← NUEVO
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Vacaciones aprobadas' } // ← NUEVO
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
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, saved) {
    return saved || { top: 0 };
  }
});

// Guard centralizado (auth/admin/verificación/redirect)
router.beforeEach(authGuard);

// Título de página
router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'Intranet Corporativa';
  if (typeof document !== 'undefined') document.title = title;
});

export default router;
