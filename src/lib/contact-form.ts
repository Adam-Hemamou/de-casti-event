// Formulaire de contact : logique serveur (nettoyage, validation, e-mail, envoi via Resend).
//
// Fonctions pures, sans dépendance à Astro : elles sont utilisées par la route
// src/pages/api/contact.ts et peuvent être testées sans serveur ni envoi réel
// (la fonction d'envoi reçoit `fetch` en paramètre).
//
// Règles :
// - aucune validation côté navigateur n'est considérée comme suffisante : tout est revérifié ici ;
// - les listes (type d'événement, prestation, invités, budget) n'acceptent que les valeurs du formulaire ;
// - aucune donnée personnelle n'est écrite dans les journaux (seulement des codes d'erreur).
import contact from '../data/contact.json' with { type: 'json' };

/** Longueurs maximales acceptées (reprises dans les attributs maxlength du formulaire). */
export const LIMITES = {
  nom: 100,
  prenom: 100,
  email: 254,
  telephone: 30,
  lieu: 200,
  message: 5000,
} as const;

/** Taille maximale de la requête (octets) : largement au-dessus d'un formulaire rempli au maximum. */
export const TAILLE_MAX_REQUETE = 32 * 1024;

const form = contact.form;
const valeurs = {
  type: form.types.map((t) => t.label),
  prestation: form.prestations.map((p) => p.label),
  invites: form.invites,
  budget: form.budgets,
};

export type Demande = {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  type: string;
  prestation: string;
  date: string;
  lieu: string;
  invites: string;
  budget: string;
  message: string;
};
export type Champ = keyof Demande;

const CONTROLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;

/** Texte sur une ligne : caractères de contrôle et retours à la ligne retirés, espaces resserrés. */
export const uneLigne = (v: string) => v.normalize('NFC').replace(/[\r\n\t]+/g, ' ').replace(CONTROLES, '').replace(/\s+/g, ' ').trim();

