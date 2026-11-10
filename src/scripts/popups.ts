// Ouverture et fermeture des pop-up (<dialog data-popup>).
// - un lien [data-popup-open="id"] ouvre le pop-up correspondant ;
// - fermeture : croix, touche Échap, clic sur le fond ;
// - le focus revient sur le bouton qui a ouvert le pop-up ;
// - l'adresse prend l'ancre du pop-up (#formules-mariages) pour pouvoir partager le lien,
//   et une adresse avec cette ancre ouvre le pop-up (au chargement ou quand l'ancre change).

let popupOpener: HTMLElement | null = null;
let leaving = false;

function urlWithHash(hash: string) {
  return location.pathname + location.search + hash;
}

function open(dialog: HTMLDialogElement, from: HTMLElement | null) {
  if (dialog.open) return;
  popupOpener = from;
  dialog.showModal();
  dialog.scrollTop = 0;
  history.replaceState(history.state, '', urlWithHash(`#${dialog.id}`));
  document.dispatchEvent(new CustomEvent('decasti:lock'));
}

function setup() {
  leaving = false;
  const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[data-popup]');
  if (!dialogs.length) return;

  dialogs.forEach((dialog) => {
    dialog.addEventListener('close', () => {
      // Fermeture due à un changement de page : on ne touche ni à l'adresse ni au focus.
      if (leaving || !dialog.isConnected) return;
      // Un autre pop-up vient de prendre le relais (changement d'ancre) : rien à restaurer.
      if (document.querySelector('dialog[data-popup][open]')) return;
      history.replaceState(history.state, '', urlWithHash(''));
      document.dispatchEvent(new CustomEvent('decasti:unlock'));
      popupOpener?.focus();
      popupOpener = null;
    });
    // Clic sur le fond assombri (en dehors du contenu).
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.querySelectorAll('[data-popup-close]').forEach((btn) => btn.addEventListener('click', () => dialog.close()));
  });

  document.querySelectorAll<HTMLElement>('[data-popup-open]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const dialog = document.getElementById(link.dataset.popupOpen!) as HTMLDialogElement | null;
      if (!dialog) return;
      e.preventDefault();
      e.stopPropagation();
      open(dialog, link);
    });
  });

  // Lien direct vers un pop-up (ex. /dj#formules-mariages), au chargement
  // puis à chaque changement d'ancre sans rechargement (barre d'adresse, lien de la page).
  openFromHash();
  hashListener = new AbortController();
  window.addEventListener('hashchange', openFromHash, { signal: hashListener.signal });
}

let hashListener: AbortController | null = null;

function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (!(target instanceof HTMLDialogElement) || !target.hasAttribute('data-popup') || target.open) return;
  const current = document.querySelector<HTMLDialogElement>('dialog[data-popup][open]');
  current?.close();
  open(target, document.querySelector<HTMLElement>(`[data-popup-open="${target.id}"]`));
}

document.addEventListener('astro:page-load', setup);
document.addEventListener('astro:before-swap', () => {
  hashListener?.abort();
  hashListener = null;
  leaving = true;
  document.dispatchEvent(new CustomEvent('decasti:unlock'));
  document.querySelectorAll<HTMLDialogElement>('dialog[data-popup][open]').forEach((d) => {
    d.close();
  });
  popupOpener = null;
});
