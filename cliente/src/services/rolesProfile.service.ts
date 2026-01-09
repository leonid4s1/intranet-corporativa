// cliente/src/services/rolesProfile.service.ts
import api from './api'

export type RoleKpi = {
  label: string
  value: number
  target: number
}

export type RoleProfile = {
  department: string
  roleKey: string
  title: string
  reportsTo: string
  description: string
  responsibilities: string[]
  kpis: RoleKpi[]
  isActive: boolean
}

export async function getMyRoleProfile(): Promise<RoleProfile> {
  const res = await api.get('/roles-profile/me')
  // backend: { success: true, data: RoleProfile }
  return res.data?.data
}
