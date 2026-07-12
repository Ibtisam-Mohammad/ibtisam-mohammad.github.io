import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ibtisam-mohammad.github.io',
  compressHTML: true,
  integrations: [sitemap()],
});
