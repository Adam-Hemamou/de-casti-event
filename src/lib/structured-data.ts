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

/** 1500 → « 1 500 € », avec espaces insécables (le montant ne se coupe pas en fin de ligne). */
const euros = (n: number) => `${n.toLocaleString('fr-FR').replace(/\s/g, ' ')} €`;

/**
 * Fourchette des tarifs chiffrés d'un pop-up de formules (popups.json), seule source des prix.
 * Les formules « Sur devis » sont signalées (onQuote) ; les formules encore à compléter sont ignorées.
 * Aucun tarif chiffré : undefined.
 */
function priceRange(popupId: string) {
  const p = popups.popups.find((x) => x.id === popupId);
  if (!p || p.variant !== 'formules') return undefined;
  const priced = p.plans.filter((plan) => known(plan.name) && parsePrice(plan.price) !== undefined);
  if (!priced.length) return undefined;
  const values = priced.map((plan) => parsePrice(plan.price) as number);
  const units = [...new Set(priced.map((plan) => plan.priceUnit ?? ''))];
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    unit: units.length === 1 && units[0] ? `\u00a0${units[0]}` : '',
    onQuote: p.plans.some((plan) => known(plan.name) && /^sur devis$/i.test(plan.price.trim())),
  };
}

/** « de 650 € à 1 090 € TTC » (ou « 650 € TTC » pour un tarif unique). */
function rangeText(r: NonNullable<ReturnType<typeof priceRange>>) {
  return r.min === r.max ? `${euros(r.min)}${r.unit}` : `de ${euros(r.min)} à ${euros(r.max)}${r.unit}`;
}

/**
 * Texte visible des cartes de la page DJ
 * (ex. « Formules de 650 € à 1 090 € TTC, ou sur devis pour une prestation sur mesure. »).
 */
export function priceRangeLabel(popupId: string): string | undefined {
  const r = priceRange(popupId);
  if (!r) return undefined;
  const range = r.min === r.max ? `Formule à ${rangeText(r)}` : `Formules ${rangeText(r)}`;
  return `${range}${r.onQuote ? ', ou sur devis pour une prestation sur mesure' : ''}.`;
}

/**
 * Remplace les jetons {tarifs:identifiant-du-pop-up} d'un texte (ex. réponses de FAQ) par la
 * fourchette des tarifs de ce pop-up, calculée depuis popups.json (« de 1 500 € à 1 900 € TTC »).
 * Un jeton vers un pop-up inconnu ou sans tarif chiffré arrête le build.
 */
export function fillTarifs(text: string, where: string): string {
  return text.replace(/\{tarifs:([a-z0-9-]+)\}/g, (_, id: string) => {
    const r = priceRange(id);
    if (!r) throw new Error(`${where} : le jeton {tarifs:${id}} ne correspond à aucun pop-up de formules chiffrées dans popups.json.`);
    return rangeText(r);
  });
}

/** Type de prestation précis (Service.serviceType), selon la page et le type d'événement du pop-up. */
const serviceTypes: Record<'agence' | 'dj', Partial<Record<string, string>>> = {
  dj: {
    mariage: 'DJ mariage',
    entreprise: "DJ pour événements d'entreprise",
    'soiree-privee': 'DJ soirée privée et anniversaire',
    festival: 'DJ festival et événement public',
    sport: 'DJ événement sportif et événement de marque',
  },
  agence: {
    mariage: 'Organisation de mariage',
    entreprise: "Organisation d'événements d'entreprise",
    'soiree-privee': "Organisation d'événements privés",
    autre: "Organisation d'événements sur mesure",
  },
};

const base = site.url.replace(/\/$/, '');
export const ids = {
  organisation: `${base}/#organisation`,
  person: `${base}/#eva-de-casti`,
  website: `${base}/#site`,
};

/** Zone d'intervention (« Partout en France ») : le pays, tant qu'elle est renseignée. */
const areaServed = () => (known(site.contact.zone) ? { '@type': 'Country', name: site.contact.country } : undefined);

/** Entités communes à toutes les pages : l'entreprise, Eva de Casti, le site. */
export function siteNodes(images: { organisation: string; person: string }): Node[] {
  const c = site.contact;
  const city = known(c.city);
  const sameAs = Object.values(site.social)
    .map((s) => s.href)
    .filter((h) => h.startsWith('http'));

  const organisation: Node = {
    // Toujours Organization (et non LocalBusiness) : De Casti Event n'a pas d'établissement
    // recevant du public. Seules la ville et la région de rattachement sont publiées,
    // jamais d'adresse physique ; la zone d'intervention est décrite par areaServed.
    '@type': 'Organization',
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
      addressRegion: city ? known(c.region) : undefined,
      addressCountry: 'FR',
    },
    areaServed: areaServed(),
    founder: { '@id': ids.person },
    knowsAbout: site.knowsAbout,
    sameAs: sameAs.length ? sameAs : undefined,
  };

  const person: Node = {
    '@type': 'Person',
    '@id': ids.person,
    name: site.person.name,
    jobTitle: site.person.jobTitle,
    description: site.person.description,
    image: images.person,
    worksFor: { '@id': ids.organisation },
    knowsAbout: site.person.knowsAbout,
    url: `${base}/dj`,
    sameAs: sameAs.length ? sameAs : undefined,
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

/**
 * Page courante, avec son fil d'Ariane (sauf l'accueil).
 * type : 'ContactPage' pour la page contact ; about : sujet principal de la page
 * (Eva de Casti pour la page DJ, l'entreprise ailleurs) ; image : photo de partage de la page.
 */
export function pageNodes(opts: {
  url: string;
  title: string;
  description: string;
  breadcrumb?: string;
  type?: 'WebPage' | 'ContactPage';
  about?: 'organisation' | 'person';
  image?: string;
}): Node[] {
  const webpage: Node = {
    '@type': opts.type ?? 'WebPage',
    '@id': `${opts.url}#page`,
    url: opts.url,
    name: opts.title,
    description: opts.description,
    inLanguage: 'fr-FR',
    isPartOf: { '@id': ids.website },
    about: { '@id': ids[opts.about ?? 'organisation'] },
    primaryImageOfPage: opts.image ? { '@type': 'ImageObject', url: opts.image } : undefined,
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
        serviceType: (p.eventType && serviceTypes[page][p.eventType]) ?? (page === 'dj' ? 'Prestation DJ' : 'Organisation d’événements'),
        description: p.text,
        provider: { '@id': page === 'dj' ? ids.person : ids.organisation },
        brand: page === 'dj' ? { '@id': ids.organisation } : undefined,
        areaServed: areaServed(),
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
