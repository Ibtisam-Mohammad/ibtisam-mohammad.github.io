// RSS feed for the field notes — the distribution channel engineers and
// aggregators actually subscribe to. Linked from every page head.
import rss from '@astrojs/rss';
import { notes } from '../data/notes';

export function GET(context) {
  return rss({
    title: 'Ibtisam Mohammad — field notes',
    description:
      'Field notes on production computer vision, generative AI, agents, and MLOps — written from shipped systems and home-lab experiments.',
    site: context.site,
    items: notes
      .slice()
      .sort((a, b) => (a.published < b.published ? 1 : -1))
      .map((note) => ({
        title: note.title,
        description: note.dek,
        link: `/notes/${note.slug}/`,
        pubDate: new Date(`${note.published}T00:00:00Z`),
        categories: note.tags.map((tag) => tag.t),
      })),
    customData: '<language>en</language>',
  });
}
