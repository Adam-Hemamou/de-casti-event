// Route d'envoi du formulaire de contact : seule route exécutée à la demande (fonction Vercel).
// Toutes les autres pages restent générées au build.
//
// Réponses :
// - appel en JavaScript (Accept: application/json) : JSON { ok, code, champs? } ;
// - envoi classique sans JavaScript : redirection 303 vers /merci, ou courte page d'erreur.
//
// Ordre des contrôles : méthode, type et taille de la requête, origine, limite d'envois,
// champ anti-robots, validation des champs, configuration, puis envoi via Resend.
// Journaux : uniquement des codes, jamais de donnée saisie ni de valeur de variable.
import type { APIRoute } from 'astro';
import { RESEND_API_KEY, CONTACT_TO, CONTACT_FROM } from 'astro:env/server';
// Lecture directe du fichier (et non de src/data/index.ts) : la fonction serveur n'embarque pas
// les photos du site. Le contenu est validé au build par les pages qui utilisent index.ts.
import contact from '../../data/contact.json';
import {
  TAILLE_MAX_REQUETE,
  creerLimiteur,
  envoyerAvecResend,
  estRobot,
  lireConfiguration,
  validerDemande,
  type Champ,
} from '../../lib/contact-form';

export const prerender = false;

type Code = 'envoye' | 'invalide' | 'origine' | 'format' | 'taille' | 'trop-de-demandes' | 'non-configure' | 'echec-envoi';

const PAGE_MERCI = '/merci';
const msg = contact.form.sendErrors;
const limiter = creerLimiteur();

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Message affiché au visiteur pour chaque code (aucun détail technique). */
function messagePour(code: Code): string {
  switch (code) {
    case 'invalide':
    case 'format':
    case 'taille':
      return msg.invalid;
    case 'trop-de-demandes':
      return msg.tooMany;
    case 'non-configure':
      return msg.unavailable;
    default:
      return msg.failed;
  }
}

function repondre(request: Request, code: Code, statut: number, champs?: Champ[]): Response {
  const json = request.headers.get('accept')?.includes('application/json');
  const sansCache = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (json) {
    return new Response(JSON.stringify({ ok: code === 'envoye', code, ...(champs && { champs }) }), {
      status: statut,
      headers: { ...sansCache, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  if (code === 'envoye') return new Response(null, { status: 303, headers: { ...sansCache, Location: PAGE_MERCI } });
  // Sans JavaScript : courte page d'erreur avec un lien de retour vers le formulaire.
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"><title>De Casti Event</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1.5rem;line-height:1.6"><p>${escapeHtml(messagePour(code))}</p><p><a href="/contact#formulaire">${escapeHtml(msg.back)}</a></p></body></html>`;
  return new Response(html, { status: statut, headers: { ...sansCache, 'Content-Type': 'text/html; charset=utf-8' } });
}

export const POST: APIRoute = async ({ request, url, clientAddress }) => {
  // Type et taille de la requête.
  const type = request.headers.get('content-type') ?? '';
  if (!/^(application\/x-www-form-urlencoded|multipart\/form-data)\b/i.test(type)) return repondre(request, 'format', 415);
  const taille = Number(request.headers.get('content-length') ?? 0);
  if (taille > TAILLE_MAX_REQUETE) return repondre(request, 'taille', 413);

  // Origine : seules les soumissions venant du site lui-même sont acceptées.
  const origine = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if ((origine && origine !== url.origin) || site === 'cross-site') return repondre(request, 'origine', 403);

  // Limite d'envois par adresse IP (au mieux, voir lib/contact-form.ts).
  let ip: string | undefined;
  try {
    ip = clientAddress;
  } catch {
    ip = undefined;
  }
  if (!(await limiter(ip))) return repondre(request, 'trop-de-demandes', 429);

  let data: FormData;
  try {
    const corps = await request.arrayBuffer();
    if (corps.byteLength > TAILLE_MAX_REQUETE) return repondre(request, 'taille', 413);
    data = await new Response(corps, { headers: { 'content-type': type } }).formData();
  } catch {
    return repondre(request, 'format', 400);
  }

  // Champ anti-robots rempli : réponse identique à un succès, mais aucun envoi.
  if (estRobot(data)) {
    console.info('[contact] envoi ignoré (champ anti-robots rempli)');
    return repondre(request, 'envoye', 200);
  }

  const validation = validerDemande(data);
  if (!validation.ok) return repondre(request, 'invalide', 400, validation.champs);

  const configuration = lireConfiguration({ RESEND_API_KEY, CONTACT_TO, CONTACT_FROM });
  if (!configuration.ok) {
    const details = [
      configuration.manquantes.length && `manquantes : ${configuration.manquantes.join(', ')}`,
      configuration.invalides.length && `mal formées : ${configuration.invalides.join(', ')}`,
    ].filter(Boolean);
    console.warn(`[contact] envoi impossible, configuration incomplète (${details.join(' ; ')})`);
    return repondre(request, 'non-configure', 503);
  }

  const envoi = await envoyerAvecResend(configuration.config, validation.demande);
  if (!envoi.ok) {
    console.error(`[contact] échec de l'envoi Resend (statut : ${envoi.statut})`);
    return repondre(request, 'echec-envoi', 502);
  }
  return repondre(request, 'envoye', 200);
};

/** Toute autre méthode que POST est refusée. */
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
