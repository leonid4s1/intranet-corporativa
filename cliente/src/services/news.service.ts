// cliente/src/services/news.service.ts
import api, { UPLOADS_BASE_URL } from './api' // 👈 añadimos UPLOADS_BASE_URL

/* ===== Tipos permitidos ===== */
export const allowedTypes = [
  'static',
  'holiday_notice',
  'birthday_self',
  'birthday_digest_info',
  'birthday_digest',
  'announcement',
] as const
export type AllowedType = (typeof allowedTypes)[number]

/* ===== Modelos base ===== */
export type NewsItem = {
  id: string
  type: AllowedType
  title: string
  body?: string
  excerpt?: string
  imageUrl?: string | null
  ctaText?: string | null
  ctaTo?: string | null
  visibleFrom?: string
  visibleUntil?: string
}

type ServerNewsItem = {
  id: string | number
  type: string
  title?: string
  body?: string
  excerpt?: string
  imageUrl?: string | null
  ctaText?: string | null
  ctaTo?: string | null
  visibleFrom?: string
  visibleUntil?: string
}

type HomeFeedResponse = { items: ServerNewsItem[] }

/* ===== Helpers base ===== */
function isAllowedType(t: string): t is AllowedType {
  return (allowedTypes as readonly string[]).includes(t as AllowedType)
}

function isWithinWindow(now: Date, from?: string, until?: string): boolean {
  const n = now.getTime()
  const f = from ? new Date(from).getTime() : -Infinity
  const u = until ? new Date(until).getTime() : Infinity
  return n >= f && n < u
}

export function makeNoNewsItem(): NewsItem {
  return {
    id: 'no-news',
    type: 'static',
    title: 'Sin noticias o comunicados',
    excerpt: 'No hay Noticias o Comunicados por ahora.',
    imageUrl: null,
    ctaText: null,
    ctaTo: null,
  }
}

function normalize(raw: ServerNewsItem): NewsItem {
  const safeType: AllowedType = isAllowedType(raw.type)
    ? (raw.type as AllowedType)
    : 'static'
  if (safeType === 'static' && raw.type && raw.type !== 'static') {
    console.warn('[news.service] Tipo no permitido recibido:', raw.type)
  }

   const title = (raw.title ?? 'Aviso').toString().trim()
  const body = (raw.body ?? '').toString().trim()

  // Para cards: usamos excerpt si viene; si no, usamos body como preview (excepto cumpleaños digest_info)
  const rawExcerpt = (raw.excerpt ?? '').toString().trim()

  const excerpt =
    rawExcerpt ||
    (safeType === 'holiday_notice' ? `Próximo día festivo: ${title}` : body)

  // 👇 si viene ruta relativa (/uploads/...), prepende el dominio del backend
  const rawImg = raw.imageUrl ?? null
  const imageUrl =
    rawImg && rawImg.startsWith('/uploads/')
      ? `${UPLOADS_BASE_URL}${rawImg}`
      : rawImg

  return {
    id: String(raw.id),
    type: safeType,
    title,
    body,
    excerpt,
    imageUrl,
    ctaText: raw.ctaText ?? null,
    ctaTo: raw.ctaTo ?? null,
    visibleFrom: raw.visibleFrom,
    visibleUntil: raw.visibleUntil,
  }
}

function priorityScore(it: NewsItem): number {
  switch (it.type) {
    case 'holiday_notice':
      return 120
    case 'birthday_self':
      return 100
    case 'birthday_digest_info':
    case 'birthday_digest':
      return 80
    case 'announcement':
      return 70
    case 'static':
    default:
      return 50
  }
}

/* ===== API: Home feed ===== */
export async function getHomeNews(): Promise<NewsItem[]> {
  try {
    const { data } = await api.get<HomeFeedResponse>('/news/home')
    const items = data?.items ?? []
    const now = new Date()

    const normalized = items.map(normalize)

    const windowFiltered = normalized.filter((it) =>
      isWithinWindow(now, it.visibleFrom, it.visibleUntil)
    )

    const hasSelf = windowFiltered.some((it) => it.type === 'birthday_self')
    const filtered = hasSelf
      ? windowFiltered.filter(
          (it) =>
            it.type !== 'birthday_digest_info' &&
            it.type !== 'birthday_digest'
        )
      : windowFiltered

    const seen = new Set<string>()
    const deduped = filtered.filter((it) => {
      if (seen.has(it.id)) return false
      seen.add(it.id)
      return true
    })

    let result = deduped.sort((a, b) => {
      const pa = priorityScore(a)
      const pb = priorityScore(b)
      if (pb !== pa) return pb - pa

      if (a.type === 'holiday_notice' && b.type === 'holiday_notice') {
        const ua = a.visibleUntil ? new Date(a.visibleUntil).getTime() : Infinity
        const ub = b.visibleUntil ? new Date(b.visibleUntil).getTime() : Infinity
        if (ua !== ub) return ua - ub
      }

      const ta = a.visibleFrom ? new Date(a.visibleFrom).getTime() : 0
      const tb = b.visibleFrom ? new Date(b.visibleFrom).getTime() : 0
      return tb - ta
    })

    if (!result.length && normalized.length) {
      console.warn(
        '[news.service] resultado vacío tras filtros; usando normalized sin filtros',
        {
          backendItems: items.length,
          normalizedItems: normalized.length,
        }
      )
      result = normalized
    }

    return result
  } catch (err) {
    console.error('[news.service] Error obteniendo /news/home', err)
    return []
  }
}

