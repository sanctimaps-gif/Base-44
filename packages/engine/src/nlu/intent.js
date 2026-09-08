/**
 * Classification d'intention.
 *
 * L'IA determine ce que l'utilisateur veut faire (creer une app, ajouter un
 * champ, changer le theme, poser une question...). Le classifieur combine :
 *   1. des indices lexicaux ponderes (cues),
 *   2. la position dans la phrase,
 *   3. le contexte conversationnel (une app existe deja ou non).
 */

import { normalize, tokenize } from '../util/text.js';
import {
  CREATE_APP_CUES, ADD_ENTITY_CUES, ADD_FIELD_CUES, ADD_PAGE_CUES,
  REMOVE_CUES, RENAME_CUES, THEME_CUES, QUESTION_CUES, VIEW_WORDS,
} from './lexicon.js';

export const INTENTS = {
  CREATE_APP: 'create_app',
  ADD_ENTITY: 'add_entity',
  ADD_FIELD: 'add_field',
  ADD_PAGE: 'add_page',
  REMOVE: 'remove',
  RENAME: 'rename',
  SET_THEME: 'set_theme',
  SEED_DATA: 'seed_data',
  QUESTION: 'question',
  SMALLTALK: 'smalltalk',
  UNKNOWN: 'unknown',
};

/** Compte les indices presents dans le texte et pondere selon leur longueur. */
function cueScore(text, cues) {
  let score = 0;
  for (const cue of cues) {
    if (text.includes(cue)) {
      // Une expression longue est un signal plus fiable qu'un mot isole.
      score += 1 + cue.split(' ').length * 0.35;
    }
  }
  return score;
}

const SMALLTALK = [
  'bonjour', 'salut', 'hello', 'hi', 'coucou', 'bonsoir', 'merci', 'thanks', 'thank you',
  'ca va', 'au revoir', 'bye', 'ok', 'super', 'parfait', 'genial',
];

const SEED_CUES = [
  'donnees de test', 'donnees d exemple', 'jeu de donnees', 'exemples', 'remplis',
  'remplir', 'peuple', 'peupler', 'genere des donnees', 'donnees fictives',
  'sample data', 'demo data', 'test data', 'seed', 'fill', 'populate', 'fake data',
];

/**
 * Classe une requete utilisateur.
 * @param {string} message texte brut
 * @param {{hasApp?: boolean}} context etat de la conversation
 * @returns {{intent: string, confidence: number, scores: Record<string, number>}}
 */
export function classify(message, context = {}) {
  const text = normalize(message);
  const tokens = tokenize(message);
  const hasApp = Boolean(context.hasApp);

  if (!text) {
    return { intent: INTENTS.UNKNOWN, confidence: 0, scores: {} };
  }

  const scores = {
    [INTENTS.CREATE_APP]: cueScore(text, CREATE_APP_CUES),
    [INTENTS.ADD_ENTITY]: cueScore(text, ADD_ENTITY_CUES),
    [INTENTS.ADD_FIELD]: cueScore(text, ADD_FIELD_CUES),
    [INTENTS.ADD_PAGE]: cueScore(text, ADD_PAGE_CUES),
    [INTENTS.REMOVE]: cueScore(text, REMOVE_CUES),
    [INTENTS.RENAME]: cueScore(text, RENAME_CUES),
    [INTENTS.SET_THEME]: cueScore(text, THEME_CUES),
    [INTENTS.SEED_DATA]: cueScore(text, SEED_CUES),
    [INTENTS.QUESTION]: cueScore(text, QUESTION_CUES) * 0.8,
    [INTENTS.SMALLTALK]: 0,
    [INTENTS.UNKNOWN]: 0.35,
  };

  // Salutation courte et sans autre signal.
  if (tokens.length <= 3 && SMALLTALK.some((s) => text.includes(s))) {
    scores[INTENTS.SMALLTALK] += 3;
  }

  // Un point d'interrogation renforce nettement l'hypothese "question".
  if (/\?\s*$/.test(String(message).trim())) {
    scores[INTENTS.QUESTION] += 1.5;
  }

  // Une demande de vue explicite ("ajoute un kanban") vise une page.
  for (const word of Object.keys(VIEW_WORDS)) {
    if (text.includes(word) && /\b(ajoute|ajouter|add|veux|want|met|mets)\b/.test(text)) {
      scores[INTENTS.ADD_PAGE] += 1.2;
    }
  }

  // Sans application existante, toute demande de construction est une creation.
  if (!hasApp) {
    scores[INTENTS.CREATE_APP] += 1.6;
    // On ne peut pas modifier ce qui n'existe pas.
    scores[INTENTS.ADD_FIELD] *= 0.35;
    scores[INTENTS.ADD_ENTITY] *= 0.5;
    scores[INTENTS.REMOVE] *= 0.2;
    scores[INTENTS.RENAME] *= 0.2;
  } else {
    // L'app existe : une phrase de modification prime sur une recreation.
    scores[INTENTS.CREATE_APP] *= 0.55;
  }

  // "gestion de X" / "application de X" sans verbe reste une creation.
  if (!hasApp && /\b(gestion|suivi|management|tracker|gerer|manage)\b/.test(text)) {
    scores[INTENTS.CREATE_APP] += 1.2;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [intent, top] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  const total = ranked.reduce((sum, [, v]) => sum + Math.max(v, 0), 0) || 1;

  // Confiance = part du score dominant, majoree par l'ecart avec le suivant.
  const confidence = Math.min(1, (top / total) * 0.7 + Math.min((top - second) / 3, 0.3));

  return { intent, confidence: Number(confidence.toFixed(3)), scores };
}
