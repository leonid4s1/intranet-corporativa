// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authGuard } from './guards'

// ⬅️ IMPORTA EL LAYOUT
import DefaultLayout from '@/layouts/DefaultLayout.vue'

// Vistas (lazy)
const LoginView               = () => import('@/views/auth/LoginView.vue')
// const RegisterView         = () => import('@/views/auth/RegisterView.vue') // eliminado
const EmailVerificationView   = () => import('@/views/auth/EmailVerificationView.vue')

const AdminDashboard          = () => import('@/views/admin/AdminHome.vue')
const AdminAnnouncements      = () => import('@/views/admin/AdminAnnouncements.vue') // ⬅️ NUEVA
const UserRolesAdmin          = () => import('@/views/admin/UserRolesAdmin.vue')
const UserManagement          = () => import('@/views/admin/UserManagement.vue')
const VacationManagement      = () => import('@/views/admin/AdminVacationManagement.vue')
const VacationsApprovedAdmin  = () => import('@/views/admin/VacationsApprovedAdmin.vue')

const UserDashboard           = () => import('@/views/user/Home.vue')
const VacationCalendar        = () => import('@/views/user/VacationCalendar.vue')

// 👇 NUEVO: vista de cambio de contraseña (usuario autenticado)
const ChangePassword          = () => import('@/views/account/ChangePassword.vue')

const ForbiddenView           = () => import('@/views/errors/ForbiddenView.vue')
const NotFoundView            = () => import('@/views/errors/NotFoundView.vue')

const routes: Array<RouteRecordRaw> = [
  // Públicas (solo invitados)
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { public: true, guestOnly: true, title: 'Iniciar Sesión', requiresVerifiedEmail: false }
  },
  {
    path: '/register',
    redirect: { name: 'login' },
    meta: { public: true }
  },

  // Verificación de email (pública)
  {
    path: '/verify-email/:token?',
    name: 'email-verification',
    component: EmailVerificationView,
    props: true,
    meta: { public: true, title: 'Verificación de Email', requiresVerifiedEmail: false }
  },
  {
    path: '/email-verification/:token?',
    redirect: (to) => ({ name: 'email-verification', params: to.params, query: to.query }),
    meta: { public: true }
  },

  // 🟦 ÁREA DE USUARIO BAJO EL LAYOUT (Sidebar en todas estas rutas)
  {
    path: '/',
    component: DefaultLayout, // ← aquí vive el sidebar + drawer móvil
    meta: { requiresAuth: true }, // guard general para todo el bloque
    children: [
      { path: '', redirect: { name: 'home' } }, // raíz -> home
      {
        path: 'home',
        name: 'home',
        component: UserDashboard,
        meta: { title: 'Inicio' }
      },
      {
        path: 'vacaciones',
        name: 'vacations',
        component: VacationCalendar,
        meta: { title: 'Calendario de Vacaciones' }
      },

      // 👇 NUEVO: Cambiar contraseña
      {
        path: 'account/password',
        name: 'change-password',
        component: ChangePassword,
        meta: { title: 'Cambiar contraseña' }
      },
      // (opcional) alias legible
      {
        path: 'settings/password',
        redirect: { name: 'change-password' }
      },

      // 👉 aquí puedes añadir más vistas de usuario
      // { path: 'tareas', name: 'tareas', component: () => import('@/views/Tasks.vue'), meta: { title: 'Tareas' } },
      // { path: 'documentacion', name: 'docs', component: () => import('@/views/Docs.vue'), meta: { title: 'Documentación' } },
      // { path: 'formatos', name: 'formatos', component: () => import('@/views/Formats.vue'), meta: { title: 'Formatos' } },
    ],
  },

  // Admin (sin el DefaultLayout de usuario; si quieres, podemos crear un AdminLayout aparte)
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
    path: '/admin/vacations/approved',
    name: 'vacations-approved-admin',
    component: VacationsApprovedAdmin,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Vacaciones aprobadas' }
  },
  {
    path: '/admin/announcements',
    name: 'admin-announcements',
    component: AdminAnnouncements,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Comunicados' } // ⬅️ NUEVA
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
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, saved) {
    return saved || { top: 0 }
  }
})

// Guard centralizado
router.beforeEach(authGuard)

// Título de página
router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'Intranet Corporativa'
  if (typeof document !== 'undefined') document.title = title
})

export default router
