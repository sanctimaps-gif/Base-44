/**
 * Lexique bilingue (FR/EN) du moteur Base 44.
 *
 * C'est la base de connaissance linguistique de l'IA : elle est entierement
 * locale et lisible. Aucun modele externe n'est consulte.
 */

/** Mots vides ignores lors de l'extraction. */
export const STOPWORDS = new Set([
  // FR
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'et', 'ou', 'a', 'au', 'aux',
  'en', 'dans', 'pour', 'par', 'avec', 'sur', 'sous', 'ce', 'cet', 'cette', 'ces', 'mon', 'ma',
  'mes', 'son', 'sa', 'ses', 'leur', 'leurs', 'notre', 'nos', 'votre', 'vos', 'je', 'tu', 'il',
  'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'que', 'qui', 'quoi', 'dont', 'est', 'sont',
  'etre', 'avoir', 'ai', 'as', 'ont', 'faire', 'fait', 'plus', 'moins', 'tres', 'aussi', 'meme',
  'chaque', 'tout', 'tous', 'toute', 'toutes', 'me', 'il', 'y', 'se', 'sa', 'ne', 'pas', 's',
  'aussi', 'ainsi', 'afin', 'car', 'donc', 'puis', 'ensuite', 'alors', 'quand', 'comme',
  // EN
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'at', 'from',
  'this', 'that', 'these', 'those', 'my', 'our', 'your', 'their', 'its', 'is', 'are', 'be',
  'have', 'has', 'do', 'does', 'it', 'i', 'we', 'you', 'they', 'he', 'she', 'as', 'so', 'then',
  'each', 'every', 'all', 'some', 'any', 'not', 'no',
]);

/** Verbes/expressions signalant une creation d'application. */
export const CREATE_APP_CUES = [
  'cree une application', 'creer une application', 'cree moi une application',
  'construis une application', 'construire une application', 'fais une application',
  'je veux une application', 'j aimerais une application', 'developpe une application',
  'genere une application', 'application de', 'application pour', 'appli de', 'appli pour',
  'un outil de', 'un outil pour', 'une plateforme de', 'un site de', 'un logiciel de',
  'build an app', 'create an app', 'make an app', 'i want an app', 'build me an app',
  'generate an app', 'app for', 'app to', 'a tool for', 'a platform for', 'a site for',
];

/** Expressions signalant l'ajout d'une entite / table. */
export const ADD_ENTITY_CUES = [
  'ajoute une entite', 'ajoute une table', 'ajoute un modele', 'ajouter une entite',
  'ajoute la table', 'nouvelle entite', 'nouvelle table', 'cree une table', 'cree une entite',
  'je veux gerer', 'gerer aussi', 'ajoute la gestion',
  'add an entity', 'add a table', 'add a model', 'new entity', 'new table', 'create a table',
  'i want to manage', 'also manage',
];

/** Expressions signalant l'ajout d'un champ. */
export const ADD_FIELD_CUES = [
  'ajoute un champ', 'ajoute le champ', 'ajoute les champs', 'ajouter un champ',
  'ajoute une colonne', 'nouveau champ', 'avec les champs', 'avec un champ',
  'add a field', 'add the field', 'add fields', 'add a column', 'new field', 'with fields',
];

/** Expressions signalant l'ajout d'une page / vue. */
export const ADD_PAGE_CUES = [
  'ajoute une page', 'ajoute la page', 'nouvelle page', 'ajoute une vue', 'ajoute un ecran',
  'ajoute un tableau de bord', 'ajoute un kanban', 'ajoute un calendrier',
  'add a page', 'new page', 'add a view', 'add a screen', 'add a dashboard', 'add a kanban',
  'add a calendar',
];

/** Expressions de suppression. */
export const REMOVE_CUES = [
  'supprime', 'supprimer', 'retire', 'retirer', 'enleve', 'enlever', 'efface', 'effacer',
  'remove', 'delete', 'drop', 'get rid of',
];

/** Expressions de renommage. */
export const RENAME_CUES = [
  'renomme', 'renommer', 'change le nom', 'appelle le', 'appelle la',
  'rename', 'change the name', 'call it',
];

/** Expressions de theme / apparence. */
export const THEME_CUES = [
  'theme', 'couleur', 'couleurs', 'apparence', 'design', 'style', 'mode sombre', 'mode clair',
  'palette', 'charte graphique',
  'color', 'colors', 'colour', 'appearance', 'dark mode', 'light mode', 'look',
];

/** Couleurs nommees reconnues -> hex. */
export const COLOR_WORDS = {
  bleu: '#2563eb', blue: '#2563eb',
  indigo: '#4f46e5',
  violet: '#7c3aed', purple: '#7c3aed', mauve: '#7c3aed',
  rose: '#e11d48', pink: '#ec4899',
  rouge: '#dc2626', red: '#dc2626',
  orange: '#ea580c',
  ambre: '#d97706', amber: '#d97706', jaune: '#ca8a04', yellow: '#ca8a04',
  vert: '#16a34a', green: '#16a34a',
  emeraude: '#059669', emerald: '#059669',
  turquoise: '#0d9488', teal: '#0d9488',
  cyan: '#0891b2',
  noir: '#111827', black: '#111827',
  gris: '#4b5563', grey: '#4b5563', gray: '#4b5563',
};

/** Mots indiquant le mode sombre / clair. */
export const DARK_WORDS = ['sombre', 'noir', 'nuit', 'dark', 'night'];
export const LIGHT_WORDS = ['clair', 'blanc', 'jour', 'light', 'bright'];

/** Types de vues demandables explicitement. */
export const VIEW_WORDS = {
  kanban: 'kanban',
  tableau: 'list',
  liste: 'list',
  list: 'list',
  table: 'list',
  grille: 'gallery',
  gallery: 'gallery',
  galerie: 'gallery',
  calendrier: 'calendar',
  calendar: 'calendar',
  agenda: 'calendar',
  planning: 'calendar',
  dashboard: 'dashboard',
  'tableau de bord': 'dashboard',
  statistiques: 'dashboard',
  stats: 'dashboard',
  analytics: 'dashboard',
  formulaire: 'form',
  form: 'form',
  fiche: 'detail',
  detail: 'detail',
  details: 'detail',
};

/** Marqueurs de question (le moteur repond au lieu de modifier l'app). */
export const QUESTION_CUES = [
  'comment', 'pourquoi', 'quoi', 'quel', 'quelle', 'quels', 'quelles', 'est ce que',
  'peux tu', 'peux-tu', 'sais tu', 'explique', 'c est quoi', 'qu est ce',
  'how', 'why', 'what', 'which', 'can you', 'could you', 'explain', 'do you',
];

/** Mots marquant un champ obligatoire. */
export const REQUIRED_WORDS = ['obligatoire', 'requis', 'required', 'mandatory', 'necessaire'];

/** Mots marquant l'unicite. */
export const UNIQUE_WORDS = ['unique', 'uniques'];

/**
 * Separateurs d'enumeration utilises pour extraire des listes de champs
 * ("nom, prenom, email et telephone").
 */
export const LIST_SEPARATORS = /\s*(?:,|;|\/|\bet\b|\band\b|\bou\b|\bor\b|\+)\s*/;
