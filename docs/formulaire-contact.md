# Formulaire de contact : Vercel + Resend

Ce document décrit le fonctionnement du formulaire de contact et les étapes pour le mettre en service une fois le domaine définitif acheté. **Aucune clé, adresse ou valeur secrète ne doit être écrite dans le dépôt.**

## Fonctionnement

| Élément | Rôle |
|---|---|
| `src/components/ContactForm.astro` | Formulaire (design inchangé). Envoi en arrière-plan avec JavaScript, bouton verrouillé pendant l'envoi, message d'erreur sans perte de saisie. Sans JavaScript : envoi classique. |
| `src/pages/api/contact.ts` | Seule route exécutée à la demande (fonction Vercel). Toutes les pages restent statiques. |
| `src/lib/contact-form.ts` | Nettoyage et validation serveur, contenu de l'e-mail, appel à l'API Resend, limitation des envois. |
| `src/data/contact.json` (`form.sending`, `form.sendErrors`) | Textes affichés pendant l'envoi et en cas d'échec. |
| `integrations/vercel-config.mjs` | Recopie les en-têtes de sécurité et `cleanUrls` de `vercel.json` dans la sortie de l'adaptateur, et retire les routes dynamiques inutilisées. |

Après un envoi réussi, le visiteur arrive sur `/merci`. L'e-mail est envoyé en texte brut à `CONTACT_TO`. Un clic sur « Répondre » écrit directement au visiteur (`reply_to`).

### Contrôles côté serveur (dans l'ordre)

1. Méthode POST uniquement (sinon 405).
2. Type de contenu de formulaire uniquement (sinon 415), taille limitée à 32 Ko (sinon 413).
3. Origine : protection intégrée d'Astro (`security.checkOrigin`) et vérification de la route (403).
4. Limite d'envois : 5 demandes par adresse IP et par 10 minutes, par instance de fonction (429). L'adresse IP n'est conservée qu'en mémoire, sous forme d'empreinte.
5. Champ anti-robots `bot-field` rempli : réponse identique à un succès, sans envoi.
6. Validation : champs obligatoires, longueurs maximales (nom et prénom 100, e-mail 254, téléphone 30, lieu 200, message 5 000 caractères), formats (e-mail, téléphone, date), listes limitées aux valeurs du formulaire, caractères de contrôle retirés (400 avec la liste des champs refusés).
7. Configuration : variables absentes ou mal formées, donc aucun envoi (503).
8. Envoi via Resend, avec un délai maximal de 10 s et une clé d'idempotence. Une demande identique n'est pas renvoyée deux fois en 24 h. En cas d'échec : 502.

### Journaux

Seuls des codes sont journalisés : envoi ignoré (anti-robots), noms des variables manquantes ou mal formées, statut d'erreur Resend. **Aucune donnée saisie ni valeur de variable n'est journalisée.**

## Variables d'environnement

| Variable | Contenu | Exemple de forme (ne pas utiliser tel quel) |
|---|---|---|
| `RESEND_API_KEY` | Clé d'API Resend (secret) | `re_…` |
| `CONTACT_TO` | Adresse qui reçoit les demandes (celle d'Eva) | `nom@domaine.fr` |
| `CONTACT_FROM` | Expéditeur, **sur un domaine vérifié dans Resend** | `De Casti Event <contact@domaine.fr>` |

- Elles sont déclarées dans `astro.config.mjs` (`env.schema`) comme secrets serveur, lus **à l'exécution** : elles ne sont ni intégrées au build ni envoyées au navigateur.
- Si l'une d'elles manque, le formulaire affiche « L'envoi du formulaire est momentanément indisponible… » et le journal indique le nom de la variable manquante. Aucun e-mail n'est envoyé.
- Sur Vercel : *Project → Settings → Environment Variables*. Les définir pour *Production* et, si besoin de tests, pour *Preview*. **Un nouveau déploiement est nécessaire** après chaque modification.
- En local, si un jour un test réel est nécessaire : un fichier `.env.local` (ignoré par git) peut les contenir. Ne jamais créer de `.env` commité.

## Mise en service (après l'achat du domaine)

1. **Compte Resend** : créer le compte au nom de l'entreprise, de préférence avec l'adresse d'Eva ou une adresse de l'entreprise.
2. **Domaine d'envoi** : dans Resend, *Domains → Add domain*. Un sous-domaine dédié à l'envoi est recommandé. Choisir la région la plus proche (Europe si proposée).
3. **DNS** : ajouter chez le registraire les enregistrements fournis par Resend (SPF et MX de retour, DKIM). Ajouter aussi un enregistrement DMARC si le domaine n'en a pas. Attendre le statut *Verified*.
4. **Clé d'API** : créer une clé à accès *Sending access* limitée à ce domaine. La copier une seule fois, directement dans Vercel.
5. **Vercel** : renseigner `RESEND_API_KEY`, `CONTACT_TO` et `CONTACT_FROM` (expéditeur sur le domaine vérifié), puis redéployer.
6. **Test** sur un déploiement de prévisualisation (en noindex par défaut) : un envoi réel vers `CONTACT_TO`, vérifier la réception, la réponse au visiteur et l'arrivée sur `/merci`.
7. **Confidentialité** : mentionner Resend (envoi des e-mails) et Vercel (hébergement) comme sous-traitants dans la politique de confidentialité, et revoir la phrase « ne seront jamais partagées » du formulaire.

## Protection complémentaire (si du spam apparaît)

- **Pare-feu Vercel** : une règle de limitation de débit sur `/api/contact`, plus fiable que la limite en mémoire, qui est propre à chaque instance.
- **Cloudflare Turnstile** : un contrôle anti-robots invisible et gratuit, à ajouter au formulaire et à vérifier dans la route.

## Vérifier sans envoi réel

- Sans variables : une demande valide renvoie `503` avec `{ "ok": false, "code": "non-configure" }`.
- Champs invalides : `400` avec `code: "invalide"` et la liste `champs`.
- Champ anti-robots rempli : `200` avec `ok: true`, sans aucun envoi.
- La logique d'envoi (`envoyerAvecResend`) reçoit `fetch` en paramètre : elle se teste avec un faux `fetch`, sans réseau.
