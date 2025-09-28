export type Role = 'admin' | 'manager' | 'hr' | 'user';

export type AdminMenuItem = {
  label: string;
  to?: { name: string } | string;
  icon?: string;              // opcional (ej. 'CalendarCheck')
  roles?: Role[];             // quiénes lo ven (si se omite, lo ven todos los logueados)
  children?: AdminMenuItem[];
};

export const adminMenu: AdminMenuItem[] = [
  { label: 'Panel', to: { name: 'admin-dashboard' }, roles: ['admin'] },
  { label: 'Usuarios', to: { name: 'user-management' }, roles: ['admin'] },
  { label: 'Roles', to: { name: 'role-management' }, roles: ['admin'] },
  {
    label: 'Vacaciones',
    roles: ['admin'], // si también managers/HR, agrega aquí
    children: [
      { label: 'Gestión de Vacaciones', to: { name: 'vacation-management' } },
      { label: 'Vacaciones aprobadas',  to: { name: 'vacations-approved-admin' }, icon: 'CalendarCheck' }
    ]
  },
];
