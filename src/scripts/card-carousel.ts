// Carrousel des cartes d'expertise ([data-carousel], composant CardCarousel.astro) — Embla Carousel.
//
// - toutes les cartes défilent ensemble, une carte par clic sur les flèches ;
// - glissement à la souris et au doigt, avec l'inertie d'Embla (duration : 32, défaut 25) ;
// - pas de boucle ni de lecture automatique ; flèches estompées au début et à la fin ;
// - flèches gauche / droite du clavier quand le focus est dans le carrousel ; Tab vers une carte
//   hors champ : Embla l'amène dans la vue (option watchFocus, active par défaut) ;
// - la ligne de progression suit la bande en continu ; la position est annoncée aux lecteurs d'écran ;
// - animations réduites : les flèches changent de position instantanément.
// Créé à chaque page (astro:page-load), détruit avant de la quitter (astro:before-swap).
import EmblaCarousel, { type EmblaCarouselType } from 'embla-carousel';

const REDUCED = '(prefers-reduced-motion: reduce)';
const pad = (n: number) => String(n).padStart(2, '0');

let instances: EmblaCarouselType[] = [];
let controller: AbortController | null = null;

function setupCarousel(root: HTMLElement, signal: AbortSignal) {
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const viewport = $<HTMLElement>('[data-carousel-viewport]');
  const controls = $<HTMLElement>('[data-carousel-controls]');
  const prev = $<HTMLButtonElement>('[data-carousel-prev]');
  const next = $<HTMLButtonElement>('[data-carousel-next]');
  const now = $<HTMLElement>('[data-carousel-now]');
  const total = $<HTMLElement>('[data-carousel-total]');
  const bar = $<HTMLElement>('[data-carousel-bar]');
  const status = $<HTMLElement>('[data-carousel-status]');

  const embla = EmblaCarousel(viewport, {
    align: 'start',
    containScroll: 'trimSnaps',
    slidesToScroll: 1,
    loop: false,
    dragFree: false,
    skipSnaps: false,
    duration: 32,
  });

  const reduced = () => window.matchMedia(REDUCED).matches;
  const snapCount = () => embla.scrollSnapList().length;

  function render() {
    const count = snapCount();
    controls.hidden = count < 2;
    now.textContent = pad(embla.selectedScrollSnap() + 1);
    total.textContent = pad(count);
    prev.disabled = !embla.canScrollPrev();
    next.disabled = !embla.canScrollNext();
    progress();
  }

  // Ligne de progression : 1/n au départ, pleine à la fin, en continu pendant le mouvement.
  function progress() {
    const count = Math.max(snapCount(), 1);
    const p = Math.min(1, Math.max(0, embla.scrollProgress()));
    const start = 1 / count;
    bar.style.transform = `scaleX(${count < 2 ? 1 : start + p * (1 - start)})`;
  }

  function announce() {
    const slides = embla.slideNodes();
    const width = slides[0]?.getBoundingClientRect().width || 1;
    const perView = Math.max(1, Math.round(viewport.clientWidth / width));
    const first = embla.selectedScrollSnap() + 1;
    const last = Math.min(slides.length, first + perView - 1);
    const range = first === last ? `Carte ${first}` : `Cartes ${first} ${last === first + 1 ? 'et' : 'à'} ${last}`;
    status.textContent = `${range} sur ${slides.length}`;
  }

  prev.addEventListener('click', () => embla.scrollPrev(reduced()), { signal });
  next.addEventListener('click', () => embla.scrollNext(reduced()), { signal });
  root.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      if (e.key === 'ArrowRight') embla.scrollNext(reduced());
      else embla.scrollPrev(reduced());
    },
    { signal },
  );

  embla
    .on('select', () => {
      render();
      announce();
    })
    .on('scroll', progress)
    .on('reInit', render)
    .on('pointerDown', () => viewport.classList.add('is-dragging'))
    .on('pointerUp', () => viewport.classList.remove('is-dragging'));

  render();
  return embla;
}

function setup() {
  const roots = document.querySelectorAll<HTMLElement>('[data-carousel]');
  if (!roots.length) return;
  controller = new AbortController();
  instances = Array.from(roots, (root) => setupCarousel(root, controller!.signal));
}

document.addEventListener('astro:page-load', setup);
document.addEventListener('astro:before-swap', () => {
  controller?.abort();
  controller = null;
  instances.forEach((embla) => embla.destroy());
  instances = [];
});
