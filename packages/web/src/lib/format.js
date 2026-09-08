/** Formatage et helpers d'affichage partages par tout le studio. */

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat('fr-FR');

/** Rend une valeur selon le type declare dans le spec. */
export function formatValue(value, type) {
  if (value === null || value === undefined || value === '') return '—';

  switch (type) {
    case 'currency':
      return Number.isFinite(Number(value)) ? currency.format(Number(value)) : String(value);
    case 'percent':
      return `${number.format(Number(value) || 0)} %`;
    case 'number':
      return Number.isFinite(Number(value)) ? number.format(Number(value)) : String(value);
    case 'boolean':
      return value ? 'Oui' : 'Non';
    case 'date':
      return safeDate(value, { dateStyle: 'medium' });
    case 'datetime':
      return safeDate(value, { dateStyle: 'medium', timeStyle: 'short' });
    case 'multiselect':
      return Array.isArray(value) ? value.join(', ') || '—' : String(value);
    case 'rating': {
      const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
      return '★'.repeat(n) + '☆'.repeat(5 - n);
    }
    case 'json':
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    default:
      return String(value);
  }
}

function safeDate(value, options) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('fr-FR', options);
}

/** Date relative courte ("il y a 3 min"). */
export function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "a l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)} h`;
  if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Valeur initiale d'un champ dans un formulaire. */
export function emptyValue(field) {
  switch (field.type) {
    case 'boolean': return false;
    case 'multiselect': return [];
    case 'number': case 'currency': case 'percent': case 'rating': return '';
    default: return '';
  }
}

/** Type d'input HTML correspondant au type metier. */
export function inputType(type) {
  switch (type) {
    case 'number': case 'currency': case 'percent': case 'rating': return 'number';
    case 'date': return 'date';
    case 'datetime': return 'datetime-local';
    case 'email': return 'email';
    case 'phone': return 'tel';
    case 'url': return 'url';
    case 'color': return 'color';
    default: return 'text';
  }
}

/**
 * Couleur semantique d'un statut : les libelles courants recoivent une teinte
 * coherente dans toute l'application.
 */
export function statusTone(value = '') {
  const v = String(value).toLowerCase();
  if (/(termin|resolu|résolu|paye|payé|livre|livré|gagn|actif|valide|validé|approuv|confirm|present|présent|rendu|publie|publié|done|paid|closed|complete)/.test(v)) return 'success';
  if (/(cours|attente|revue|negoci|négoci|proposition|envoye|envoyé|demand|expedi|expédi|planifi|pause|progress|pending)/.test(v)) return 'warning';
  if (/(annul|perdu|refus|retard|critique|urgent|ferme|fermé|absent|inactif|cancel|failed|overdue)/.test(v)) return 'danger';
  return 'default';
}

/** Convertit un ISO en valeur acceptee par <input type="datetime-local">. */
export function toInputDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convertit un ISO en valeur acceptee par <input type="date">. */
export function toInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

/**
 * Rendu minimal du sous-ensemble Markdown produit par le moteur
 * (**gras**, listes a puces, paragraphes). Volontairement limite : aucune
 * balise HTML brute n'est interpretee, donc aucun risque d'injection.
 */
export function renderMarkdown(text = '') {
  const blocks = String(text).split(/\n{2,}/);

  return blocks.map((block) => {
    const lines = block.split('\n');
    const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));
    if (isList) {
      return { type: 'list', items: lines.map((l) => l.replace(/^\s*[-*]\s+/, '')) };
    }
    return { type: 'p', text: block };
  });
}

/** Decoupe un texte en segments normaux / gras, pour un rendu React sur. */
export function splitBold(text = '') {
  return String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => (
    part.startsWith('**') && part.endsWith('**')
      ? { bold: true, text: part.slice(2, -2) }
      : { bold: false, text: part }
  ));
}
