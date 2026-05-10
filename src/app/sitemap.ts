import type { MetadataRoute } from 'next';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['/', '/decisions'];

  return routes.map((route) => {
    const changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] =
      route === '/' ? 'hourly' : 'daily';

    return {
      url: `${SITE_URL}${route}`,
      lastModified: new Date(),
      changeFrequency,
      priority: route === '/' ? 1 : 0.8,
    };
  });
}
