// Données structurées Schema.org (JSON-LD), assemblées en un seul graphe par page.
//
// Règle : seules les valeurs connues sont publiées. Toute valeur encore « [à confirmer] »
// (entre crochets dans les fichiers JSON) est ignorée, de même que les liens « # ».
// Aucune note ni avis agrégé n'est déclaré.
import { site, popups } from '../data';

type Node = Record<string, unknown>;

/** Valeur publiable : non vide et différente d'un texte provisoire « [...] ». */
export const known = (s: string | undefined) => (s && !s.trim().startsWith('[') ? s : undefined);

/** Retire la mise en forme *italique* des titres. */
export const plain = (s: string) => s.replace(/\*/g, '').replace(/\s+/g, ' ').trim();

/** « 1 500 € » → 1500 ; « Sur devis » ou « [Tarif] » → undefined. */
export function parsePrice(price: string): number | undefined {
  if (!/^\d[\d\s  ]*(,\d+)?\s*€$/.test(price.trim())) return undefined;
  return Number(price.replace(/[^\d,]/g, '').replace(',', '.'));
}

/** Plus petit tarif chiffré des formules d'une page (ex. « 650 € »), pour les textes SEO. */
export function minPriceLabel(page: 'agence' | 'dj'): string | undefined {
  const prices = popups.popups
    .filter((p) => p.page === page && p.variant === 'formules')
    .flatMap((p) => (p.variant === 'formules' ? p.plans.map((plan) => parsePrice(plan.price)) : []))
    .filter((n): n is number => n !== undefined);
  if (!prices.length) return undefined;
  return `${Math.min(...prices).toLocaleString('fr-FR').replace(/ /g, ' ')} €`;
}

const base = site.url.replace(/\/$/, '');
export const ids = {
  organisation: `${base}/#organisation`,
  person: `${base}/#eva-de-casti`,
  website: `${base}/#site`,
};

/** Entités communes à toutes les pages : l'entreprise, Eva de Casti, le site. */
export function siteNodes(images: { organisation: string; person: string }): Node[] {
  const c = site.contact;
  const city = known(c.city);
  const sameAs = Object.values(site.social)
    .map((s) => s.href)
    .filter((h) => h.startsWith('http'));

  const organisation: Node = {
    // Sans ville connue, l'entreprise est décrite comme Organization : LocalBusiness
    // suppose une adresse, qui sera ajoutée dès que la ville sera confirmée.
    '@type': city ? 'LocalBusiness' : 'Organization',
    '@id': ids.organisation,
    name: site.name,
    description: site.description,
    url: `${base}/`,
    image: images.organisation,
    email: known(c.email),
    telephone: known(c.phone),
    address: {
      '@type': 'PostalAddress',
      addressLocality: city,
      addressCountry: 'FR',
    },
    founder: { '@id': ids.person },
    sameAs: sameAs.length ? sameAs : undefined,
  };

  const person: Node = {
    '@type': 'Person',
    '@id': ids.person,
    name: site.person.name,
    jobTitle: site.person.jobTitle,
    image: images.person,
    worksFor: { '@id': ids.organisation },
    url: `${base}/dj`,
  };

  const website: Node = {
    '@type': 'WebSite',
    '@id': ids.website,
    name: site.name,
    url: `${base}/`,
    inLanguage: 'fr-FR',
    publisher: { '@id': ids.organisation },
  };

  return [organisation, person, website];
}

/** Page courante, avec son fil d'Ariane (sauf l'accueil). */
export function pageNodes(opts: { url: string; title: string; description: string; breadcrumb?: string }): Node[] {
  const webpage: Node = {
    '@type': 'WebPage',
    '@id': `${opts.url}#page`,
    url: opts.url,
    name: opts.title,
    description: opts.description,
    inLanguage: 'fr-FR',
    isPartOf: { '@id': ids.website },
    about: { '@id': ids.organisation },
  };
  if (!opts.breadcrumb) return [webpage];

  const breadcrumb: Node = {
    '@type': 'BreadcrumbList',
    '@id': `${opts.url}#fil-ariane`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${base}/` },
      { '@type': 'ListItem', position: 2, name: opts.breadcrumb, item: opts.url },
    ],
  };
  webpage.breadcrumb = { '@id': breadcrumb['@id'] };
  return [webpage, breadcrumb];
}

/**
 * Prestations d'une page (Service), d'après les pop-up de popups.json.
 * Les formules DJ chiffrées deviennent des offres (Offer) ; « Sur devis » et les formules
 * encore à compléter ne sont pas déclarées.
 */
export function serviceNodes(page: 'agence' | 'dj', pageUrl: string): Node[] {
  return popups.popups
    .filter((p) => p.page === page)
    .map((p) => {
      const name = plain(p.title);
      const offers =
        p.variant === 'formules'
          ? p.plans
              .map((plan) => {
                const price = parsePrice(plan.price);
                if (price === undefined || !known(plan.name)) return undefined;
                return {
                  '@type': 'Offer',
                  name: [plan.name, plan.label].filter(Boolean).join(' — '),
                  description: plan.subtitle,
                  price,
                  priceCurrency: 'EUR',
                  priceSpecification: {
                    '@type': 'PriceSpecification',
                    price,
                    priceCurrency: 'EUR',
                    valueAddedTaxIncluded: plan.priceUnit === 'TTC' ? true : undefined,
                  },
                  url: `${pageUrl}#${p.id}`,
                };
              })
              .filter(Boolean)
          : [];
      return {
        '@type': 'Service',
        '@id': `${pageUrl}#${p.id}`,
        name: page === 'dj' ? `DJ — ${name}` : name,
        serviceType: page === 'dj' ? 'Prestation DJ' : 'Organisation d’événements',
        description: p.text,
        provider: { '@id': page === 'dj' ? ids.person : ids.organisation },
        brand: page === 'dj' ? { '@id': ids.organisation } : undefined,
        url: `${pageUrl}#${p.id}`,
        offers: offers.length ? offers : undefined,
      };
    });
}

/** Questions fréquentes : seules les réponses rédigées sont publiées (aucune pour l'instant). */
export function faqNode(pageUrl: string, items: { question: string; answer: string }[]): Node[] {
  const answered = items.filter((i) => known(i.answer));
  if (!answered.length) return [];
  return [
    {
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: answered.map((i) => ({
        '@type': 'Question',
        name: i.question,
        acceptedAnswer: { '@type': 'Answer', text: i.answer },
      })),
    },
  ];
}

/** Supprime les propriétés vides (undefined, objets vides) pour un JSON-LD propre. */
export function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean).filter((v) => v !== undefined) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const c = clean(v);
      if (c === undefined) continue;
      if (c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).filter((x) => x !== '@type').length === 0) continue;
      out[k] = c;
    }
    return out as T;
  }
  return value;
}
