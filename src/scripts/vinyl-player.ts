// Platine interactive de l'accueil (composant Vinyl.astro).
//
// États (attribut data-state sur .vinyl-wrap) :
//   off   → éteinte : disque immobile, bras au repos, lumières éteintes
//   on    → allumée : lumières, PLAY disponible, bras au repos
//   play  → lecture : bras posé sur le disque, disque qui tourne, musique
//   pause → pause : musique arrêtée, disque immobilisé, bras posé
//
// Synchronisation : c'est l'audio qui commande la rotation (le disque accélère quand le son
// démarre réellement et ralentit en pause ou pendant un chargement).
// Volume et sourdine passent par l'API Web Audio (fonctionne aussi sur iPhone, où le volume
// d'un élément <audio> n'est pas réglable) avec des fondus doux à la lecture et à la pause.
// Tant qu'aucun morceau n'est configuré (accueil.json > hero.vinyl.player.audio.src),
// la platine fonctionne sans son et l'annonce.
// Tout est créé à l'arrivée sur la page (astro:page-load) et détruit avant de la quitter
// (astro:before-swap) : la musique s'arrête et aucun écouteur ne subsiste.
import { gsap } from 'gsap';

type State = 'off' | 'on' | 'play' | 'pause';
interface Config {
  src: string;
  title: string;
  loop: boolean;
  volume: number;
  actions: Record<'powerOn' | 'powerOff' | 'play' | 'pause' | 'mute' | 'unmute' | 'volume', string>;
  status: Record<'on' | 'off' | 'playing' | 'paused' | 'muted' | 'unmuted' | 'noAudio', string>;
}

