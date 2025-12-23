// cliente/src/services/docs.service.ts
import api from './api'

export type DocCategory = 'manuales' | 'reglamentos' | 'politicas'

export type DocItem = {
  id: string
  category: DocCategory
  title: string
  version?: string | null
  updatedAt?: string | null
  sizeMB?: number | null
  status?: string | null
  viewUrl?: string | null
  downloadUrl?: string | null
}

export async function fetchDocs(category: DocCategory) {
  const { data } = await api.get('/docs', { params: { category }, withCredentials: true })
  return (data?.data || []) as DocItem[]
}