/** Texte sur plusieurs lignes (message) : retours à la ligne conservés (au plus deux de suite). */
export const multiligne = (v: string) =>
  v
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(CONTROLES, '')
    .replace(/[  ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const EMAIL = /^[^\s@<>()[\]",;:\\]+@[^\s@<>()[\]",;:\\]+\.[^\s@<>()[\]",;:\\]{2,}$/;
const TELEPHONE = /^[0-9+().\s-]{6,}$/;

function dateValide(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}

/** Lit une valeur texte du formulaire ; un fichier envoyé à la place d'un texte est refusé. */
function texte(data: FormData, nom: string): string | null {
  const v = data.get(nom);
  if (v === null) return '';
  return typeof v === 'string' ? v : null;
}

export type ResultatValidation = { ok: true; demande: Demande } | { ok: false; champs: Champ[] };

/** Nettoie et valide les champs du formulaire (mêmes règles que les champs obligatoires du site). */
export function validerDemande(data: FormData): ResultatValidation {
  const champs: Champ[] = [];
  const lire = (nom: Champ, multi = false) => {
    const brut = texte(data, nom);
    if (brut === null) {
      champs.push(nom);
      return '';
    }
    return multi ? multiligne(brut) : uneLigne(brut);
  };

  const d: Demande = {
    nom: lire('nom'),
    prenom: lire('prenom'),
    email: lire('email').toLowerCase(),
    telephone: lire('telephone'),
    type: lire('type'),
    prestation: lire('prestation'),
    date: lire('date'),
    lieu: lire('lieu'),
    invites: lire('invites'),
    budget: lire('budget'),
    message: lire('message', true),
  };

  const refuser = (nom: Champ) => !champs.includes(nom) && champs.push(nom);

  // Champs obligatoires.
  if (!d.nom || d.nom.length > LIMITES.nom) refuser('nom');
  if (!d.prenom || d.prenom.length > LIMITES.prenom) refuser('prenom');
  if (!d.email || d.email.length > LIMITES.email || !EMAIL.test(d.email)) refuser('email');
  if (!d.type || !valeurs.type.includes(d.type)) refuser('type');
  if (!d.message || d.message.length > LIMITES.message) refuser('message');

  // Champs facultatifs : vides, ou conformes.
  if (d.telephone && (d.telephone.length > LIMITES.telephone || !TELEPHONE.test(d.telephone))) refuser('telephone');
  if (d.prestation && !valeurs.prestation.includes(d.prestation)) refuser('prestation');
  if (d.date && !dateValide(d.date)) refuser('date');
  if (d.lieu.length > LIMITES.lieu) refuser('lieu');
  if (d.invites && !valeurs.invites.includes(d.invites)) refuser('invites');
  if (d.budget && !valeurs.budget.includes(d.budget)) refuser('budget');

  return champs.length ? { ok: false, champs } : { ok: true, demande: d };
}

/** Champ anti-robots (invisible pour les visiteurs) : rempli = envoi automatisé. */
export const HONEYPOT = 'bot-field';
export const estRobot = (data: FormData) => {
  const v = data.get(HONEYPOT);
  return v !== null && (typeof v !== 'string' || v.trim() !== '');
};

// ——— Configuration (variables d'environnement) ———

export type Configuration = { cle: string; destinataire: string; expediteur: string };
export type ResultatConfiguration = { ok: true; config: Configuration } | { ok: false; manquantes: string[]; invalides: string[] };

const EXPEDITEUR = /^(?:[^<>\r\n]{1,100}\s)?<?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}>?$/;

/**
 * Lit RESEND_API_KEY, CONTACT_TO et CONTACT_FROM. Une variable absente ou mal formée rend
 * l'envoi indisponible (aucune valeur par défaut, aucune adresse fictive). Seuls les NOMS des
 * variables concernées sont renvoyés, jamais leur valeur.
 */
export function lireConfiguration(env: Record<string, string | undefined>): ResultatConfiguration {
  const cle = env.RESEND_API_KEY?.trim() ?? '';
  const destinataire = env.CONTACT_TO?.trim() ?? '';
  const expediteur = env.CONTACT_FROM?.trim() ?? '';
  const manquantes = [
    !cle && 'RESEND_API_KEY',
    !destinataire && 'CONTACT_TO',
    !expediteur && 'CONTACT_FROM',
  ].filter((n): n is string => !!n);
  const invalides = [
    destinataire && !EMAIL.test(destinataire) && 'CONTACT_TO',
    expediteur && !EXPEDITEUR.test(expediteur) && 'CONTACT_FROM',
  ].filter((n): n is string => !!n);
  if (manquantes.length || invalides.length) return { ok: false, manquantes, invalides };
  return { ok: true, config: { cle, destinataire, expediteur } };
}

// ——— E-mail ———

const libelle = (champ: keyof typeof form.fields) => form.fields[champ].label.replace(/\s*\*$/, '');

/** Contenu de l'e-mail envoyé à Eva (texte brut : aucun HTML issu du visiteur n'est interprété). */
export function composerEmail(d: Demande) {
  const ligne = (champ: keyof typeof form.fields, valeur: string) => `${libelle(champ)} : ${valeur || '—'}`;
  const sujet = uneLigne(`Demande de contact — ${d.type} — ${d.prenom} ${d.nom}`).slice(0, 150);
  const texteEmail = [
    'Nouvelle demande envoyée depuis le formulaire de contact du site De Casti Event.',
    '',
    ligne('nom', d.nom),
    ligne('prenom', d.prenom),
    ligne('email', d.email),
    ligne('telephone', d.telephone),
    ligne('type', d.type),
    ligne('prestation', d.prestation),
    ligne('date', d.date),
    ligne('lieu', d.lieu),
    ligne('invites', d.invites),
    ligne('budget', d.budget),
    '',
    `${libelle('message')} :`,
    d.message,
    '',
    '—',
    'Répondre à cet e-mail écrit directement à la personne qui a envoyé la demande.',
  ].join('\n');
  return { sujet, texte: texteEmail, repondreA: d.email };
}

/**
 * Clé d'idempotence Resend : identique pour deux envois identiques. Resend ne renvoie pas
 * un même e-mail deux fois en 24 h (double clic, rechargement, renvoi du formulaire).
 */
export async function cleIdempotence(d: Demande): Promise<string> {
  const empreinte = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(d)));
  const hex = [...new Uint8Array(empreinte)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `contact/${hex}`;
}

export type ResultatEnvoi = { ok: true } | { ok: false; statut: number | 'reseau' | 'delai' };

/** Envoie l'e-mail par l'API HTTP de Resend. `fetch` est injecté pour permettre les tests sans envoi. */
export async function envoyerAvecResend(
  config: Configuration,
  d: Demande,
  fetchImpl: typeof fetch = fetch,
  delaiMs = 10_000,
): Promise<ResultatEnvoi> {
  const email = composerEmail(d);
  try {
    const reponse = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.cle}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': await cleIdempotence(d),
      },
      body: JSON.stringify({
        from: config.expediteur,
        to: [config.destinataire],
        reply_to: email.repondreA,
        subject: email.sujet,
        text: email.texte,
      }),
      signal: AbortSignal.timeout(delaiMs),
    });
    return reponse.ok ? { ok: true } : { ok: false, statut: reponse.status };
  } catch (e) {
    return { ok: false, statut: e instanceof DOMException && e.name === 'TimeoutError' ? 'delai' : 'reseau' };
  }
}

// ——— Limitation du nombre d'envois (au mieux) ———

/**
 * Limite simple par adresse IP : 5 demandes par tranche de 10 minutes. Elle est tenue en
 * mémoire, donc propre à chaque instance de la fonction Vercel : c'est un frein d'appoint,
 * pas une garantie (voir la règle de limitation du pare-feu Vercel, documentée à part).
 * L'adresse IP n'est conservée que sous forme d'empreinte, jamais journalisée.
 */
export function creerLimiteur(max = 5, fenetreMs = 10 * 60 * 1000) {
  const visites = new Map<string, number[]>();
  return async (ip: string | undefined, maintenant = Date.now()): Promise<boolean> => {
    if (!ip) return true;
    const empreinte = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    const cle = [...new Uint8Array(empreinte).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const recentes = (visites.get(cle) ?? []).filter((t) => maintenant - t < fenetreMs);
    if (visites.size > 5000) visites.clear(); // garde-fou mémoire
    if (recentes.length >= max) {
      visites.set(cle, recentes);
      return false;
    }
    recentes.push(maintenant);
    visites.set(cle, recentes);
    return true;
  };
}
