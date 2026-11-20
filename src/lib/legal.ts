// Pages légales : affichage des informations encore manquantes.
//
// Convention dans src/data/pages.json :
//   « [À COMPLÉTER : …] »  information juridique non encore fournie ;
//   « [À CONFIRMER : …] »  point à faire valider (base légale, garantie de transfert…).
// La détection (variantes de casse, d'accents et d'espaces comprises) est dans legal-marqueurs.ts.
// Une page qui contient encore un marqueur n'est pas indexée (noindex) ni listée dans le sitemap,
// et chaque marqueur est affiché comme tel : aucune information fictive n'est présentée.
import { rich } from './rich';
import { estProvisoire, marqueurs, typeMarqueur } from './legal-marqueurs';

export { estProvisoire };

/**
 * Texte d'une page légale → HTML : mise en forme habituelle (*italique*, [lien](/chemin)),
 * et chaque marqueur devient une étiquette visible « À compléter » / « À confirmer ».
 */
export function texteLegal(text: string): string {
  return rich(text.normalize('NFC')).replace(marqueurs(), (_, mot: string, detail: string) => {
    const etiquette = typeMarqueur(mot) === 'completer' ? 'À compléter' : 'À confirmer';
    return `<span class="todo"><span class="todo-tag">${etiquette}</span>${detail ? `<span class="todo-detail">${detail}</span>` : ''}</span>`;
  });
}
