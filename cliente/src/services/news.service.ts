import api from './api';

export const allowedTypes = [
  'static',
  'holiday_notice',
  'birthday_self',
  'birthday_digest_info',
  'birthday_digest', // compat: legacy
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

  const title = (raw.title ?? 'Aviso').toString().trim();
  const baseExcerpt = (raw.excerpt ?? raw.body ?? '').toString().trim();

  const excerpt =
    baseExcerpt ||
    (safeType === 'holiday_notice' ? `Próximo día festivo: ${title}` : '');

  return {
    id: String(raw.id),
    type: safeType,
    title,
    excerpt,
    imageUrl: raw.imageUrl ?? null,
    ctaText: raw.ctaText ?? null,
    ctaTo: raw.ctaTo ?? null,
    visibleFrom: raw.visibleFrom,
    visibleUntil: raw.visibleUntil,
  };
}

/** Puntaje de prioridad para ordenar en el carrusel */
function priorityScore(it: NewsItem): number {
  switch (it.type) {
    case 'holiday_notice': return 120;       // ⬅️ ahora es el más alto
    case 'birthday_self': return 100;
    case 'birthday_digest_info':
    case 'birthday_digest': return 80;
    case 'static':
    default: return 50;
  }
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
    const filtered = hasSelf
      ? normalized.filter(
          (it) => it.type !== 'birthday_digest_info' && it.type !== 'birthday_digest'
        )
      : normalized;

    // Deduplicación defensiva por id
    const seen = new Set<string>();
    const deduped = filtered.filter((it) => {
      if (seen.has(it.id)) return false;
      seen.add(it.id);
      return true;
    });

    // Orden: prioridad desc; para holiday_notice, el más próximo primero (visibleUntil asc);
    // luego fallback por visibleFrom desc para resto.
    return deduped.sort((a, b) => {
      const pa = priorityScore(a);
      const pb = priorityScore(b);
      if (pb !== pa) return pb - pa;

      if (a.type === 'holiday_notice' && b.type === 'holiday_notice') {
        const ua = a.visibleUntil ? new Date(a.visibleUntil).getTime() : Infinity;
        const ub = b.visibleUntil ? new Date(b.visibleUntil).getTime() : Infinity;
        if (ua !== ub) return ua - ub; // más próximo primero
      }

      const ta = a.visibleFrom ? new Date(a.visibleFrom).getTime() : 0;
      const tb = b.visibleFrom ? new Date(b.visibleFrom).getTime() : 0;
      return tb - ta; // más reciente primero
    });
  } catch (err) {
    console.error('[news.service] Error obteniendo /news/home', err);
    return [];
  }
}
