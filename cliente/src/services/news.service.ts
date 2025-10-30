import api from './api';

export const allowedTypes = [
  'static',
  'holiday_notice',
  'birthday_self',
  'birthday_digest_info',
  'birthday_digest', // compat: por si el server envía este
] as const;
export type AllowedType = typeof allowedTypes[number];

export type NewsItem = {
  id: string;
  type: AllowedType;
  title: string;
  excerpt?: string;
  imageUrl?: string | null;
  ctaText?: string | null;
  ctaTo?: string | null;
  visibleFrom?: string;   // ISO
  visibleUntil?: string;  // ISO (exclusive)
};

// Estructura que devuelve el server (sin any)
type ServerNewsItem = {
  id: string | number;
  type: string;                 // puede venir cualquier string
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

/** Type guard: restringe a AllowedType de forma segura */
function isAllowedType(t: string): t is AllowedType {
  return (allowedTypes as readonly string[]).includes(t);
}

/** Ventana de visibilidad (from <= now < until). Si no hay fechas, consideramos infinito. */
function isWithinWindow(now: Date, from?: string, until?: string): boolean {
  const n = now.getTime();
  const f = from ? new Date(from).getTime() : -Infinity;
  const u = until ? new Date(until).getTime() : Infinity;
  return n >= f && n < u;
}

/** Tarjeta placeholder cuando no hay noticias */
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

/** Normaliza un item del servidor a NewsItem seguro */
function normalize(raw: ServerNewsItem): NewsItem {
  const safeType: AllowedType = isAllowedType(raw.type) ? (raw.type as AllowedType) : 'static';
  if (safeType === 'static' && raw.type && raw.type !== 'static') {
    console.warn('[news.service] Tipo no permitido recibido:', raw.type);
  }
  return {
    id: String(raw.id),
    type: safeType,
    title: raw.title ?? 'Aviso',
    excerpt: raw.excerpt ?? raw.body ?? '',
    imageUrl: raw.imageUrl ?? null,
    ctaText: raw.ctaText ?? null,
    ctaTo: raw.ctaTo ?? null,
    visibleFrom: raw.visibleFrom,
    visibleUntil: raw.visibleUntil,
  };
}

/** Obtiene y filtra las noticias para el home */
export async function getHomeNews(): Promise<NewsItem[]> {
  try {
    const { data } = await api.get<HomeFeedResponse>('/news/home');
    const items = data?.items ?? [];
    const now = new Date();

    const normalized = items
      .map(normalize)
      .filter((it) => isWithinWindow(now, it.visibleFrom, it.visibleUntil));

    // Si existe 'birthday_self', oculta cualquier digest (info/legacy)
    const hasSelf = normalized.some((it) => it.type === 'birthday_self');
    const withoutDigestIfSelf = hasSelf
      ? normalized.filter(
          (it) => it.type !== 'birthday_digest_info' && it.type !== 'birthday_digest'
        )
      : normalized;

    // Deduplicación defensiva por id
    const seen = new Set<string>();
    return withoutDigestIfSelf.filter((it) => {
      if (seen.has(it.id)) return false;
      seen.add(it.id);
      return true;
    });
  } catch (err) {
    console.error('[news.service] Error obteniendo /news/home', err);
    // El carrusel mostrará el placeholder si esto devuelve []
    return [];
  }
}
