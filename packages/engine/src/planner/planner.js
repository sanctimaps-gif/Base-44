/**
 * Planificateur — transforme une intention comprise en mutations de l'AppSpec.
 *
 * Chaque fonction retourne { spec, changes[] } ou `changes` decrit en langage
 * clair ce que l'IA a fait, afin d'alimenter sa reponse a l'utilisateur.
 */

import { capitalize, pascal, pluralize, singularize, slugify, snake } from '../util/text.js';
import { inferFieldType, suggestOptions } from '../knowledge/fieldTypes.js';
import {
  createSpec, normalizeEntity, normalizeField, rebuildPages,
  findEntity, findField, repairSpec, buildDashboardWidgets,
} from './spec.js';
import {
  detectDomain, detectDomains, extractEntityNames, extractFields,
  extractTheme, extractAppName, extractViewType, extractTarget, extractRenameTarget,
} from '../nlu/extract.js';
import { COLOR_WORDS, VIEW_WORDS } from '../nlu/lexicon.js';
import { canonical } from '../knowledge/synonyms.js';

/** Fabrique un descripteur de changement lisible. */
const change = (kind, message, detail = {}) => ({ kind, message, ...detail });

/**
 * Construit une application complete a partir d'une description libre.
 */
export function planCreateApp(message, options = {}) {
  const changes = [];
  const primary = detectDomain(message);
  const domains = detectDomains(message, 2);

  const spec = createSpec();
  spec.domain = primary.blueprint.id;
  spec.name = options.name || extractAppName(message, primary.blueprint);
  spec.slug = slugify(spec.name);
  spec.description = String(message).trim().slice(0, 400);
  spec.icon = primary.blueprint.icon;
  spec.theme = { ...spec.theme, ...(primary.blueprint.theme || {}) };

  // 1. Entites issues du blueprint dominant.
  const blueprintEntities = [...(primary.blueprint.entities || [])];

  // 2. Un second domaine pertinent enrichit l'application sans la dupliquer.
  if (domains.length > 1 && domains[1].score >= 2) {
    for (const entity of domains[1].blueprint.entities || []) {
      const exists = blueprintEntities.some(
        (e) => pascal(e.label) === pascal(entity.label),
      );
      if (!exists) blueprintEntities.push(entity);
    }
    changes.push(change(
      'domain',
      `Domaines combines : ${primary.blueprint.label} et ${domains[1].blueprint.label}.`,
    ));
  }

  for (const entity of blueprintEntities) {
    spec.entities.push(normalizeEntity(entity));
  }

  // 3. Entites explicitement citees par l'utilisateur et absentes du blueprint.
  const mentioned = extractEntityNames(message);
  const addedFromUser = [];
  for (const raw of mentioned) {
    const name = cleanEntityCandidate(raw);
    if (!name) continue;
    if (findEntity(spec, name)) continue;
    if (duplicatesExistingEntity(spec, name)) continue;
    spec.entities.push(buildEntityFromName(name));
    addedFromUser.push(name);
    changes.push(change('entity', `Entite « ${capitalize(name)} » ajoutee d'apres votre description.`));
  }

  // Le domaine n'a pas ete reconnu mais l'utilisateur a nomme ses propres
  // entites : le modele generique de repli n'a plus lieu d'etre.
  if (primary.blueprint.id === 'generic' && addedFromUser.length) {
    spec.entities = spec.entities.filter((e) => e.name !== 'Element');
  }

  // 4. Champs explicitement demandes : rattaches a la premiere entite.
  const fields = extractFields(message);
  if (fields.length && spec.entities[0]) {
    const target = spec.entities[0];
    for (const field of fields) {
      if (findField(target, field.label)) continue;
      target.fields.push(normalizeField(field));
    }
    changes.push(change(
      'field',
      `${fields.length} champ(s) ajoute(s) a « ${target.label} » : ${fields.map((f) => f.label).join(', ')}.`,
    ));
  }

  // 5. Aucune entite reconnue : on garantit tout de meme une app fonctionnelle.
  if (!spec.entities.length) {
    spec.entities.push(normalizeEntity(GENERIC_ENTITY()));
  }

  // 6. Theme demande explicitement.
  const theme = extractTheme(message);
  if (Object.keys(theme).length) {
    Object.assign(spec.theme, theme);
    if (theme.primaryName) {
      changes.push(change('theme', `Couleur principale : ${theme.primaryName}.`));
    }
  }

  // 7. Vue explicitement reclamee ("avec un kanban").
  const view = extractViewType(message);
  if (view && view !== 'list' && spec.entities[0]) {
    const target = pickEntityForView(spec, view) || spec.entities[0];
    if (!target.views.includes(view)) {
      target.views.push(view);
      changes.push(change('page', `Vue ${view} activee sur « ${target.labelPlural} ».`));
    }
  }

  repairSpec(spec);
  // La normalisation est rejouee : les relations resolues peuvent changer les vues.
  spec.entities = spec.entities.map(normalizeEntity);
  rebuildPages(spec);

  changes.unshift(change(
    'app',
    `Application « ${spec.name} » creee avec ${spec.entities.length} entite(s) et ${spec.pages.length} page(s).`,
  ));

  return { spec, changes, domain: primary.blueprint };
}

