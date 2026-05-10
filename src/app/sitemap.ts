import type { MetadataRoute } from 'next';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['/', '/decisions'];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/' ? 'hourly' : 'daily',
    priority: route === '/' ? 1 : 0.8,
  }));
}
