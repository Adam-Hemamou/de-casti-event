// Animations du site : défilement doux (Lenis) + révélations au scroll (GSAP / ScrollTrigger).
//
// Attributs utilisés dans les composants :
//   data-reveal        apparition en fondu + légère montée, en léger décalé par groupe
//   data-reveal-title  grand titre révélé ligne par ligne
//   data-parallax      cadre photo dont l'image se déplace légèrement au défilement
//   data-count         chiffre qui défile jusqu'à sa valeur
//
// Tout est créé à chaque page (astro:page-load) et nettoyé avant de la quitter
// (astro:before-swap). Si l'utilisateur préfère réduire les animations, rien n'est lancé :
// le contenu s'affiche tel quel. Aucun style ne masque le contenu par défaut.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger, SplitText);

const EASE = 'power3.out';
let mm: gsap.MatchMedia | null = null;
let lenis: Lenis | null = null;

function setupLenis() {
  lenis = new Lenis({
    anchors: true,
    // Les zones qui défilent seules (pop-up, menu mobile) gardent le défilement natif.
    prevent: (node) => !!node.closest('dialog, #site-menu, [data-lenis-prevent]'),
  });
  const raf = (time: number) => lenis?.raf(time * 1000);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  // Pop-up déjà ouvert (lien direct) : la page derrière ne défile pas.
  if (document.querySelector('dialog[open]')) lenis.stop();
  return () => {
    gsap.ticker.remove(raf);
    lenis?.destroy();
    lenis = null;
  };
}

function revealTitles() {
  document.querySelectorAll<HTMLElement>('[data-reveal-title]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          y: '0.45em',
          opacity: 0,
          duration: 1.1,
          ease: EASE,
          stagger: 0.12,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        }),
    });
  });
}

function revealBlocks() {
  const items = gsap.utils.toArray<HTMLElement>('[data-reveal]');
  if (!items.length) return;
  gsap.set(items, { opacity: 0, y: 24 });
  ScrollTrigger.batch(items, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: EASE, stagger: 0.1, overwrite: true }),
  });
}

function parallax() {
  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((frame) => {
    const img = frame.querySelector('img');
    if (!img) return;
    gsap.fromTo(
      img,
      { yPercent: -5, scale: 1.12 },
      {
        yPercent: 5,
        scale: 1.12,
        ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });
}

function counters() {
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    const state = { value: 0 };
    el.textContent = '0';
    gsap.to(state, {
      value: end,
      duration: 1.8,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = String(Math.round(state.value));
      },
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
}

function init() {
  mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const stopLenis = setupLenis();
    revealTitles();
    revealBlocks();
    parallax();
    counters();
    return stopLenis;
  });
}

function cleanup() {
  mm?.revert();
  mm = null;
}

// Menu mobile et pop-up : on bloque le défilement de la page derrière.
document.addEventListener('decasti:lock', () => lenis?.stop());
document.addEventListener('decasti:unlock', () => lenis?.start());

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', cleanup);
