const pagePath = () => {
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical?.href) {
    try {
      return new URL(canonical.href).pathname;
    } catch {}
  }
  return window.location.pathname || '/';
};

const eventName = (name) => `${name}:${pagePath()}`;

function track(name, title) {
  if (typeof window.goatcounterTrack !== 'function') return;
  window.goatcounterTrack({
    path: eventName(name),
    title,
    event: true,
    no_session: true,
  });
}

function outboundName(hostname) {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'github.com') return 'outbound:github';
  if (host === 'linkedin.com') return 'outbound:linkedin';
  if (host === 'calendar.app.google') return 'contact:booking';
  return `outbound:${host.replace(/[^a-z0-9.-]/g, '-')}`;
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('a[href], button[data-copy-email]') : null;
  if (!target) return;

  if (target instanceof HTMLButtonElement && target.dataset.copyEmail) {
    track('contact:copy-email', 'Email address copied');
    return;
  }

  if (!(target instanceof HTMLAnchorElement)) return;
  const href = target.getAttribute('href');
  if (!href || href.startsWith('#')) return;

  if (href.startsWith('mailto:')) {
    track('contact:email', 'Email link opened');
    return;
  }

  let destination;
  try {
    destination = new URL(href, window.location.href);
  } catch {
    return;
  }

  if (destination.origin === window.location.origin) {
    if (/\/resume\.pdf$/i.test(destination.pathname)) {
      track('asset:resume', 'Resume PDF opened');
    } else if (destination.pathname.startsWith('/notes/')) {
      const slug = destination.pathname.split('/').filter(Boolean).at(-1) || 'unknown';
      track(`note:open:${slug}`, `Field note opened: ${slug}`);
    }
    return;
  }

  if (destination.protocol === 'http:' || destination.protocol === 'https:') {
    track(outboundName(destination.hostname), `Outbound link: ${destination.hostname}`);
  }
}, { capture: true });

const sectionIds = ['foundations', 'ml', 'vision', 'generative', 'mlops', 'work', 'notes', 'contact'];
const visibleSections = new Set();

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || visibleSections.has(entry.target.id)) continue;
      visibleSections.add(entry.target.id);
      track(`section:view:${entry.target.id}`, `Section viewed: ${entry.target.id}`);
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.35 });

  for (const id of sectionIds) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}

const milestones = [50, 75, 90];
const reachedMilestones = new Set();
let scrollFrame = 0;

function checkScrollDepth() {
  scrollFrame = 0;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return;
  const progress = (window.scrollY / scrollable) * 100;
  for (const milestone of milestones) {
    if (progress < milestone || reachedMilestones.has(milestone)) continue;
    reachedMilestones.add(milestone);
    track(`engagement:scroll-${milestone}`, `Scroll depth: ${milestone}%`);
  }
}

window.addEventListener('scroll', () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(checkScrollDepth);
}, { passive: true });

let remainingEngagement = 30_000;
let engagementStartedAt = 0;
let engagementTimer = 0;
let engagementRecorded = false;

function pauseEngagement() {
  if (!engagementStartedAt || engagementRecorded) return;
  window.clearTimeout(engagementTimer);
  remainingEngagement -= performance.now() - engagementStartedAt;
  engagementStartedAt = 0;
}

function resumeEngagement() {
  if (document.hidden || engagementRecorded || engagementStartedAt) return;
  engagementStartedAt = performance.now();
  engagementTimer = window.setTimeout(() => {
    engagementRecorded = true;
    track('engagement:active-30s', 'Active reading time: 30 seconds');
  }, Math.max(0, remainingEngagement));
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseEngagement();
  else resumeEngagement();
});
resumeEngagement();
