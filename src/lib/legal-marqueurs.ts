// Marqueurs d'informations juridiques manquantes dans src/data/pages.json.
//
// Écriture recommandée : « [À COMPLÉTER : précision] » et « [À CONFIRMER : précision] ».
// La détection tolère aussi les variantes de saisie : casse (« [à compléter] »), accents absents
// (« [A COMPLETER] », « [À COMPLETER] »), espaces superflus (« [ À COMPLÉTER ] »).
//
// Une page légale qui contient encore un marqueur n'est pas indexée (noindex) et n'est pas
// listée dans le sitemap ; elle le redevient dès qu'il n'en reste plus aucun.
// Module sans dépendance : il est utilisé par astro.config.mjs, src/lib/legal.ts et les tests.

/** Début d'un marqueur, quelle que soit la casse, la présence des accents ou les espaces. */
const DEBUT = String.raw`\[\s*[aà]\s*(compl[eé]ter|confirmer)\b`;

/** Repère la présence d'au moins un marqueur. */
export const MARQUEUR = new RegExp(DEBUT, 'i');

/** Marqueur complet (pour l'affichage) : type, puis précision facultative après « : ». */
export const marqueurs = () => new RegExp(String.raw`${DEBUT}\s*:?\s*([^\]]*?)\s*\]`, 'gi');

/** Texte normalisé (accents composés ou décomposés traités de la même façon). */
const texte = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value) ?? '').normalize('NFC');

/** Vrai si la valeur (texte ou objet de données) contient encore au moins un marqueur. */
export const estProvisoire = (value: unknown) => MARQUEUR.test(texte(value));

/** « compléter » ou « confirmer », quelle que soit l'écriture du marqueur. */
export const typeMarqueur = (mot: string): 'completer' | 'confirmer' =>
  mot.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() === 'completer' ? 'completer' : 'confirmer';

/** Pages jamais listées dans le sitemap (non indexées en permanence). */
export const TOUJOURS_HORS_SITEMAP = ['merci', '404'] as const;

/**
 * Pages à exclure du sitemap : merci et 404 en permanence, plus chaque page légale qui
 * contient encore un marqueur. `legales` associe l'adresse de la page (sans « / ») à ses données.
 */
export function pagesHorsSitemap(legales: Record<string, unknown>): string[] {
  return [...TOUJOURS_HORS_SITEMAP, ...Object.entries(legales).filter(([, donnees]) => estProvisoire(donnees)).map(([adresse]) => adresse)];
}

/** Filtre du sitemap : vrai si l'URL doit figurer dans le sitemap. */
export function filtreSitemap(horsSitemap: string[]) {
  const exclue = new RegExp(`/(${horsSitemap.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(\\.html)?/?$`);
  return (url: string) => !exclue.test(url);
}