// Angles du bras (en degrés, autour du pivot) et durées.
const ARM = { rest: -9, start: 3, end: 13, pivot: '424 30' };
const SECONDS_PER_TURN = 6;
const ARM_MOVE = 1.6; // pose / retour du bras
const SPIN_UP = 1.2; // démarrage du plateau
const SPIN_DOWN = 1.4; // arrêt du plateau
const FADE_IN = 0.6;
const FADE_OUT = 0.5;
const VISUAL_TRACK = 240; // durée de parcours du bras quand il n'y a pas de son (s)

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function createPlayer(root: HTMLElement) {
  const config = JSON.parse(root.dataset.config ?? '{}') as Config;
  const disc = root.querySelector<HTMLElement>('[data-disc]')!;
  const arm = root.querySelector<SVGGElement>('[data-arm]')!;
  const powerBtn = root.querySelector<HTMLButtonElement>('[data-power]')!;
  const playBtn = root.querySelector<HTMLButtonElement>('[data-play]')!;
  const muteBtn = root.querySelector<HTMLButtonElement>('[data-mute]')!;
  const volumeInput = root.querySelector<HTMLInputElement>('[data-volume]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const listeners = new AbortController();
  const { signal } = listeners;

  let state: State = 'off';
  let muted = false;
  let armOnRecord = false;
  let volume = Number(volumeInput.value) / 100;

  // --- Animations (GSAP) ---
  const gctx = gsap.context(() => {});
  let spin: gsap.core.Tween | null = null;
  let armTween: gsap.core.Tween | gsap.core.Timeline | null = null;
  let visualTrack: gsap.core.Tween | null = null;

  gctx.add(() => {
    // Le bras est piloté par GSAP, qui écrit sa rotation dans l'attribut SVG « transform ».
    gsap.set(arm, { rotation: ARM.rest, svgOrigin: ARM.pivot });
    spin = gsap.to(disc, { rotation: '+=360', duration: SECONDS_PER_TURN, ease: 'none', repeat: -1, paused: true });
  });

  const spinUp = () => {
    if (!spin || reducedMotion()) return;
    gsap.killTweensOf(spin, 'timeScale');
    if (spin.paused()) {
      spin.timeScale(0.001);
      spin.play();
    }
    gsap.to(spin, { timeScale: 1, duration: SPIN_UP, ease: 'power1.in' });
  };
  const spinDown = () => {
    if (!spin || spin.paused()) return;
    gsap.killTweensOf(spin, 'timeScale');
    gsap.to(spin, { timeScale: 0.001, duration: SPIN_DOWN, ease: 'power2.out', onComplete: () => spin?.pause() });
  };
  const moveArm = (angle: number, duration: number, onComplete?: () => void) => {
    armTween?.kill();
    if (reducedMotion()) {
      gsap.set(arm, { rotation: angle, svgOrigin: ARM.pivot });
      onComplete?.();
      return;
    }
    armTween = gsap.to(arm, { rotation: angle, svgOrigin: ARM.pivot, duration, ease: 'power2.inOut', onComplete });
  };
  // Avancée lente du bras vers le centre, au rythme du morceau.
  const trackArm = (progress: number) => {
    if (!armOnRecord || armTween?.isActive()) return;
    const angle = ARM.start + (ARM.end - ARM.start) * Math.min(1, Math.max(0, progress));
    gsap.to(arm, { rotation: angle, svgOrigin: ARM.pivot, duration: 0.6, ease: 'none', overwrite: 'auto' });
  };

  // --- Audio ---
  let audio: HTMLAudioElement | null = null;
  let actx: AudioContext | null = null;
  let fade: GainNode | null = null;
  let master: GainNode | null = null;
  let lastTime = 0;
  const hasAudio = () => !!config.src;

  const masterLevel = () => (muted ? 0 : volume);
  const applyVolume = () => {
    if (master && actx) master.gain.setTargetAtTime(masterLevel(), actx.currentTime, 0.05);
    else if (audio) audio.volume = masterLevel();
  };
  const ramp = (to: number, seconds: number) => {
    if (!fade || !actx) return;
    const now = actx.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(to, now + seconds);
  };

  const ensureAudio = () => {
    if (audio || !hasAudio()) return;
    audio = new Audio();
    audio.preload = 'none';
    audio.loop = config.loop;
    audio.src = config.src;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      try {
        actx = new AC();
        const source = actx.createMediaElementSource(audio);
        fade = actx.createGain();
        master = actx.createGain();
        fade.gain.value = 0;
        master.gain.value = masterLevel();
        source.connect(fade).connect(master).connect(actx.destination);
      } catch {
        actx = null;
        fade = master = null;
      }
    }
    if (!actx) audio.volume = masterLevel();

    // La rotation suit le son réellement joué.
    audio.addEventListener('playing', () => state === 'play' && spinUp(), { signal });
    audio.addEventListener('waiting', spinDown, { signal });
    audio.addEventListener('timeupdate', () => {
      if (!audio) return;
      const t = audio.currentTime;
      // Retour au début (lecture en boucle) : le bras revient doucement au bord du disque.
      if (t + 1 < lastTime) moveArm(ARM.start, 2);
      lastTime = t;
      if (Number.isFinite(audio.duration) && audio.duration > 0) trackArm(t / audio.duration);
    }, { signal });
    audio.addEventListener('ended', () => {
      if (!config.loop) pause();
    }, { signal });
    audio.addEventListener('error', () => {
      // Fichier introuvable ou illisible : on continue sans son.
      if (state === 'play') {
        audio = null;
        startVisualOnly();
      }
    }, { signal });
  };

  const startVisualOnly = () => {
    announce(config.status.noAudio);
    spinUp();
    visualTrack?.kill();
    const from = Number(gsap.getProperty(arm, 'rotation')) || ARM.start;
    const remaining = Math.max(0.05, (ARM.end - from) / (ARM.end - ARM.start));
    if (!reducedMotion()) {
      visualTrack = gsap.to(arm, { rotation: ARM.end, svgOrigin: ARM.pivot, duration: VISUAL_TRACK * remaining, ease: 'none' });
    }
  };

  const startSound = async () => {
    ensureAudio();
    if (!audio) return startVisualOnly();
    try {
      // Pas d'attente ici : sans geste de l'utilisateur, resume() peut ne jamais aboutir ;
      // c'est play() qui dira clairement si le navigateur refuse la lecture.
      if (actx?.state === 'suspended') actx.resume().catch(() => {});
      await audio.play();
      ramp(1, FADE_IN);
      if (!actx) audio.volume = masterLevel();
      announce(config.status.playing.replace('{titre}', config.title));
    } catch (error) {
      // Lecture refusée par le navigateur : on revient en pause proprement.
      if ((error as DOMException)?.name === 'NotAllowedError') {
        pause();
      } else {
        audio = null;
        startVisualOnly();
      }
    }
  };
  const stopSound = (seconds: number) =>
    new Promise<void>((resolve) => {
      visualTrack?.kill();
      if (!audio || audio.paused) return resolve();
      ramp(0, seconds);
      const a = audio;
      window.setTimeout(() => {
        a.pause();
        resolve();
      }, actx ? seconds * 1000 : 0);
    });

  // --- Interface ---
  const announce = (message: string) => {
    status.textContent = '';
    window.setTimeout(() => (status.textContent = message), 30);
  };
  const render = (next: State) => {
    state = next;
    root.dataset.state = next;
    const on = next !== 'off';
    powerBtn.setAttribute('aria-pressed', String(on));
    powerBtn.setAttribute('aria-label', on ? config.actions.powerOff : config.actions.powerOn);
    playBtn.disabled = !on;
    playBtn.setAttribute('aria-pressed', String(next === 'play'));
    playBtn.setAttribute('aria-label', next === 'play' ? config.actions.pause : config.actions.play);
  };

  // --- Actions ---
  let powerSequence = 0;
  let stopping = false;

  function play() {
    if (state === 'off' || state === 'play') return;
    render('play');
    if (armOnRecord) {
      startSound();
      if (!hasAudio()) spinUp();
      return;
    }
    // Le bras se lève, se déplace jusqu'au bord du disque et se pose ; le plateau démarre.
    spinUp();
    moveArm(ARM.start, ARM_MOVE, () => {
      armOnRecord = true;
      if (state === 'play') startSound();
    });
  }

  function pause() {
    if (state !== 'play') return;
    render('pause');
    announce(config.status.paused);
    stopSound(FADE_OUT);
    spinDown();
    // Si le bras était encore en mouvement vers le disque, il termine sa course et reste posé.
  }

  function turnOn() {
    powerSequence++;
    stopping = false;
    render('on');
    announce(config.status.on);
  }

  // Arrêt progressif : la musique baisse, le plateau ralentit, le bras se relève et revient,
  // puis les lumières s'éteignent.
  function turnOff() {
    const sequence = ++powerSequence;
    stopping = true;
    render('on'); // icône lecture, lumières encore allumées pendant l'arrêt
    playBtn.disabled = true;
    stopSound(FADE_OUT * 2);
    spinDown();
    armOnRecord = false;
    moveArm(ARM.rest, ARM_MOVE, () => {
      if (sequence !== powerSequence) return; // rallumée entre-temps
      stopping = false;
      render('off');
      announce(config.status.off);
    });
  }

  // ON/OFF : un appui pendant l'arrêt (bras en train de revenir) rallume la platine.
  powerBtn.addEventListener('click', () => (state === 'off' || stopping ? turnOn() : turnOff()), { signal });
  playBtn.addEventListener('click', () => (state === 'play' ? pause() : play()), { signal });
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    root.classList.toggle('is-muted', muted);
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? config.actions.unmute : config.actions.mute);
    applyVolume();
    announce(muted ? config.status.muted : config.status.unmuted);
  }, { signal });
  volumeInput.addEventListener('input', () => {
    volume = Number(volumeInput.value) / 100;
    volumeInput.style.setProperty('--v', `${volumeInput.value}%`);
    volumeInput.setAttribute('aria-valuetext', `${volumeInput.value} %`);
    // Monter le volume rétablit le son s'il était coupé.
    if (muted && volume > 0) muteBtn.click();
    else applyVolume();
  }, { signal });

  return {
    destroy() {
      listeners.abort();
      visualTrack?.kill();
      armTween?.kill();
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      actx?.close().catch(() => {});
      gctx.revert();
    },
  };
}

let player: ReturnType<typeof createPlayer> | null = null;

document.addEventListener('astro:page-load', () => {
  const root = document.querySelector<HTMLElement>('[data-vinyl-player]');
  if (root) player = createPlayer(root);
});
document.addEventListener('astro:before-swap', () => {
  player?.destroy();
  player = null;
});
