// Tests de la détection des marqueurs juridiques et de ses effets (noindex, sitemap).
// Lancement : npm test (module node:test, aucune dépendance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estProvisoire, filtreSitemap, pagesHorsSitemap, typeMarqueur, marqueurs } from '../src/lib/legal-marqueurs.ts';
import pages from '../src/data/pages.json' with { type: 'json' };

const URLS = ['/', '/dj', '/agence-evenementielle', '/contact', '/mentions-legales', '/politique-de-confidentialite', '/merci', '/404'];
const legales = (p) => ({ 'mentions-legales': p.mentions, 'politique-de-confidentialite': p.confidentialite });
const sitemap = (p) => URLS.filter(filtreSitemap(pagesHorsSitemap(legales(p)))).map((u) => u);
const sansMarqueur = (p) => JSON.parse(JSON.stringify(p).replace(marqueurs(), 'valeur de test'));

test('variantes de « À COMPLÉTER » détectées', () => {
  for (const v of ['[À COMPLÉTER]', '[À COMPLÉTER : nom]', '[à compléter]', '[A COMPLETER]', '[À COMPLETER]', '[ À COMPLÉTER ]', '[a completer : x]', '[  À   COMPLÉTER  :  x ]', '[ÀCOMPLÉTER]'])
    assert.equal(estProvisoire(v), true, v);
});

test('variantes de « À CONFIRMER » détectées', () => {
  for (const v of ['[À CONFIRMER]', '[À CONFIRMER : base légale]', '[à confirmer]', '[A CONFIRMER]', '[ À CONFIRMER ]', '[a confirmer: x]'])
    assert.equal(estProvisoire(v), true, v);
});

test('accents décomposés (NFD) traités comme les accents composés', () => {
  assert.equal(estProvisoire('[À COMPLÉTER]'.normalize('NFD')), true);
  assert.equal(estProvisoire('[à compléter]'.normalize('NFD')), true);
});

test('textes ordinaires non pris pour des marqueurs', () => {
  for (const v of ['« À compléter » ou « À confirmer »', '[Texte à confirmer]', '[formulaire de contact](/contact)', 'à compléter plus tard', '[À propos]', '[Accompli]'])
    assert.equal(estProvisoire(v), false, v);
});

test('type du marqueur reconnu quelle que soit l’écriture', () => {
  for (const m of ['COMPLÉTER', 'compléter', 'COMPLETER', 'completer', 'COMPLÉTER'.normalize('NFD')]) assert.equal(typeMarqueur(m), 'completer', m);
  for (const m of ['CONFIRMER', 'confirmer']) assert.equal(typeMarqueur(m), 'confirmer', m);
});

test('marqueur complet extrait avec sa précision (affichage)', () => {
  const trouves = [...'a [ à compléter : nom ] b [A CONFIRMER] c'.matchAll(marqueurs())].map((m) => [typeMarqueur(m[1]), m[2]]);
  assert.deepEqual(trouves, [['completer', 'nom'], ['confirmer', '']]);
});

test('état actuel : les deux pages légales sont provisoires, donc noindex et hors sitemap', () => {
  assert.equal(estProvisoire(pages.mentions), true);
  assert.equal(estProvisoire(pages.confidentialite), true);
  assert.deepEqual(sitemap(pages), ['/', '/dj', '/agence-evenementielle', '/contact']);
});

test('l’avertissement « page en cours de finalisation » ne compte pas comme marqueur', () => {
  assert.equal(estProvisoire(pages.mentions.provisional), false);
  assert.equal(estProvisoire(pages.confidentialite.provisional), false);
});

test('une seule occurrence (même en variante) suffit : noindex et hors sitemap', () => {
  for (const variante of ['[À COMPLÉTER : x]', '[a completer]', '[ À CONFIRMER ]']) {
    const p = sansMarqueur(pages);
    p.confidentialite.sections.at(-1).blocks[0].p += ` ${variante}`;
    assert.equal(estProvisoire(p.confidentialite), true, variante);
    assert.equal(estProvisoire(p.mentions), false);
    assert.deepEqual(sitemap(p), ['/', '/dj', '/agence-evenementielle', '/contact', '/mentions-legales'], variante);
  }
});

test('aucun marqueur restant : pages légales indexables et listées dans le sitemap', () => {
  const p = sansMarqueur(pages);
  assert.equal(estProvisoire(p.mentions), false);
  assert.equal(estProvisoire(p.confidentialite), false);
  assert.deepEqual(sitemap(p), ['/', '/dj', '/agence-evenementielle', '/contact', '/mentions-legales', '/politique-de-confidentialite']);
});

test('404 et merci toujours exclues du sitemap, quel que soit l’état des pages légales', () => {
  for (const p of [pages, sansMarqueur(pages)]) {
    const garde = filtreSitemap(pagesHorsSitemap(legales(p)));
    for (const u of ['/404', '/404.html', '/404/', '/merci', '/merci.html']) assert.equal(garde(`https://exemple.fr${u}`), false, u);
  }
  assert.deepEqual(pagesHorsSitemap({}), ['merci', '404']);
});

test('le filtre du sitemap couvre les variantes d’adresse (.html, barre finale)', () => {
  const garde = filtreSitemap(['mentions-legales']);
  for (const u of ['/mentions-legales', '/mentions-legales.html', '/mentions-legales/']) assert.equal(garde(`https://exemple.fr${u}`), false, u);
  assert.equal(garde('https://exemple.fr/dj'), true);
});
