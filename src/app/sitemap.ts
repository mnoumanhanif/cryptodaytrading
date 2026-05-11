import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/siteUrl';

const changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'daily';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['/', '/decisions', '/opportunities'];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency,
    priority: route === '/' ? 1 : 0.8,
  }));
}
