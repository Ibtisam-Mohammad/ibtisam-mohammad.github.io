import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// PLACEHOLDER: replace with the real production URL before deploy [SITE_URL]
// (also update public/robots.txt and rerun scripts/make-og.py after renaming)
export default defineConfig({
  site: 'https://example.com',
  compressHTML: true,
  integrations: [sitemap()],
});
