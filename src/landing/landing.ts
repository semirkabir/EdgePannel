/**
 * Landing page entry — kept intentionally tiny and fully decoupled from the
 * dashboard bundle. Heavy pieces (globe canvas, live data) load lazily.
 */

// Opt into the scroll-reveal animation. Until this runs, `.lp-reveal` content is
// plainly visible, so a failure anywhere below degrades to a static page rather
// than a blank one. Set first, before anything that could throw.
document.documentElement.classList.add('lp-anim');

// --- Mark the current page in every nav ---
// Nothing indicated which page you were on: nav, mobile menu and footer all
// rendered identically on all nine marketing pages. Matching on pathname keeps
// this working for pages added later without touching each one's markup.
{
  const here = location.pathname.replace(/\/+$/, '') || '/';
  const selector = '.lp-nav-links a[href], .lp-nav-menu a[href], .lp-footer-col a[href]';
  for (const link of document.querySelectorAll<HTMLAnchorElement>(selector)) {
    const href = link.getAttribute('href') ?? '';
    // Only same-page destinations count — never in-page anchors like /#who,
    // which describe a section of the landing page rather than a location.
    if (!href.startsWith('/') || href.includes('#')) continue;
    const target = href.replace(/\/+$/, '') || '/';
    if (target === here) link.setAttribute('aria-current', 'page');
  }
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Sticky nav state ---
const nav = document.getElementById('nav');
function syncNav(): void {
  nav?.classList.toggle('lp-scrolled', window.scrollY > 8);
}
window.addEventListener('scroll', syncNav, { passive: true });
syncNav();

// --- Mobile hamburger menu ---
const burger = document.getElementById('nav-burger');
const navMenu = document.getElementById('nav-menu');
if (burger && nav && navMenu) {
  const setOpen = (open: boolean): void => {
    nav.classList.toggle('lp-menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
  };
  burger.addEventListener('click', () => {
    setOpen(!nav.classList.contains('lp-menu-open'));
  });
  // Close after picking a section so the anchor is visible immediately.
  navMenu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => setOpen(false));
  });
}

