// Liens encore provisoires : un lien « # » (destination pas encore fournie) n'est pas affiché.
// Il réapparaît automatiquement dès qu'une vraie adresse est renseignée dans src/data/*.json.
export const hasHref = (href?: string): href is string => !!href && href.trim() !== '#';
