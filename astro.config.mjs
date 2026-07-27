import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { notes } from './src/data/notes';

// per-note lastmod from real dates; a uniform hard-coded stamp teaches crawlers
// to ignore the field entirely. Pages without a meaningful date carry none.
const noteDates = new Map(
  notes.map((note) => [`/notes/${note.slug}/`, note.modified ?? note.published])
);

export default defineConfig({
  site: 'https://ibtisam-mohammad.github.io',
  compressHTML: true,
  integrations: [
    sitemap({
      serialize(item) {
        const path = new URL(item.url).pathname;
        const date = noteDates.get(path);
        if (date) {
          item.lastmod = `${date}T00:00:00.000Z`;
        } else {
          delete item.lastmod;
        }
        return item;
      },
    }),
  ],
});
