// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import site from './src/data/site.json' with { type: 'json' };

// https://astro.build/config
export default defineConfig({
  // Domaine défini dans src/data/site.json (valeur temporaire, à confirmer).
  site: site.url,
  // Pages générées en /dj.html, servies par Netlify à l'adresse /dj (sans barre finale).
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    sitemap({
      filter: (page) => !/\/(merci|404)(\.html)?$/.test(page),
    }),
  ],
});
