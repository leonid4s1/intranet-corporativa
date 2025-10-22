// cliente/src/services/news.service.ts
import api from './api';

const allowedTypes = ['static', 'holiday_notice', 'birthday_self', 'birthday_digest_info'] as const;
type AllowedType = typeof allowedTypes[number];

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

function isAllowedType(t: string): t is AllowedType {
  // cast solo de array a string[], NO a any
  return (allowedTypes as readonly string[]).includes(t);
}

function isWithinWindow(now: Date, from?: string, until?: string): boolean {
  const n = now.getTime();
  const f = from ? new Date(from).getTime() : -Infinity;
  const u = until ? new Date(until).getTime() : Infinity;
  return n >= f && n < u;
}

export async function getHomeNews(): Promise<NewsItem[]> {
  const { data } = await api.get<HomeFeedResponse>('/news/home');
  const items = data?.items ?? [];
  const now = new Date();

  return items
    .map<NewsItem>((it) => {
      const safeType: AllowedType = isAllowedType(it.type) ? it.type : 'static';
      return {
        id: String(it.id),
        type: safeType,
        title: it.title ?? 'Aviso',
        excerpt: it.excerpt ?? it.body ?? '',
        imageUrl: it.imageUrl ?? null,
        ctaText: it.ctaText ?? null,
        ctaTo: it.ctaTo ?? null,
        visibleFrom: it.visibleFrom,
        visibleUntil: it.visibleUntil,
      };
    })
    .filter((it) => isWithinWindow(now, it.visibleFrom, it.visibleUntil));
}