/** Entite generique de repli. */
const GENERIC_ENTITY = () => ({
  label: 'Element',
  icon: 'layout',
  fields: [
    { label: 'Nom', type: 'text', required: true },
    { label: 'Description', type: 'longtext' },
    { label: 'Statut', type: 'select', options: ['Nouveau', 'En cours', 'Termine'] },
    { label: 'Date', type: 'date' },
  ],
});

/**
 * Mots qui ressemblent a des entites mais n'en sont pas
 * (evite de creer une table « Theme » ou « Interface »).
 */
const NOISE_WORDS = [
  'application', 'appli', 'app', 'theme', 'couleur', 'couleurs', 'interface', 'design',
  'page', 'pages', 'ecran', 'ecrans', 'bouton', 'menu', 'donnee', 'donnees', 'base',
  'systeme', 'outil', 'plateforme', 'site', 'logiciel', 'chose', 'truc', 'mode',
  'style', 'suivi', 'gestion', 'vue', 'vues', 'tableau', 'bord', 'partie', 'module',
  'fonctionnalite', 'fonctionnalites', 'option', 'options', 'exemple', 'exemples',
  // Verbes et mots de commande : ils introduisent la demande, pas la donnee.
  'ajoute', 'ajouter', 'ajoutes', 'cree', 'creer', 'crees', 'genere', 'generer',
  'construis', 'construire', 'fais', 'faire', 'met', 'mets', 'mettre', 'veux',
  'voudrais', 'aimerais', 'gere', 'gerer', 'suivre', 'nouveau', 'nouvelle',
  'add', 'create', 'make', 'build', 'want', 'manage', 'track', 'new',
  // Vocabulaire de modelisation.
  'table', 'tables', 'entite', 'entites', 'entity', 'model', 'modele', 'champ',
  'champs', 'colonne', 'colonnes', 'field', 'column',
];

function isNoiseEntity(name) {
  return cleanEntityCandidate(name) === null;
}

/**
 * Nettoie un candidat entite : retire les prefixes parasites et rejette les
 * noms qui ne designent aucun concept metier.
 *
 * « suivi des factures » -> « facture »  (dedoublonne ensuite avec Factures)
 * « gestion des stocks » -> « stock »    (entite legitime)
 * « tableau de bord »    -> null         (ce n'est pas une donnee)
 */
function cleanEntityCandidate(name) {
  let tokens = snake(name).split('_').filter(Boolean);
  if (!tokens.length) return null;

  // Retire les mots parasites en tete ("suivi", "gestion", "module"...).
  while (tokens.length && isNoiseToken(tokens[0])) {
    tokens = tokens.slice(1);
  }

  // Retire partout les qualificatifs qui decrivent l'apparence ou une vue :
  // « projet kanban » designe l'entite Projet, « theme vert » n'est pas une donnee.
  tokens = tokens.filter((t) => !isDescriptorToken(t));

  // Il ne reste que du bruit : ce n'est pas une entite.
  if (!tokens.length || tokens.every((t) => isNoiseToken(t))) return null;

  // Une entite se nomme au singulier ; le pluriel est derive ensuite.
  const last = tokens.length - 1;
  tokens[last] = singularize(tokens[last], 'fr');

  const cleaned = tokens.join(' ');
  if (cleaned.length < 3) return null;
  return capitalize(cleaned);
}

/** Un mot parasite, au singulier comme au pluriel. */
function isNoiseToken(token) {
  return NOISE_WORDS.includes(token) || NOISE_WORDS.includes(singularizeToken(token));
}

