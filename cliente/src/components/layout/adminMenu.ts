// cliente/src/components/layout/adminMenu.ts
export type Role = 'admin' | 'manager' | 'hr' | 'user';

export type AdminMenuItem = {
  label: string;
  to?: { name: string } | string;
  icon?: string;              // opcional (ej. 'CalendarCheck')
  roles?: Role[];             // quiénes lo ven (si se omite, lo ven todos los logueados)
  children?: AdminMenuItem[];
};

export const adminMenu: AdminMenuItem[] = [
  // Inicio / panel principal
  { label: 'Panel', to: { name: 'admin-dashboard' }, roles: ['admin'] },

  // Gestión de usuarios
  { label: 'Usuarios', to: { name: 'user-management' }, roles: ['admin'] },

  // Vacaciones (submenú)
  {
    label: 'Vacaciones',
    roles: ['admin'], // si también managers/HR, agrégalos aquí
    children: [
      { label: 'Gestión de Vacaciones', to: { name: 'vacation-management' } },
      {
        label: 'Vacaciones aprobadas',
        to: { name: 'vacations-approved-admin' },
        icon: 'CalendarCheck',
      },
    ],
  },

  // Nuevo: Comunicados
  {
    label: 'Comunicados',
    to: { name: 'admin-announcements' }, // nombre del route de AdminAnnouncements.vue
    roles: ['admin'],
  },
];
