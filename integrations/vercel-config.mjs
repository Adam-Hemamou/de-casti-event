// Intégration locale : applique les règles de vercel.json à la sortie de l'adaptateur Vercel.
//
// Pourquoi : avec @astrojs/vercel, le build produit .vercel/output/config.json (Build Output API).
// L'adaptateur y écrit ses propres routes (barre finale, cache de /_astro/, 404, fonction
// /api/contact) mais ni les en-têtes de sécurité ni la règle cleanUrls de vercel.json, et la
// documentation Vercel ne garantit pas que vercel.json soit fusionné dans ce mode.
// Cette intégration les recopie donc dans config.json, à partir de vercel.json (seule source) :
// - en-têtes (headers) : ajoutés en tête des routes, appliqués à toutes les réponses ;
// - cleanUrls : redirections 308 de /page.html et /page/index.html vers /page, avec les
//   mêmes motifs que l'outil officiel de Vercel (@vercel/routing-utils, getTransformedRoutes).
// - routes /_image et /_server-islands/ retirées : seule /api/contact reste dynamique.
// Si vercel.json est aussi appliqué par Vercel, les règles sont identiques : aucun conflit.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Motif vercel.json (« /(.*) », « /_astro/(.*) », chemin exact) → expression de routes Vercel. */
function versRegex(source) {
  if (source === '/(.*)') return '^(?:/(.*))$';
  const m = /^(\/[\w\-./]*?)\/\(\.\*\)$/.exec(source);
  if (m) return `^${escape(m[1])}(?:/(.*))$`;
  if (/^\/[\w\-./]*$/.test(source)) return `^${escape(source)}$`;
  throw new Error(`vercel.json : motif « ${source} » non pris en charge par integrations/vercel-config.mjs.`);
}

export default function vercelConfig() {
  let root;
  return {
    name: 'de-casti:vercel-config',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = config.root;
      },
      'astro:build:done': ({ logger }) => {
        const outputPath = new URL('./.vercel/output/config.json', root);
        if (!existsSync(outputPath)) {
          throw new Error('.vercel/output/config.json introuvable : cette intégration doit s’exécuter après l’adaptateur Vercel.');
        }
        const vercelJson = JSON.parse(readFileSync(new URL('./vercel.json', root), 'utf8'));
        const output = JSON.parse(readFileSync(outputPath, 'utf8'));

        const headerRoutes = (vercelJson.headers ?? []).map((rule) => ({
          src: versRegex(rule.source),
          headers: Object.fromEntries(rule.headers.map((h) => [h.key, h.value])),
          continue: true,
        }));
        const cleanUrlRoutes = vercelJson.cleanUrls
          ? [
              { src: '^/(?:(.+)/)?index(?:\\.html)?/?$', headers: { Location: '/$1' }, status: 308 },
              { src: '^/(.*)\\.html/?$', headers: { Location: '/$1' }, status: 308 },
            ]
          : [];

        // Pas de doublon (noms d'en-têtes comparés sans tenir compte de la casse), y compris
        // avec la règle de cache de /_astro/ que l'adaptateur écrit déjà.
        const key = (r) =>
          JSON.stringify({ ...r, headers: r.headers && Object.fromEntries(Object.entries(r.headers).map(([k, v]) => [k.toLowerCase(), v])) });
        const existing = new Set(output.routes.map(key));
        const added = [...headerRoutes, ...cleanUrlRoutes].filter((r) => !existing.has(key(r)));

        // Seule la route /api/contact doit être exécutée à la demande. L'adaptateur ouvre aussi
        // /_image (images à la demande) et /_server-islands/ vers la fonction : le site n'utilise
        // ni l'un ni l'autre (toutes les images sont générées au build), ces routes sont retirées.
        // Garde-fou : si une page statique y fait référence, le build s'arrête.
        const staticDir = new URL('./.vercel/output/static/', root);
        const pages = [];
        const walk = (dir) => {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const p = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
            if (entry.isDirectory()) walk(p);
            else if (entry.name.endsWith('.html')) pages.push(readFileSync(p, 'utf8'));
          }
        };
        walk(staticDir);
        const unused = ['^/_image$', '^/_server-islands/([^/]+?)$'];
        for (const [src, marker] of [
          [unused[0], '/_image?'],
          [unused[1], '/_server-islands/'],
        ]) {
          if (pages.some((html) => html.includes(marker))) {
            throw new Error(`Une page statique utilise ${marker} : la route ${src} ne peut pas être retirée.`);
          }
        }
        const before = output.routes.length;
        output.routes = output.routes.filter((r) => !unused.includes(r.src));

        output.routes = [...added, ...output.routes];
        writeFileSync(outputPath, JSON.stringify(output, null, '\t'));
        logger.info(
          `${added.length} règle(s) de vercel.json ajoutée(s), ${before - output.routes.length + added.length} route(s) dynamique(s) inutilisée(s) retirée(s) — .vercel/output/config.json`,
        );
      },
    },
  };
}
