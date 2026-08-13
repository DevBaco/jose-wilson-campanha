import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site';

export const GET: APIRoute = ({ site }) => {
  const baseUrl = site ?? new URL(SITE_URL);
  const sitemapUrl = new URL('/sitemap-index.xml', baseUrl);
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemapUrl.href}`, ''].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
