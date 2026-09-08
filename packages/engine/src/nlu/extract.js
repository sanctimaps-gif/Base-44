/**
 * Extraction d'informations structurees depuis le langage naturel.
 *
 * Repond aux questions : de quel domaine parle-t-on ? quelles entites ?
 * quels champs ? quelle couleur ? quel nom d'application ?
 */

import { deaccent, normalize, tokenize, singularize, capitalize } from '../util/text.js';
import { BLUEPRINTS, GENERIC_BLUEPRINT } from '../knowledge/blueprints.js';
import { inferFieldType, suggestOptions } from '../knowledge/fieldTypes.js';
import {
  STOPWORDS, COLOR_WORDS, DARK_WORDS, LIGHT_WORDS, VIEW_WORDS,
  LIST_SEPARATORS, REQUIRED_WORDS, UNIQUE_WORDS,
} from './lexicon.js';

/**
 * Detecte le(s) domaine(s) evoque(s) et les classe par pertinence.
 * @returns {{blueprint: object, score: number, matches: string[]}}
 */
export function detectDomain(message) {
  const text = normalize(message);
  const padded = ` ${text} `;
  const results = [];

  for (const bp of BLUEPRINTS) {
    let score = 0;
    const matches = [];
    for (const kw of bp.keywords) {
      // Recherche par mot entier pour eviter "note" dans "notebook".
      if (padded.includes(` ${kw} `) || padded.includes(` ${kw}s `)) {
        score += 1 + kw.split(' ').length * 0.5;
        matches.push(kw);
      }
    }
    if (score > 0) results.push({ blueprint: bp, score, matches });
  }

  results.sort((a, b) => b.score - a.score);
  if (!results.length) {
    return { blueprint: GENERIC_BLUEPRINT, score: 0, matches: [] };
  }
  return results[0];
}

