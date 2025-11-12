// cliente/src/services/news.service.ts
import api, { UPLOADS_BASE_URL } from './api';  // 👈 añadimos UPLOADS_BASE_URL

/* ===== Tipos permitidos ===== */
export const allowedTypes = [
  'static',
  'holiday_notice',
  'birthday_self',
  'birthday_digest_info',
  'birthday_digest',
  'announcement',
] as const;
export type AllowedType = typeof allowedTypes[number];

/* ===== Modelos ===== */
export type NewsItem = {
  id: string;
  type: AllowedType;
  title: string;
  excerpt?: string;
  imageUrl?: string | null;
  ctaText?: string | null;
  ctaTo?: string | null;
  visibleFrom?: string;
  visibleUntil?: string;
};

type ServerNewsItem = {
  id: string | number;
  type: string;
  title?: string;
  body?: string;
  excerpt?: string;
  imageUrl?: string | null;
  ctaText?: string | null;
  ctaTo?: string | null;
  visibleFrom?: string;
  visibleUntil?: string;
};

type HomeFeedResponse = { items: ServerNewsItem[] };

/* ===== Helpers ===== */
function isAllowedType(t: string): t is AllowedType {
  return (allowedTypes as readonly string[]).includes(t);
}

function isWithinWindow(now: Date, from?: string, until?: string): boolean {
  const n = now.getTime();
  const f = from ? new Date(from).getTime() : -Infinity;
  const u = until ? new Date(until).getTime() : Infinity;
  return n >= f && n < u;
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
  };
}

function normalize(raw: ServerNewsItem): NewsItem {
  const safeType: AllowedType = isAllowedType(raw.type) ? (raw.type as AllowedType) : 'static';
  if (safeType === 'static' && raw.type && raw.type !== 'static') {
    console.warn('[news.service] Tipo no permitido recibido:', raw.type);
  }

  const title = (raw.title ?? 'Aviso').toString().trim();
  const baseExcerpt = (raw.excerpt ?? raw.body ?? '').toString().trim();

  const excerpt =
    baseExcerpt ||
    (safeType === 'holiday_notice' ? `Próximo día festivo: ${title}` : '');

  // 👇 si viene ruta relativa (/uploads/...), prepende el dominio del backend
  const rawImg = raw.imageUrl ?? null;
  const imageUrl =
    rawImg && rawImg.startsWith('/uploads/')
      ? `${UPLOADS_BASE_URL}${rawImg}`
      : rawImg;

  return {
    id: String(raw.id),
    type: safeType,
    title,
    excerpt,
    imageUrl,
    ctaText: raw.ctaText ?? null,
    ctaTo: raw.ctaTo ?? null,
    visibleFrom: raw.visibleFrom,
    visibleUntil: raw.visibleUntil,
  };
}

function priorityScore(it: NewsItem): number {
  switch (it.type) {
    case 'holiday_notice': return 120;
    case 'birthday_self': return 100;
    case 'birthday_digest_info':
    case 'birthday_digest': return 80;
    case 'announcement': return 70;
    case 'static':
    default: return 50;
  }
}

/* ===== API: Home feed ===== */
export async function getHomeNews(): Promise<NewsItem[]> {
  try {
    const { data } = await api.get<HomeFeedResponse>('/news/home');
    const items = data?.items ?? [];
    const now = new Date();

    const normalized = items
      .map(normalize)
      .filter((it) => isWithinWindow(now, it.visibleFrom, it.visibleUntil));

    const hasSelf = normalized.some((it) => it.type === 'birthday_self');
    const filtered = hasSelf
      ? normalized.filter(
          (it) => it.type !== 'birthday_digest_info' && it.type !== 'birthday_digest'
        )
      : normalized;

    const seen = new Set<string>();
    const deduped = filtered.filter((it) => {
      if (seen.has(it.id)) return false;
      seen.add(it.id);
      return true;
    });

    return deduped.sort((a, b) => {
      const pa = priorityScore(a);
      const pb = priorityScore(b);
      if (pb !== pa) return pb - pa;

      if (a.type === 'holiday_notice' && b.type === 'holiday_notice') {
        const ua = a.visibleUntil ? new Date(a.visibleUntil).getTime() : Infinity;
        const ub = b.visibleUntil ? new Date(b.visibleUntil).getTime() : Infinity;
        if (ua !== ub) return ua - ub;
      }

      const ta = a.visibleFrom ? new Date(a.visibleFrom).getTime() : 0;
      const tb = b.visibleFrom ? new Date(b.visibleFrom).getTime() : 0;
      return tb - ta;
    });
  } catch (err) {
    console.error('[news.service] Error obteniendo /news/home', err);
    return [];
  }
}

/* ===== API: Crear Comunicado ===== */
export type CreateAnnouncementPayload = {
  title: string;
  body?: string;
  excerpt?: string;
  ctaText?: string;
  ctaTo?: string;
  visibleFrom?: string | Date;   // aceptamos Date o string
  visibleUntil?: string | Date;
  image?: File | null;
};

function toIsoIfDate(v: unknown): string | undefined {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string' && v.trim() !== '') return v;
  return undefined;
}

export async function createAnnouncement(payload: CreateAnnouncementPayload) {
  const fd = new FormData();

  // Campos texto/fecha (sin undefined/empty)
  if (payload.title) fd.append('title', payload.title);
  if (payload.body) fd.append('body', payload.body);
  if (payload.excerpt) fd.append('excerpt', payload.excerpt);
  if (payload.ctaText) fd.append('ctaText', payload.ctaText);
  if (payload.ctaTo) fd.append('ctaTo', payload.ctaTo);

  const vf = toIsoIfDate(payload.visibleFrom);
  const vu = toIsoIfDate(payload.visibleUntil);
  if (vf) fd.append('visibleFrom', vf);
  if (vu) fd.append('visibleUntil', vu);

  // Imagen (nombre de campo EXACTO: 'image')
  if (payload.image instanceof File) {
    fd.append('image', payload.image, payload.image.name);
  }

  // ⚠️ No seteamos manualmente 'Content-Type' para que Axios agregue el boundary
  try {
    const { data } = await api.post('/news/announcements', fd);
    return data;
  } catch (err) {
    console.error('[Announcement] create error', err);
    throw err;
  }
}
