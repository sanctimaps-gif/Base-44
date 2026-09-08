/**
 * Inference de type de champ a partir de son intitule.
 *
 * L'IA de Base 44 ne "devine" pas au hasard : elle applique une base de regles
 * ordonnee (motif -> type) construite pour le francais et l'anglais.
 */

import { deaccent } from '../util/text.js';

/** Catalogue des types supportes par le runtime. */
export const FIELD_TYPES = [
  'text', 'longtext', 'number', 'currency', 'percent', 'boolean', 'date', 'datetime',
  'email', 'phone', 'url', 'select', 'multiselect', 'relation', 'image', 'file',
  'rating', 'color', 'json',
];

/**
 * Regles d'inference, evaluees dans l'ordre : la premiere qui matche gagne.
 * `test` recoit l'intitule normalise (sans accents, minuscules).
 */
const RULES = [
  // Identite / contact
  { type: 'email', test: /\b(e?-?mail|courriel|adresse mail)\b/ },
  { type: 'phone', test: /\b(telephone|tel|portable|mobile|phone|gsm|fax)\b/ },
  { type: 'url', test: /\b(url|site|lien|website|link|web)\b/ },

  // Media
  { type: 'image', test: /\b(photo|image|avatar|logo|illustration|visuel|couverture|cover|banniere|banner|vignette|thumbnail)\b/ },
  { type: 'file', test: /\b(fichier|piece jointe|document|pdf|attachment|file|justificatif|contrat)\b/ },

  // Monetaire — avant "number" pour capter prix/montant
  { type: 'currency', test: /\b(prix|montant|tarif|cout|couts|salaire|budget|total|sous total|ht|ttc|price|amount|cost|revenue|fee|payment|solde|chiffre d affaires)\b/ },
  { type: 'percent', test: /\b(pourcentage|taux|remise|reduction|tva|marge|percent|percentage|rate|discount|progression|avancement)\b/ },

  // Numerique
  { type: 'number', test: /\b(quantite|nombre|stock|age|duree|poids|taille|hauteur|largeur|longueur|surface|distance|score|points|niveau|capacite|places|quantity|count|number|weight|height|width|length|duration|qty|nb|calories|reps|series)\b/ },

  // Booleen
  { type: 'boolean', test: /^(est|is|a|has|avec|actif|active|activee?|termine|terminee|fait|done|complete|completed|paye|payee|paid|valide|validee|publie|publiee|published|archive|archivee|archived|favori|favorite|urgent|visible|disponible|available|confirme|confirmee)\b/ },
  { type: 'boolean', test: /\b(oui non|yes no|vrai faux|true false|actif inactif)\b/ },

  // Temporel
  { type: 'datetime', test: /\b(date et heure|horaire|creneau|rendez vous|rdv|timestamp|datetime|debut|fin|start time|end time)\b/ },
  { type: 'date', test: /\b(date|jour|echeance|deadline|naissance|anniversaire|livraison|expiration|birthday|due|deadline|day)\b/ },

  // Enumerations
  { type: 'select', test: /\b(statut|status|etat|state|priorite|priority|categorie|category|type|genre|niveau|stade|phase|etape|civilite|sexe|genre)\b/ },
  { type: 'multiselect', test: /\b(tags|etiquettes|mots cles|keywords|labels|competences|skills|categories)\b/ },

  // Divers
  { type: 'rating', test: /\b(note|rating|evaluation|etoiles|stars|satisfaction|avis note)\b/ },
  { type: 'color', test: /\b(couleur|color|colour)\b/ },
  { type: 'json', test: /\b(json|metadonnees|metadata|configuration|config|parametres|settings|donnees brutes)\b/ },

  // Texte long
  { type: 'longtext', test: /\b(description|commentaire|commentaires|note|notes|remarque|remarques|contenu|content|message|resume|summary|biographie|bio|adresse|address|details|instructions|body|texte|comment|feedback|observations)\b/ },
];

/** Valeurs par defaut proposees pour les champs de type `select`. */
const SELECT_PRESETS = [
  {
    test: /\b(statut|status|etat|state)\b/,
    options: ['Nouveau', 'En cours', 'En attente', 'Termine', 'Annule'],
  },
  {
    test: /\b(priorite|priority)\b/,
    options: ['Basse', 'Normale', 'Haute', 'Urgente'],
  },
  {
    test: /\b(civilite)\b/,
    options: ['M.', 'Mme', 'Autre'],
  },
  {
    test: /\b(sexe|genre)\b/,
    options: ['Femme', 'Homme', 'Autre'],
  },
  {
    test: /\b(niveau|level)\b/,
    options: ['Debutant', 'Intermediaire', 'Avance', 'Expert'],
  },
  {
    test: /\b(categorie|category|type)\b/,
    options: ['Categorie A', 'Categorie B', 'Categorie C'],
  },
];

/**
 * Deduit le type d'un champ depuis son intitule.
 * @param {string} label intitule saisi par l'utilisateur
 * @returns {string} un type de FIELD_TYPES
 */
export function inferFieldType(label = '') {
  const text = deaccent(label).replace(/[_-]+/g, ' ').trim();
  if (!text) return 'text';

  for (const rule of RULES) {
    if (rule.test.test(text)) return rule.type;
  }
  return 'text';
}

/** Retourne des options par defaut pertinentes pour un `select`. */
export function suggestOptions(label = '') {
  const text = deaccent(label).replace(/[_-]+/g, ' ').trim();
  for (const preset of SELECT_PRESETS) {
    if (preset.test.test(text)) return [...preset.options];
  }
  return ['Option 1', 'Option 2', 'Option 3'];
}

/**
 * Un champ merite-t-il d'etre le titre affiche d'un enregistrement ?
 * (utilise pour choisir automatiquement le `titleField` d'une entite)
 */
export function titleScore(field) {
  const text = deaccent(field.label || field.name || '');
  if (/\b(nom|name|titre|title|libelle|label|intitule|reference|reference|sujet|subject)\b/.test(text)) return 100;
  if (field.type === 'text' && /\b(client|produit|projet|societe|entreprise|company)\b/.test(text)) return 80;
  if (field.type === 'email') return 40;
  if (field.type === 'text') return 30;
  return 0;
}

/** Valeur par defaut coherente avec le type, utilisee par les formulaires. */
export function defaultValueFor(field) {
  switch (field.type) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
      return 0;
    case 'boolean':
      return false;
    case 'multiselect':
      return [];
    case 'select':
      return field.options?.[0] ?? '';
    case 'json':
      return {};
    default:
      return '';
  }
}
