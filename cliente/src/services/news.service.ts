// cliente/src/services/news.service.ts
import api from './api';

export type NewsItem = {
  id: string;
  type: 'static' | 'holiday_notice' | 'birthday_self' | 'birthday_digest_info';
  title: string;
  body: string;
  visibleFrom?: string; // ISO
  visibleUntil?: string; // ISO (exclusive)
};

export async function getHomeNews(): Promise<NewsItem[]> {
  const { data } = await api.get('/news/home');
  return data.items as NewsItem[];
}