// --- Numeral count-up ---
// The markup always ships the final value, so a no-JS or reduced-motion visitor
// reads the real number and this only ever replays it as a tween.
function countUp(el: HTMLElement): void {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix ?? '';
  if (!Number.isFinite(target)) return;
  const started = performance.now();
  const duration = 1200;
  const tick = (now: number): void => {
    const t = Math.min((now - started) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = `${Math.round(target * eased)}${suffix}`;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// --- Scroll reveal (also fires any count-up numerals inside the revealed block) ---
const revealables = document.querySelectorAll<HTMLElement>('.lp-reveal');
if (reducedMotion || !('IntersectionObserver' in window)) {
  revealables.forEach((el) => el.classList.add('lp-in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('lp-in');
          entry.target.querySelectorAll<HTMLElement>('dt[data-count]').forEach(countUp);
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -60px', threshold: 0.1 }
  );
  revealables.forEach((el) => io.observe(el));
}

// --- Hero stats sit above the fold, so they run on load rather than on reveal ---
if (!reducedMotion) {
  document.querySelectorAll<HTMLElement>('.lp-hero-stats dt[data-count]').forEach(countUp);
}

// --- Alternate the ⌘K / Ctrl+K shortcut label so both audiences see "their" key ---
// Flips like a split-flap display: rotate the current label away, swap the
// text while it's edge-on (invisible), then rotate the new label in. The
// wrapping .lp-shortcut box has a fixed width so "commander." never shifts.
const shortcutSwap = document.getElementById('shortcut-swap');
if (shortcutSwap) {
  const labels = ['⌘K', 'Ctrl+K'];
  let i = 0;
  const FLIP_MS = 220;
  setInterval(() => {
    i = (i + 1) % labels.length;
    if (reducedMotion) {
      shortcutSwap.textContent = labels[i] as string;
      return;
    }
    shortcutSwap.style.transition = `transform ${FLIP_MS}ms ease-in`;
    shortcutSwap.style.transform = 'rotateX(90deg)';
    window.setTimeout(() => {
      shortcutSwap.textContent = labels[i] as string;
      // Jump to the mirrored starting angle with no transition, then
      // animate back to flat — this is what makes it read as one flip
      // instead of the new label spinning in backwards.
      shortcutSwap.style.transition = 'none';
      shortcutSwap.style.transform = 'rotateX(-90deg)';
      void shortcutSwap.offsetWidth; // force reflow so the next line transitions
      shortcutSwap.style.transition = `transform ${FLIP_MS}ms ease-out`;
      shortcutSwap.style.transform = 'rotateX(0deg)';
    }, FLIP_MS);
  }, 2000);
}

// --- Nav dropdowns (desktop) ---
// querySelectorAll, not querySelector: this used to wire only the first
// .lp-nav-drop, so adding a second one left it inert with no visible error.
const drops = document.querySelectorAll<HTMLElement>('.lp-nav-drop');
if (drops.length) {
  const setters: Array<(open: boolean) => void> = [];

  for (const drop of drops) {
    const dropBtn = drop.querySelector<HTMLButtonElement>('.lp-nav-drop-btn');
    if (!dropBtn) continue;

    const setDropOpen = (open: boolean): void => {
      drop.classList.toggle('lp-drop-open', open);
      dropBtn.setAttribute('aria-expanded', String(open));
    };
    setters.push(setDropOpen);

    dropBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !drop.classList.contains('lp-drop-open');
      // Only one menu open at a time, so they can't overlap each other.
      for (const close of setters) close(false);
      setDropOpen(willOpen);
    });
    document.addEventListener('click', (e) => {
      if (!drop.contains(e.target as Node)) setDropOpen(false);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') for (const close of setters) close(false);
  });
}

// --- Pricing page: monthly/yearly billing toggle ---
const billingToggle = document.getElementById('billing-toggle');
if (billingToggle) {
  const pricing = document.getElementById('pricing');
  const setInterval = (yearly: boolean): void => {
    pricing?.classList.toggle('lp-yearly', yearly);
    billingToggle.setAttribute('aria-checked', String(yearly));
    billingToggle.querySelectorAll<HTMLElement>('[data-interval]').forEach((el) => {
      el.classList.toggle('lp-billing-active', el.dataset.interval === (yearly ? 'year' : 'month'));
    });
    // Repoint every paid CTA at the chosen interval.
    document.querySelectorAll<HTMLAnchorElement>('a[data-tier-cta]').forEach((a) => {
      const tier = a.dataset.tierCta;
      if (!tier || tier === 'free') return;
      a.href = `/app?upgrade=${tier}${yearly ? '&interval=year' : ''}`;
    });
  };
  billingToggle.addEventListener('click', () => {
    setInterval(!pricing?.classList.contains('lp-yearly'));
  });
  billingToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setInterval(!pricing?.classList.contains('lp-yearly'));
    }
  });
}

// --- Lazy: globe hero (skip on reduced motion; CSS glow remains as fallback) ---
const globeCanvas = document.getElementById('globe-canvas') as HTMLCanvasElement | null;
if (globeCanvas) {
  if (reducedMotion) {
    void import('./globe').then((m) => m.drawStaticGlobe(globeCanvas));
  } else {
    void import('./globe').then((m) => m.startGlobe(globeCanvas));
  }
}

// --- Mouse parallax: tilt the globe a few degrees toward the cursor ---
const hero = document.getElementById('hero');
if (hero && globeCanvas && !reducedMotion && window.matchMedia('(pointer: fine)').matches) {
  const MAX_TILT = 4;
  let raf = 0;
  hero.addEventListener('mousemove', (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const rect = hero.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      globeCanvas.style.setProperty('--tiltY', `${(nx * MAX_TILT * 2).toFixed(2)}deg`);
      globeCanvas.style.setProperty('--tiltX', `${(-ny * MAX_TILT * 2).toFixed(2)}deg`);
    });
  });
  hero.addEventListener('mouseleave', () => {
    globeCanvas.style.setProperty('--tiltX', '0deg');
    globeCanvas.style.setProperty('--tiltY', '0deg');
  });
}

// --- Lazy: live proof widgets, when the section approaches the viewport ---
const liveSection = document.getElementById('live');
if (liveSection) {
  const load = (): void => {
    void import('./live-widgets').then((m) => m.initLiveWidgets());
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(liveSection);
  } else {
    load();
  }
}
