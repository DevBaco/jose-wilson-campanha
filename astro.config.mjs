// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://wilsoncampos.com.br',
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith('/404/'),
    }),
    tailwind({
      // Global styles are imported manually in the Layout for control over @layer order
      applyBaseStyles: false,
    }),
  ],
});