/* ===== API: Crear Comunicado ===== */
export type CreateAnnouncementPayload = {
  title: string
  body?: string | null
  excerpt?: string | null
  ctaText?: string | null
  ctaTo?: string | null
  visibleFrom?: string | Date | null
  visibleUntil?: string | Date | null
  image?: File | null
}

function toIsoIfDate(v: unknown): string | undefined {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string' && v.trim() !== '') return v
  return undefined
}

export async function createAnnouncement(
  payload: CreateAnnouncementPayload
) {
  const fd = new FormData()

  // Campos texto/fecha (sin undefined/empty)
  if (payload.title) fd.append('title', payload.title)
  if (payload.body) fd.append('body', payload.body)
  if (payload.excerpt) fd.append('excerpt', payload.excerpt)
  if (payload.ctaText) fd.append('ctaText', payload.ctaText)
  if (payload.ctaTo) fd.append('ctaTo', payload.ctaTo)

  const vf = toIsoIfDate(payload.visibleFrom ?? undefined)
  const vu = toIsoIfDate(payload.visibleUntil ?? undefined)
  if (vf) fd.append('visibleFrom', vf)
  if (vu) fd.append('visibleUntil', vu)

  // Imagen (nombre de campo EXACTO: 'image')
  if (payload.image instanceof File) {
    fd.append('image', payload.image, payload.image.name)
  }

  try {
    const { data } = await api.post('/news/announcements', fd, {
      withCredentials: true,
    })
    return data
  } catch (err) {
    console.error('[Announcement] create error', err)
    throw err
  }
}

/* =======================================================
 *   API ADMIN: Listar / actualizar / eliminar comunicados
 * ======================================================= */

export type AdminAnnouncement = NewsItem & {
  body?: string
  status?: string
  isActive?: boolean
  priority?: string
  createdAt?: string
  updatedAt?: string
  /** true si actualmente está publicado y dentro de ventana de visibilidad */
  published: boolean
}

type ServerAnnouncement = ServerNewsItem & {
  status?: string
  isActive?: boolean
  priority?: string
  createdAt?: string
  updatedAt?: string
  published?: boolean
}

type AdminListResponse = {
  ok: boolean
  data: ServerAnnouncement[]
}

type AdminOneResponse = {
  ok: boolean
  data: ServerAnnouncement
}

function normalizeAdminAnnouncement(
  raw: ServerAnnouncement
): AdminAnnouncement {
  const base = normalize(raw)
  return {
    ...base,
    body: raw.body,
    status: raw.status,
    isActive: raw.isActive,
    priority: raw.priority,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    published: Boolean(raw.published),
  }
}

export async function fetchAdminAnnouncements(
  all: boolean = true
): Promise<AdminAnnouncement[]> {
  try {
    const { data } = await api.get<AdminListResponse>('/news/announcements', {
      params: all ? { all: 'true' } : {},
    })

    const items: ServerAnnouncement[] = data?.data ?? []
    return items.map(normalizeAdminAnnouncement)
  } catch (err) {
    console.error('[Announcement] admin list error', err)
    throw err
  }
}

export type UpdateAnnouncementPayload = Partial<CreateAnnouncementPayload> & {
  status?: string
  isActive?: boolean
  priority?: string
}

export async function updateAnnouncement(
  id: string,
  payload: UpdateAnnouncementPayload
): Promise<AdminAnnouncement> {
  const fd = new FormData()

  if (payload.title !== undefined) fd.append('title', payload.title ?? '')
  if (payload.body !== undefined) fd.append('body', payload.body ?? '')
  if (payload.excerpt !== undefined) fd.append('excerpt', payload.excerpt ?? '')
  if (payload.ctaText !== undefined) fd.append('ctaText', payload.ctaText ?? '')
  if (payload.ctaTo !== undefined) fd.append('ctaTo', payload.ctaTo ?? '')

  if (payload.visibleFrom !== undefined) {
    const vf = toIsoIfDate(payload.visibleFrom)
    if (vf) fd.append('visibleFrom', vf)
    else fd.append('visibleFrom', '')
  }

  if (payload.visibleUntil !== undefined) {
    const vu = toIsoIfDate(payload.visibleUntil)
    if (vu) fd.append('visibleUntil', vu)
    else fd.append('visibleUntil', '')
  }

  if (payload.status !== undefined) {
    fd.append('status', payload.status)
  }
  if (payload.isActive !== undefined) {
    fd.append('isActive', String(payload.isActive))
  }
  if (payload.priority !== undefined) {
    fd.append('priority', payload.priority)
  }

  if (payload.image instanceof File) {
    fd.append('image', payload.image, payload.image.name)
  }

  try {
    const { data } = await api.put<AdminOneResponse>(
      `/news/announcements/${id}`,
      fd,
      {
        withCredentials: true,
      }
    )
    const raw = data.data
    return normalizeAdminAnnouncement(raw)
  } catch (err) {
    console.error('[Announcement] update error', err)
    throw err
  }
}

export async function deleteAnnouncement(id: string): Promise<void> {
  try {
    await api.delete(`/news/announcements/${id}`, { withCredentials: true })
  } catch (err) {
    console.error('[Announcement] delete error', err)
    throw err
  }
}
