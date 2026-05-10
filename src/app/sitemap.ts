import type { MetadataRoute } from 'next';

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['/', '/decisions'];

  return routes.map((route) => {
    const changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] =
      'daily';

    return {
      url: `${SITE_URL}${route}`,
      changeFrequency,
      priority: route === '/' ? 1 : 0.8,
    };
  });
}
