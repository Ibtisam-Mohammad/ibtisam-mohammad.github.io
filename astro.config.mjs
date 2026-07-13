import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ibtisam-mohammad.github.io',
  compressHTML: true,
  integrations: [
    sitemap({
      serialize(item) {
        item.lastmod = '2026-07-13T00:00:00.000Z';
        return item;
      },
    }),
  ],
});