/** Couleur ou type de vue : decrit l'application, ne la structure pas. */
function isDescriptorToken(token) {
  const singular = singularizeToken(token);
  return Object.hasOwn(COLOR_WORDS, token) || Object.hasOwn(COLOR_WORDS, singular)
    || Object.hasOwn(VIEW_WORDS, token) || Object.hasOwn(VIEW_WORDS, singular);
}

/**
 * Le candidat designe-t-il un concept deja modelise ?
 * « suivi des factures » ne doit pas creer une table en plus de « Factures ».
 */
function duplicatesExistingEntity(spec, name) {
  const tokens = snake(name).split('_').filter((t) => t.length > 2 && !isNoiseToken(t));
  if (!tokens.length) return false;

  const concepts = tokens.map(canonical);

  return spec.entities.some((entity) => {
    const entityTokens = snake(entity.label).split('_').filter(Boolean);
    const entityConcepts = new Set(entityTokens.map(canonical));
    // Le concept porteur de l'entite ("conge") suffit a identifier un doublon,
    // meme si la formulation differe ("leave requests").
    const head = canonical(entityTokens[entityTokens.length - 1] || entity.label);

    return concepts.includes(head) || concepts.every((c) => entityConcepts.has(c));
  });
}

function singularizeToken(token) {
  return snake(singularize(token, 'fr'));
}

/**
 * Construit une entite plausible a partir de son seul nom, en devinant des
 * champs coherents (l'IA propose toujours une structure exploitable).
 */
export function buildEntityFromName(name) {
  const label = capitalize(name);
  const fields = [
    { label: 'Nom', type: 'text', required: true },
    { label: 'Description', type: 'longtext' },
    { label: 'Statut', type: 'select', options: ['Nouveau', 'En cours', 'Termine'] },
    { label: 'Date', type: 'date' },
  ];

  // Enrichissement contextuel selon la semantique du nom.
  const key = snake(label);
  if (/client|contact|personne|utilisateur|membre|patient|eleve|etudiant|employe|user|customer/.test(key)) {
    fields.splice(1, 0, { label: 'Email', type: 'email' }, { label: 'Telephone', type: 'phone' });
  }
  if (/produit|article|item|materiel|equipement|product/.test(key)) {
    fields.splice(1, 0, { label: 'Prix', type: 'currency' }, { label: 'Quantite', type: 'number' });
  }
  if (/facture|commande|devis|paiement|invoice|order|payment/.test(key)) {
    fields.splice(1, 0, { label: 'Montant', type: 'currency' }, { label: 'Reference', type: 'text' });
  }

  return normalizeEntity({ label, icon: 'database', fields });
}

/**
 * Retrouve l'entite designee par une phrase.
 *
 * « ajoute une vue kanban sur les factures » doit cibler Factures, meme si la
 * tournure ne correspond a aucun motif d'enumeration.
 */
function resolveEntityFromMessage(spec, message) {
  const tokens = snake(message).split('_').filter(Boolean);
  if (!tokens.length) return null;

  const concepts = new Set(tokens.map(canonical));

  // 1. Correspondance directe sur le libelle ou son pluriel.
  for (const entity of spec.entities) {
    const labels = [snake(entity.label), snake(entity.labelPlural), snake(entity.name)];
    for (const label of labels) {
      const parts = label.split('_').filter(Boolean);
      if (parts.every((p) => tokens.includes(p))) return entity;
    }
  }

  // 2. Correspondance conceptuelle (singulier/pluriel, FR/EN).
  for (const entity of spec.entities) {
    if (concepts.has(canonical(entity.label))) return entity;
  }

  return null;
}

/** Choisit l'entite la plus adaptee a une vue donnee. */
function pickEntityForView(spec, view) {
  if (view === 'kanban') {
    return spec.entities.find((e) => e.fields.some((f) => f.type === 'select')) || null;
  }
  if (view === 'calendar') {
    return spec.entities.find((e) => e.fields.some((f) => f.type === 'date' || f.type === 'datetime')) || null;
  }
  return null;
}

