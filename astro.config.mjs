// @ts-check
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import vercelConfig from './integrations/vercel-config.mjs';
import site from './src/data/site.json' with { type: 'json' };
import pages from './src/data/pages.json' with { type: 'json' };
import { filtreSitemap, pagesHorsSitemap } from './src/lib/legal-marqueurs.ts';

// Pages absentes du sitemap : merci et 404 (non indexées), ainsi que les pages légales tant
// qu'elles contiennent une information « [À COMPLÉTER] » / « [À CONFIRMER] » (elles sont
// alors en noindex, voir src/layouts/LegalLayout.astro et src/lib/legal-marqueurs.ts).
const dansSitemap = filtreSitemap(
  pagesHorsSitemap({ 'mentions-legales': pages.mentions, 'politique-de-confidentialite': pages.confidentialite }),
);

// https://astro.build/config
export default defineConfig({
  // Domaine défini dans src/data/site.json (valeur temporaire, à confirmer).
  site: site.url,
  // Adresses sans barre finale (/dj). Avec l'adaptateur Vercel, les pages sont écrites en
  // dj/index.html et servies à /dj ; /dj/, /dj.html et /dj/index.html redirigent (308) vers /dj.
  trailingSlash: 'never',
  build: { format: 'file' },
  // Sortie statique : toutes les pages sont générées au build. Seule la route
  // /api/contact (prerender = false) est exécutée à la demande, par une fonction Vercel.
  output: 'static',
  adapter: vercel(),
  // Variables du formulaire de contact (route /api/contact). Secrets serveur, lus à l'exécution
  // (jamais intégrés au build ni exposés au navigateur). Absentes : l'envoi est refusé
  // proprement (réponse 503), sans aucun envoi d'e-mail. Valeurs à définir dans Vercel.
  env: {
    schema: {
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      CONTACT_TO: envField.string({ context: 'server', access: 'secret', optional: true }),
      CONTACT_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  integrations: [
    sitemap({
      filter: dansSitemap,
    }),
    // Recopie les en-têtes et cleanUrls de vercel.json dans la sortie de l'adaptateur (voir le fichier).
    vercelConfig(),
  ],
});
