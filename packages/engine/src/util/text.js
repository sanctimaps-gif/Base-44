/**
 * Utilitaires de texte — normalisation, slug, pluriel FR/EN.
 * Zero dependance : tout est implemente ici.
 */

/** Retire les accents et passe en minuscules. */
export function deaccent(input = '') {
  return String(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Normalise un texte libre pour l'analyse (accents, ponctuation, espaces). */
export function normalize(input = '') {
  return deaccent(input)
    .replace(/['’`]/g, "'")
    .replace(/[^a-z0-9'\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Decoupe en mots. */
export function tokenize(input = '') {
  const text = normalize(input);
  if (!text) return [];
  return text.split(' ').filter(Boolean);
}

/** Genere des n-grammes contigus (utile pour les expressions en 2-3 mots). */
export function ngrams(tokens, size) {
  const out = [];
  for (let i = 0; i + size <= tokens.length; i += 1) {
    out.push(tokens.slice(i, i + size).join(' '));
  }
  return out;
}

/** identifiant technique : "Bons de commande" -> "bons_de_commande" */
export function snake(input = '') {
  return deaccent(input)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_') || 'champ';
}

/** slug URL : "Bons de commande" -> "bons-de-commande" */
export function slugify(input = '') {
  return deaccent(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'page';
}

/** PascalCase : "bon de commande" -> "BonDeCommande" */
export function pascal(input = '') {
  return snake(input)
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') || 'Entite';
}

/** camelCase */
export function camel(input = '') {
  const p = pascal(input);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** Majuscule initiale en conservant les accents d'origine. */
export function capitalize(input = '') {
  const s = String(input).trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const FR_IRREGULAR_PLURAL = {
  travail: 'travaux',
  journal: 'journaux',
  bail: 'baux',
  oeil: 'yeux',
  ciel: 'cieux',
};

const EN_IRREGULAR_PLURAL = {
  person: 'people',
  child: 'children',
  man: 'men',
  woman: 'women',
  foot: 'feet',
  tooth: 'teeth',
  mouse: 'mice',
  goose: 'geese',
};

/**
 * Pluralise un mot francais ou anglais.
 * Heuristique volontairement simple mais couvrant les cas courants du domaine.
 */
export function pluralize(word = '', lang = 'fr') {
  const w = String(word).trim();
  if (!w) return w;
  const lower = w.toLowerCase();

  if (lang === 'fr') {
    if (FR_IRREGULAR_PLURAL[lower]) return matchCase(w, FR_IRREGULAR_PLURAL[lower]);
    if (/(s|x|z)$/i.test(w)) return w;
    if (/(eau|au|eu)$/i.test(w)) return `${w}x`;
    if (/al$/i.test(w)) return `${w.slice(0, -2)}aux`;
    return `${w}s`;
  }

  if (EN_IRREGULAR_PLURAL[lower]) return matchCase(w, EN_IRREGULAR_PLURAL[lower]);
  if (/(s|x|z|ch|sh)$/i.test(w)) return `${w}es`;
  if (/[^aeiou]y$/i.test(w)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
}

/** Singularise (heuristique inverse, best-effort). */
export function singularize(word = '', lang = 'fr') {
  const w = String(word).trim();
  if (!w) return w;
  const lower = w.toLowerCase();

  if (lang === 'fr') {
    for (const [sing, plur] of Object.entries(FR_IRREGULAR_PLURAL)) {
      if (lower === plur) return matchCase(w, sing);
    }
    if (/aux$/i.test(w)) return `${w.slice(0, -3)}al`;
    if (/(eaux|eux)$/i.test(w)) return w.slice(0, -1);
    if (/s$/i.test(w) && !/us$/i.test(w)) return w.slice(0, -1);
    return w;
  }

  for (const [sing, plur] of Object.entries(EN_IRREGULAR_PLURAL)) {
    if (lower === plur) return matchCase(w, sing);
  }
  if (/ies$/i.test(w)) return `${w.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|ses)$/i.test(w)) return w.slice(0, -2);
  if (/s$/i.test(w) && !/ss$/i.test(w)) return w.slice(0, -1);
  return w;
}

/** Applique la casse de `model` a `value` (Client -> Clients). */
function matchCase(model, value) {
  if (model === model.toUpperCase()) return value.toUpperCase();
  if (model[0] === model[0].toUpperCase()) return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}

/** Distance de Levenshtein, utilisee pour la tolerance aux fautes de frappe. */
export function levenshtein(a = '', b = '') {
  const s = deaccent(a);
  const t = deaccent(b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[t.length];
}

/** Similarite 0..1 tolerante aux fautes. */
export function similarity(a = '', b = '') {
  const max = Math.max(deaccent(a).length, deaccent(b).length);
  if (!max) return 1;
  return 1 - levenshtein(a, b) / max;
}
