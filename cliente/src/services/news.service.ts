// cliente/src/services/news.service.ts
import api from './api';

export type HomeItem = {
  id: string;
  type: 'static' | 'holiday_notice' | 'birthday_self' | 'birthday_digest_info';
  title: string;
  body?: string;
  subtitle?: string;
  date?: string;
  visibleFrom?: string;
  visibleUntil?: string;
};

export async function fetchHomeFeed(): Promise<HomeItem[]> {
  const { data } = await api.get('/news/home');
  return data?.items ?? [];
}