/** Ajoute une entite a une application existante. */
export function planAddEntity(spec, message) {
  const changes = [];
  const names = extractEntityNames(message);
  const explicitFields = extractFields(message);

  // Repli : le dernier substantif significatif de la phrase.
  let targets = names.map(cleanEntityCandidate).filter(Boolean);
  if (!targets.length) {
    const guess = guessEntityName(message);
    if (guess) targets = [guess];
  }

  if (!targets.length) {
    return {
      spec,
      changes,
      error: "Je n'ai pas identifie le nom de l'entite a creer. Precisez par exemple : « ajoute une table Fournisseurs ».",
    };
  }

  for (const name of targets) {
    if (findEntity(spec, name)) {
      changes.push(change('noop', `L'entite « ${capitalize(name)} » existe deja.`));
      continue;
    }
    const entity = buildEntityFromName(name);
    if (explicitFields.length) {
      entity.fields = explicitFields.map(normalizeField);
      // Un champ titre reste indispensable.
      if (!entity.fields.some((f) => f.type === 'text')) {
        entity.fields.unshift(normalizeField({ label: 'Nom', type: 'text', required: true }));
      }
    }
    spec.entities.push(normalizeEntity(entity));
    changes.push(change('entity', `Entite « ${entity.label} » creee avec ${entity.fields.length} champs.`));
  }

  finalize(spec);
  return { spec, changes };
}

/** Devine un nom d'entite quand aucun motif explicite ne matche. */
function guessEntityName(message) {
  const names = extractEntityNames(`gerer ${message}`);
  for (const name of names) {
    const cleaned = cleanEntityCandidate(name);
    if (cleaned) return cleaned;
  }
  return null;
}

/** Ajoute un ou plusieurs champs a une entite. */
export function planAddField(spec, message) {
  const changes = [];
  const fields = extractFields(message);

  // Entite ciblee : nommee dans la phrase, sinon la premiere.
  let target = resolveEntityFromMessage(spec, message);
  if (!target) {
    for (const name of extractEntityNames(message)) {
      target = findEntity(spec, name);
      if (target) break;
    }
  }
  if (!target) target = spec.entities[0];

  if (!target) {
    return { spec, changes, error: "Aucune entite n'existe encore dans cette application." };
  }

  let list = fields;
  if (!list.length) {
    // "ajoute un champ telephone" sans le mot "champs:" -> on extrait la cible.
    const guess = extractTarget(message);
    if (guess) {
      const type = inferFieldType(guess);
      const field = { label: guess, type };
      if (type === 'select') field.options = suggestOptions(guess);
      list = [field];
    }
  }

  if (!list.length) {
    return {
      spec,
      changes,
      error: "Je n'ai pas compris quel champ ajouter. Essayez : « ajoute les champs email et telephone a Clients ».",
    };
  }

  for (const field of list) {
    if (findField(target, field.label)) {
      changes.push(change('noop', `Le champ « ${field.label} » existe deja sur ${target.label}.`));
      continue;
    }
    target.fields.push(normalizeField(field));
    changes.push(change('field', `Champ « ${field.label} » (${field.type}) ajoute a ${target.label}.`));
  }

  finalize(spec);
  return { spec, changes };
}

/** Active une vue supplementaire (kanban, calendrier, galerie...). */
export function planAddPage(spec, message) {
  const changes = [];
  const view = extractViewType(message) || 'list';

  let target = resolveEntityFromMessage(spec, message);
  if (!target) {
    for (const name of extractEntityNames(message)) {
      target = findEntity(spec, name);
      if (target) break;
    }
  }
  if (!target) target = pickEntityForView(spec, view) || spec.entities[0];

  if (!target) {
    return { spec, changes, error: "Aucune entite disponible pour creer une page." };
  }

  if (view === 'kanban' && !target.display.statusField) {
    // L'IA cree ce qui manque plutot que d'echouer.
    target.fields.push(normalizeField({
      label: 'Statut',
      type: 'select',
      options: ['A faire', 'En cours', 'Termine'],
    }));
    changes.push(change('field', `Champ « Statut » ajoute a ${target.label} pour permettre la vue kanban.`));
  }
  if (view === 'calendar' && !target.display.dateField) {
    target.fields.push(normalizeField({ label: 'Date', type: 'date' }));
    changes.push(change('field', `Champ « Date » ajoute a ${target.label} pour permettre la vue calendrier.`));
  }

  if (!target.views.includes(view)) {
    target.views.push(view);
    changes.push(change('page', `Vue ${view} activee sur « ${target.labelPlural} ».`));
  } else {
    changes.push(change('noop', `La vue ${view} est deja active sur « ${target.labelPlural} ».`));
  }

  finalize(spec);
  return { spec, changes };
}

