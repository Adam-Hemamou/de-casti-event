// Chargement et validation des fichiers de contenu (src/data/*.json).
// Une faute de saisie (champ manquant, mauvais type, photo inexistante, clé inconnue)
// arrête le build avec un message indiquant le fichier et le champ concernés.
import { z } from 'astro/zod';
import { photos } from '../lib/photos';

import siteJson from './site.json';
import accueilJson from './accueil.json';
import avisJson from './avis.json';
import agenceJson from './agence.json';
import popupsJson from './popups.json';
import djJson from './dj.json';
import contactJson from './contact.json';
import pagesJson from './pages.json';

const S = z.strictObject;
const text = z.string().min(1);

export const Link = S({ label: text, href: text });
export const Photo = S({
  src: text.refine((name) => name in photos, { message: 'photo absente de src/assets/photos/' }),
  alt: z.string(),
  position: z.string().optional(),
});
export const Seo = S({ title: text, description: text });

const SocialKey = z.enum(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin']);
const FooterVariant = S({
  third: z.enum(['social', 'contact']),
  social: z.array(SocialKey).optional(),
  end: z.enum(['cta', 'tagline']),
});

const Site = S({
  name: text,
  url: z.url(),
  urlNote: z.string().optional(),
  description: text,
  defaultOgImage: Photo.shape.src,
  logo: S({ main: text, sub: text, label: text }),
  contact: S({ email: text, phone: text, city: text, country: text, hours: text }),
  social: z.record(SocialKey, Link),
  nav: z.array(Link),
  skipLink: text,
  navLabel: text,
  menuLabel: text,
  menuCloseLabel: text,
  headerCta: Link,
  footer: S({
    navLabel: text,
    navTitle: text,
    infoTitle: text,
    infoLinks: z.array(Link),
    socialTitle: text,
    contactTitle: text,
    cta: S({ text: text, label: text, href: text }),
    tagline: text,
    wordmark: text,
    copyright: text,
    legal: z.array(Link),
    variants: S({ accueil: FooterVariant, agence: FooterVariant, dj: FooterVariant, contact: FooterVariant }),
  }),
});

const Review = S({ text: text, author: text, stars: z.number().int().min(1).max(5) });
const Avis = S({
  starsLabel: text,
  accueil: z.array(Review),
  agence: z.array(Review),
  dj: z.array(Review),
});

const TitledText = S({ title: text, text: text });
const GalleryPhoto = Photo.extend({
  cols: z.number().int().min(1).max(4).optional(),
  rows: z.number().int().min(1).max(3).optional(),
});
export const Gallery = S({
  kicker: text,
  title: text,
  text: z.string().optional(),
  link: Link,
  rowHeight: z.number().positive(),
  photos: z.array(GalleryPhoto),
});
const SectionIntro = S({ kicker: text, title: text, link: Link.optional() });

const Accueil = S({
  seo: Seo,
  hero: S({
    kicker: text,
    titleTop: text,
    title: text,
    text: text,
    cta: Link,
    vinyl: S({ photo: Photo, caption: text }),
  }),
  valeurs: S({ kicker: text, title: text, text: text, items: z.array(TitledText) }),
  activites: S({
    separator: text,
    cards: z.array(
      S({
        icon: z.enum(['sparkle', 'headphones']),
        title: text,
        text: text,
        listColumns: z.union([z.literal(1), z.literal(2)]),
        items: z.array(text),
        cta: Link,
        photo: Photo,
      }),
    ),
  }),
  chiffres: z.array(S({ value: z.number().int().min(0), suffix: z.string(), label: text })),
  apropos: S({
    kicker: text,
    title: text,
    lead: text,
    paragraphs: z.array(text),
    emphasis: text,
    link: Link,
    photo: Photo,
  }),
  realisations: Gallery,
  avis: SectionIntro,
});

// Types d'événement du formulaire de contact (valeurs utilisées dans l'URL : /contact?type=mariage).
export const EventType = z.enum(['mariage', 'entreprise', 'soiree-privee', 'festival', 'sport']);

const PopupBase = {
  id: z.string().regex(/^[a-z0-9-]+$/, 'identifiant en minuscules et tirets'),
  page: z.enum(['agence', 'dj']),
  eventType: EventType.optional(),
  photo: Photo,
  quote: text,
  title: text,
  text: text,
  cta: text,
  layout: S({
    titleSize: z.number().optional(),
    quoteSize: z.number().optional(),
    veilStart: z.number().optional(),
    textWidth: z.number().optional(),
  }).optional(),
};
const PrestationsPopup = S({
  ...PopupBase,
  variant: z.literal('prestations'),
  services: z.array(text),
  stepsTitle: text,
  steps: z.array(S({ text: text, note: z.string().optional() })),
  closing: text,
});
// Formule tarifaire : soit subtitle + items (formule rédigée), soit description (formule à compléter).
const Plan = S({
  name: text,
  label: text.optional(),
  subtitle: text.optional(),
  items: z.array(text).optional(),
  description: text.optional(),
  price: text,
  priceUnit: text.optional(),
  featured: z.boolean().optional(),
});
const FormulesPopup = S({
  ...PopupBase,
  variant: z.literal('formules'),
  featuredLabel: text,
  plans: z.array(Plan).min(1),
  optionsTitle: text.optional(),
  optionGroups: z.array(S({ title: text, items: z.array(text) })).optional(),
  optionList: z.array(text).optional(),
  optionText: text.optional(),
  notes: z.array(S({ title: text, text: text })).optional(),
  ctaNote: text.optional(),
});
const Popups = S({
  prestationsKicker: text,
  formulesKicker: text,
  closeLabel: text,
  popups: z.array(z.discriminatedUnion('variant', [PrestationsPopup, FormulesPopup])),
});

const Agence = S({
  seo: Seo,
  hero: S({ kicker: text, title: text, text: text, cta: Link, photo: Photo }),
  approche: S({ kicker: text, title: text, steps: z.array(TitledText) }),
  expertises: S({
    kicker: text,
    title: text,
    cards: z.array(S({ title: text, text: text, note: text, photo: Photo, link: text, popup: text })),
  }),
  realisations: Gallery,
  avis: SectionIntro,
});

const Dj = S({
  seo: Seo,
  hero: S({ kicker: text, title: text, text: text, cta: Link, photo: Photo }),
  approche: S({ kicker: text, title: text, text: text, photo: Photo, items: z.array(TitledText) }),
  expertises: S({
    kicker: text,
    title: text,
    cards: z.array(S({ title: text, text: text, photo: Photo, link: text, popup: text })),
  }),
  galerie: Gallery,
  avis: SectionIntro,
  univers: S({ kicker: text, title: text, text: text, emphasis: text, genres: z.array(text), closing: text }),
  sono: S({
    kicker: text,
    title: text,
    text: text,
    items: z.array(text),
    closing: text,
    note: text,
    cta: Link,
    photo: Photo,
  }),
  avisBis: S({ note: z.string().optional(), afficher: z.boolean(), kicker: text, title: text }),
});

const Field = S({ label: text, error: text.optional(), errorFormat: text.optional() });
const Contact = S({
  seo: Seo,
  headerCta: Link,
  hero: S({
    kicker: text,
    title: text,
    text: text,
    labels: S({ email: text, phone: text, address: text, hours: text }),
  }),
  form: S({
    name: z.string().regex(/^[a-z0-9-]+$/),
    title: text,
    fields: S({
      nom: Field,
      prenom: Field,
      email: Field,
      telephone: Field,
      type: Field,
      date: Field,
      message: Field,
    }),
    typePlaceholder: text,
    types: z.array(S({ value: EventType, label: text })),
    honeypotLabel: text,
    submit: text,
    privacy: text,
    errorSummary: text,
  }),
  social: S({ title: text, networks: z.array(SocialKey) }),
  video: S({ title: text, text: text, link: Link, photo: Photo }),
  faq: S({
    kicker: text,
    title: text,
    textBefore: text,
    link: Link,
    textAfter: text,
    items: z.array(S({ question: text, answer: text })),
  }),
});

const SimplePage = S({ seo: Seo, kicker: text, title: text, text: text, cta: Link });
const LegalPage = S({ seo: Seo, kicker: text, title: text, sections: z.array(S({ title: text, text: text })) });
const Pages = S({ merci: SimplePage, erreur404: SimplePage, mentions: LegalPage, confidentialite: LegalPage });

function load<T extends z.ZodType>(file: string, schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  • ${i.path.join('.') || '(racine)'} : ${i.message}`)
      .join('\n');
    throw new Error(`Contenu invalide dans src/data/${file} :\n${details}`);
  }
  return result.data;
}

export const site = load('site.json', Site, siteJson);
export const avis = load('avis.json', Avis, avisJson);
export const accueil = load('accueil.json', Accueil, accueilJson);
export const popups = load('popups.json', Popups, popupsJson);
export const agence = load('agence.json', Agence, agenceJson);
export const dj = load('dj.json', Dj, djJson);
export const contact = load('contact.json', Contact, contactJson);
export const pages = load('pages.json', Pages, pagesJson);

// Vérifie que chaque bouton pointe vers un pop-up existant de la même page.
const ids = popups.popups.map((p) => p.id);
const dup = ids.find((id, i) => ids.indexOf(id) !== i);
if (dup) throw new Error(`Contenu invalide dans src/data/popups.json : identifiant « ${dup} » en double.`);

function checkPopupLinks(file: string, page: 'agence' | 'dj', cards: { popup: string }[]) {
  for (const card of cards) {
    if (!popups.popups.some((p) => p.id === card.popup && p.page === page)) {
      throw new Error(
        `Contenu invalide dans src/data/${file} : le pop-up « ${card.popup} » n'existe pas dans popups.json pour la page ${page}.`,
      );
    }
  }
}
checkPopupLinks('agence.json', 'agence', agence.expertises.cards);
checkPopupLinks('dj.json', 'dj', dj.expertises.cards);

export type LinkT = z.infer<typeof Link>;
export type PhotoT = z.infer<typeof Photo>;
export type GalleryT = z.infer<typeof Gallery>;
export type ReviewT = z.infer<typeof Review>;
export type PopupT = z.infer<typeof Popups>['popups'][number];
export type PageKey = keyof typeof site.footer.variants;