/** Retourne tous les domaines pertinents (pour les apps multi-metiers). */
export function detectDomains(message, limit = 2) {
  const text = normalize(message);
  const padded = ` ${text} `;
  const results = [];

  for (const bp of BLUEPRINTS) {
    let score = 0;
    for (const kw of bp.keywords) {
      if (padded.includes(` ${kw} `) || padded.includes(` ${kw}s `)) {
        score += 1 + kw.split(' ').length * 0.5;
      }
    }
    if (score > 0) results.push({ blueprint: bp, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Extrait une liste de noms d'entites explicitement citee.
 * Ex : "avec des clients, des factures et des produits"
 */
export function extractEntityNames(message) {
  const raw = String(message);
  const found = new Set();

  // Motif : "avec des X, des Y et des Z" / "gerer des X" / "with X, Y and Z"
  const patterns = [
    /(?:avec|contenant|comprenant|incluant|gerer|gere|suivre|suivi de|pour gerer)\s+(?:des|les|mes|de[s]?|du|la|le|un|une)?\s*([a-zA-ZÀ-ÿ'’\s,;\/\-]+?)(?:\.|$|\bpour\b|\bafin\b|\bavec un theme\b)/gi,
    /(?:with|manage|track|containing|including)\s+([a-zA-Z'\s,;\/\-]+?)(?:\.|$|\bfor\b|\bwith a theme\b)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(raw)) !== null) {
      const chunk = match[1];
      if (!chunk) continue;
      for (const piece of chunk.split(LIST_SEPARATORS)) {
        const cleaned = cleanEntityName(piece);
        if (cleaned) found.add(cleaned);
      }
    }
  }

  return [...found];
}

/** Nettoie un fragment pour en faire un nom d'entite singulier presentable. */
function cleanEntityName(piece) {
  const tokens = tokenize(piece).filter((t) => !STOPWORDS.has(t));
  if (!tokens.length) return null;
  // On garde au plus 3 mots significatifs ("bon de commande" -> "bon commande")
  const kept = tokens.slice(0, 3);
  const singular = kept.map((t, i) => (i === 0 ? singularize(t, 'fr') : t));
  const name = singular.join(' ').trim();
  if (name.length < 3 || name.length > 40) return null;
  if (/^\d+$/.test(name)) return null;
  return capitalize(name);
}

/**
 * Extrait des champs cites explicitement.
 * Ex : "avec les champs nom, email et telephone"
 */
export function extractFields(message) {
  const raw = String(message);
  const fields = [];
  const seen = new Set();

  // La capture s'arrete devant une preposition qui introduit l'entite cible
  // (« ... email et telephone AUX fournisseurs ») pour ne pas l'avaler.
  const patterns = [
    /(?:champs?|colonnes?|attributs?|proprietes?|fields?|columns?|attributes?)\s*(?::|=)?\s*([a-zA-ZÀ-ÿ0-9'’\s,;\/\-]+?)(?=\s+(?:a|au|aux|sur|dans|pour|vers|to|for|on|in|into)\s+|[.!?]|$)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(raw)) !== null) {
      for (const piece of match[1].split(LIST_SEPARATORS)) {
        const label = cleanFieldLabel(piece);
        if (!label) continue;
        const key = deaccent(label);
        if (seen.has(key)) continue;
        seen.add(key);

        const normalizedPiece = normalize(piece);
        const type = inferFieldType(label);
        const field = { label, type };
        if (type === 'select') field.options = suggestOptions(label);
        if (REQUIRED_WORDS.some((w) => normalizedPiece.includes(w))) field.required = true;
        if (UNIQUE_WORDS.some((w) => normalizedPiece.includes(w))) field.unique = true;
        fields.push(field);
      }
    }
  }

  return fields;
}

function cleanFieldLabel(piece) {
  let tokens = tokenize(piece);
  // On retire les qualificatifs qui ne font pas partie du nom du champ.
  tokens = tokens.filter(
    (t) => !STOPWORDS.has(t) && !REQUIRED_WORDS.includes(t) && !UNIQUE_WORDS.includes(t)
      && !['champ', 'champs', 'colonne', 'colonnes', 'field', 'fields', 'column', 'columns'].includes(t),
  );
  if (!tokens.length) return null;
  const label = tokens.slice(0, 4).join(' ');
  if (label.length < 2 || label.length > 40) return null;
  return capitalize(label);
}

/** Detecte une couleur / un mode d'affichage demande. */
export function extractTheme(message) {
  const text = normalize(message);
  const theme = {};

  for (const [word, hex] of Object.entries(COLOR_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      theme.primary = hex;
      theme.primaryName = word;
      break;
    }
  }

  // Couleur hexadecimale explicite.
  const hex = String(message).match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (hex) theme.primary = hex[0];

  if (DARK_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(text))) theme.mode = 'dark';
  if (LIGHT_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(text))) theme.mode = 'light';

  if (/\b(arrondi|arrondis|rounded|doux)\b/.test(text)) theme.radius = 16;
  if (/\b(carre|carres|square|anguleux|sharp)\b/.test(text)) theme.radius = 4;

  return theme;
}

/** Detecte un type de vue demande ("kanban", "calendrier"...). */
export function extractViewType(message) {
  const text = normalize(message);
  for (const [word, view] of Object.entries(VIEW_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return view;
  }
  return null;
}

/**
 * Propose un nom d'application a partir de la demande.
 * Ex : "une application de gestion de clients" -> "Gestion de clients"
 */
export function extractAppName(message, blueprint) {
  const raw = String(message);

  // Nom explicitement donne entre guillemets ou apres "appelee/nommee".
  const quoted = raw.match(/["«“']([^"»”']{3,40})["»”']/);
  if (quoted) return capitalize(quoted[1].trim());

  const named = raw.match(/(?:appelee?|nommee?|intitulee?|called|named)\s+([a-zA-ZÀ-ÿ0-9'’\s\-]{3,40})/i);
  if (named) return capitalize(named[1].trim().replace(/\s+/g, ' '));

  // Sinon : "application de X" -> "Gestion de X"
  const subject = raw.match(
    /(?:application|appli|app|outil|plateforme|logiciel|site|tool|platform|software)\s+(?:de|d'|pour|du|des|to|for|of)\s+([a-zA-ZÀ-ÿ0-9'’\s\-]{3,45})/i,
  );
  if (subject) {
    const cleaned = trimAppName(subject[1]);
    if (cleaned.length >= 3) return capitalize(cleaned);
  }

  return blueprint?.label || 'Nouvelle application';
}

/**
 * Raccourcit un nom d'application : on coupe aux conjonctions qui introduisent
 * des precisions ("... avec un suivi des factures et un theme vert").
 */
function trimAppName(raw) {
  let name = String(raw).trim().replace(/\s+/g, ' ').replace(/[.,;].*$/, '');

  // Coupe a la premiere conjonction introduisant un complement.
  const cut = name.search(/\s+(?:avec|et|qui|pour|afin|ou|incluant|comprenant|contenant|with|and|that|to|for|including)\s+/i);
  if (cut > 8) name = name.slice(0, cut);

  // Filet de securite sur la longueur.
  if (name.length > 45) {
    name = name.slice(0, 45).replace(/\s+\S*$/, '');
  }
  return name.trim();
}

/**
 * Extrait le nom cible d'une operation (suppression, renommage).
 * Ex : "supprime le champ telephone" -> "telephone"
 */
export function extractTarget(message) {
  const raw = String(message);
  const match = raw.match(
    /(?:supprime|supprimer|retire|retirer|enleve|enlever|remove|delete|renomme|rename)\s+(?:le|la|les|l'|the|a|an)?\s*(?:champ|colonne|entite|table|page|field|column|entity|view|vue)?\s*["«“']?([a-zA-ZÀ-ÿ0-9'’\s\-]{2,40})["»”']?/i,
  );
  if (!match) return null;
  const tokens = tokenize(match[1]).filter((t) => !STOPWORDS.has(t));
  if (!tokens.length) return null;
  return capitalize(tokens.slice(0, 3).join(' '));
}

/** Extrait le nouveau nom d'un renommage ("renomme X en Y"). */
export function extractRenameTarget(message) {
  const match = String(message).match(
    /(?:renomme|renommer|rename)\s+(?:le|la|les|l'|the)?\s*(?:champ|entite|table|page|field|entity)?\s*["«“']?([a-zA-ZÀ-ÿ0-9'’\s\-]{2,40}?)["»”']?\s+(?:en|to|par|vers)\s+["«“']?([a-zA-ZÀ-ÿ0-9'’\s\-]{2,40})["»”']?/i,
  );
  if (!match) return null;
  return { from: capitalize(match[1].trim()), to: capitalize(match[2].trim()) };
}