/** Supprime une entite ou un champ. */
export function planRemove(spec, message) {
  const changes = [];
  const target = extractTarget(message);
  if (!target) {
    return { spec, changes, error: "Precisez ce qu'il faut supprimer (ex. « supprime le champ telephone »)." };
  }

  // 1. Entite ?
  const entity = findEntity(spec, target);
  const looksLikeEntity = /\b(entite|table|entity|model|modele)\b/i.test(message);
  if (entity && (looksLikeEntity || !anyFieldNamed(spec, target))) {
    spec.entities = spec.entities.filter((e) => e.name !== entity.name);
    // Les relations pointant vers elle sont nettoyees par repairSpec.
    changes.push(change('entity', `Entite « ${entity.label} » supprimee.`));
    finalize(spec);
    return { spec, changes };
  }

  // 2. Champ ?
  for (const ent of spec.entities) {
    const field = findField(ent, target);
    if (field) {
      ent.fields = ent.fields.filter((f) => f.name !== field.name);
      // Le champ-titre disparu doit etre recalcule.
      if (ent.display.titleField === field.name) ent.display.titleField = null;
      if (ent.display.statusField === field.name) ent.display.statusField = null;
      if (ent.display.dateField === field.name) ent.display.dateField = null;
      changes.push(change('field', `Champ « ${field.label} » retire de ${ent.label}.`));
      finalize(spec);
      return { spec, changes };
    }
  }

  return { spec, changes, error: `Je n'ai pas trouve « ${target} » dans cette application.` };
}

function anyFieldNamed(spec, needle) {
  return spec.entities.some((e) => findField(e, needle));
}

/** Renomme l'application, une entite ou un champ. */
export function planRename(spec, message) {
  const changes = [];
  const pair = extractRenameTarget(message);
  if (!pair) {
    return { spec, changes, error: "Formulez le renommage ainsi : « renomme Clients en Adherents »." };
  }

  const entity = findEntity(spec, pair.from);
  if (entity) {
    entity.label = capitalize(pair.to);
    entity.name = pascal(pair.to);
    entity.labelPlural = pluralize(entity.label, 'fr');
    changes.push(change('entity', `Entite renommee en « ${entity.label} ».`));
    finalize(spec);
    return { spec, changes };
  }

  for (const ent of spec.entities) {
    const field = findField(ent, pair.from);
    if (field) {
      const oldName = field.name;
      field.label = capitalize(pair.to);
      field.name = snake(pair.to);
      for (const key of ['titleField', 'statusField', 'dateField']) {
        if (ent.display[key] === oldName) ent.display[key] = field.name;
      }
      changes.push(change('field', `Champ renomme en « ${field.label} » sur ${ent.label}.`));
      finalize(spec);
      return { spec, changes };
    }
  }

  // Sinon : on considere qu'il s'agit du nom de l'application.
  spec.name = capitalize(pair.to);
  spec.slug = slugify(spec.name);
  changes.push(change('app', `Application renommee en « ${spec.name} ».`));
  finalize(spec);
  return { spec, changes };
}

/** Modifie le theme visuel. */
export function planSetTheme(spec, message) {
  const changes = [];
  const theme = extractTheme(message);

  if (!Object.keys(theme).length) {
    return {
      spec,
      changes,
      error: "Precisez une couleur ou un mode (ex. « passe le theme en vert et en mode sombre »).",
    };
  }

  Object.assign(spec.theme, theme);
  if (theme.primary) changes.push(change('theme', `Couleur principale mise a jour (${theme.primary}).`));
  if (theme.mode) changes.push(change('theme', `Mode d'affichage : ${theme.mode === 'dark' ? 'sombre' : 'clair'}.`));
  if (theme.radius) changes.push(change('theme', `Arrondi des composants : ${theme.radius}px.`));

  spec.updatedAt = new Date().toISOString();
  return { spec, changes };
}

/** Recalcule pages, widgets et coherence apres une mutation. */
function finalize(spec) {
  repairSpec(spec);
  spec.entities = spec.entities.map(normalizeEntity);
  rebuildPages(spec);
  const dashboard = spec.pages.find((p) => p.type === 'dashboard');
  if (dashboard) dashboard.widgets = buildDashboardWidgets(spec);
  spec.updatedAt = new Date().toISOString();
  return spec;
}

export { finalize };
