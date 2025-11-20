// cliente/src/components/layout/adminMenu.ts
export type Role = 'admin' | 'manager' | 'hr' | 'user';

export type AdminMenuItem = {
  label: string;
  to?: { name: string } | string;
  icon?: string;              // opcional (ej. 'CalendarCheck')
  emoji?: string;             // emoji que se muestra en el menú colapsado
  roles?: Role[];             // quiénes lo ven (si se omite, lo ven todos los logueados)
  children?: AdminMenuItem[];
};

export const adminMenu: AdminMenuItem[] = [
  // Inicio / panel principal
  {
    label: 'Panel',
    to: { name: 'admin-dashboard' },
    roles: ['admin'],
    emoji: '🏠',
  },

  // Gestión de usuarios
  {
    label: 'Usuarios',
    to: { name: 'user-management' },
    roles: ['admin'],
    emoji: '👥',
  },

  // Vacaciones (submenú)
  {
    label: 'Vacaciones',
    roles: ['admin'], // si también managers/HR, agrégalos aquí
    emoji: '🗓️',
    children: [
      {
        label: 'Gestión de Vacaciones',
        to: { name: 'vacation-management' },
        emoji: '📝',
      },
      {
        label: 'Vacaciones aprobadas',
        to: { name: 'vacations-approved-admin' },
        icon: 'CalendarCheck',
        emoji: '✅',
      },
    ],
  },

  // Comunicados
  {
    label: 'Comunicados',
    to: { name: 'admin-announcements' }, // nombre del route de AdminAnnouncements.vue
    roles: ['admin'],
    emoji: '📢',
  },
];
