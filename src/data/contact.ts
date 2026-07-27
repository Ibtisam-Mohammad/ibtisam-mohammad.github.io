// Single source of truth for every way a buyer can reach Ibtisam. Contact details
// appear in the hero, the case-study CTA, the contact section, the footer, every
// note page, and the JSON-LD — changing an address in seven places is how one of
// them silently goes stale.

export const EMAIL = 'ibtisam115@gmail.com';
export const EMAIL_HREF = `mailto:${EMAIL}`;
export const GITHUB = 'https://github.com/Ibtisam-Mohammad';
export const LINKEDIN = 'https://www.linkedin.com/in/ibtim/';
export const RESUME = '/resume.pdf';

/**
 * Booking page for a short intro call (Google Calendar appointment schedule).
 * Set to the booking URL to light up the "Book a call" action across the site;
 * leave null and every booking affordance is omitted from the markup entirely.
 * A booking button is the highest-intent control on the page — it must never
 * render pointing at a placeholder.
 */
export const BOOKING: string | null = null;

/** Label used wherever the booking action is offered. */
export const BOOKING_LABEL = 'Book a call';
