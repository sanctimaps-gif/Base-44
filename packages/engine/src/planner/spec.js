/**
 * AppSpec — representation canonique d'une application Base 44.
 *
 * C'est le format pivot : l'IA produit un AppSpec, le runtime web le rend a
 * l'ecran, et les synthetiseurs le transforment en code source exportable.
 */

import { snake, slugify, pascal, pluralize, capitalize } from '../util/text.js';
import { inferFieldType, suggestOptions, titleScore } from '../knowledge/fieldTypes.js';

export const SPEC_VERSION = 1;

/** Cree un AppSpec vide et valide. */
export function createSpec(overrides = {}) {
  const now = new Date().toISOString();
  return {
    specVersion: SPEC_VERSION,
    name: 'Nouvelle application',
    slug: 'nouvelle-application',
    description: '',
    icon: 'layout',
    domain: 'generic',
    theme: {
      mode: 'light',
      primary: '#2563eb',
      radius: 10,
      font: 'Inter',
    },
    entities: [],
    pages: [],
    roles: [
      { name: 'admin', label: 'Administrateur', permissions: ['read', 'create', 'update', 'delete'] },
      { name: 'member', label: 'Membre', permissions: ['read', 'create', 'update'] },
      { name: 'viewer', label: 'Lecteur', permissions: ['read'] },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Normalise un champ : garantit `name`, `type`, `options` coherents.
 */
export function normalizeField(input) {
  const label = capitalize(String(input.label || input.name || 'Champ').trim());
  const type = input.type || inferFieldType(label);
  const field = {
    name: input.name ? snake(input.name) : snake(label),
    label,
    type,
    required: Boolean(input.required),
    unique: Boolean(input.unique),
  };
  if (input.help) field.help = input.help;
  if (type === 'select' || type === 'multiselect') {
    field.options = Array.isArray(input.options) && input.options.length
      ? input.options.map(String)
      : suggestOptions(label);
  }
  if (type === 'relation') {
    field.ref = input.ref ? pascal(input.ref) : null;
  }
  return field;
}

/** Normalise une entite : nom, pluriel, champs, champ-titre. */
export function normalizeEntity(input) {
  const label = capitalize(String(input.label || input.name || 'Element').trim());
  const fields = (input.fields || []).map(normalizeField);

  // Un identifiant technique stable est indispensable au stockage.
  const name = input.name ? pascal(input.name) : pascal(label);

  const entity = {
    name,
    label,
    labelPlural: input.labelPlural || pluralize(label, 'fr'),
    icon: input.icon || 'database',
    fields,
    views: Array.isArray(input.views) && input.views.length ? [...input.views] : ['list'],
    display: input.display || {},
  };

  // Choix automatique du champ servant de titre dans les listes.
  if (!entity.display.titleField) {
    let best = null;
    let bestScore = -1;
    for (const field of fields) {
      const score = titleScore(field);
      if (score > bestScore) {
        bestScore = score;
        best = field;
      }
    }
    entity.display.titleField = best?.name || fields[0]?.name || null;
  }

  // Champ de statut : pilote la vue kanban et les badges de couleur.
  if (!entity.display.statusField) {
    const status = fields.find((f) => f.type === 'select');
    entity.display.statusField = status?.name || null;
  }

  // Champ de date : pilote la vue calendrier.
  if (!entity.display.dateField) {
    const date = fields.find((f) => f.type === 'date' || f.type === 'datetime');
    entity.display.dateField = date?.name || null;
  }

  // Le kanban n'a de sens qu'avec un champ de statut.
  if (entity.views.includes('kanban') && !entity.display.statusField) {
    entity.views = entity.views.filter((v) => v !== 'kanban');
  }
  // Idem pour le calendrier.
  if (entity.views.includes('calendar') && !entity.display.dateField) {
    entity.views = entity.views.filter((v) => v !== 'calendar');
  }
  if (!entity.views.length) entity.views = ['list'];

  return entity;
}

/** Intitules et icones des types de vue. */
const VIEW_META = {
  list: { label: 'Liste', icon: 'list' },
  kanban: { label: 'Kanban', icon: 'columns' },
  calendar: { label: 'Calendrier', icon: 'calendar' },
  gallery: { label: 'Galerie', icon: 'grid' },
  detail: { label: 'Fiche', icon: 'file-text' },
  form: { label: 'Formulaire', icon: 'edit' },
};

/**
 * Cree une page liee a une entite.
 * Toutes les vues sont navigables : une vue kanban generee mais absente du
 * menu serait inatteignable pour l'utilisateur.
 */
export function createEntityPage(entity, type = 'list') {
  const meta = VIEW_META[type] || { label: type, icon: entity.icon };

  return {
    id: `${slugify(entity.label)}-${type}`,
    name: type === 'list' ? entity.labelPlural : `${entity.labelPlural} · ${meta.label}`,
    path: `/${slugify(entity.labelPlural)}${type === 'list' ? '' : `/${type}`}`,
    type,
    entity: entity.name,
    icon: type === 'list' ? entity.icon : meta.icon,
    showInNav: true,
  };
}

/** Cree la page tableau de bord d'une application. */
export function createDashboardPage(spec) {
  return {
    id: 'dashboard',
    name: 'Tableau de bord',
    path: '/',
    type: 'dashboard',
    entity: null,
    icon: 'home',
    showInNav: true,
    widgets: buildDashboardWidgets(spec),
  };
}

/** Deduit des indicateurs pertinents a partir des entites du spec. */
export function buildDashboardWidgets(spec) {
  const widgets = [];

  for (const entity of spec.entities.slice(0, 4)) {
    widgets.push({
      id: `count-${entity.name}`,
      type: 'stat',
      title: `Total ${entity.labelPlural.toLowerCase()}`,
      entity: entity.name,
      metric: 'count',
      icon: entity.icon,
    });
  }

  // Somme sur le premier champ monetaire rencontre.
  for (const entity of spec.entities) {
    const money = entity.fields.find((f) => f.type === 'currency');
    if (money) {
      widgets.push({
        id: `sum-${entity.name}-${money.name}`,
        type: 'stat',
        title: `${money.label} cumule`,
        entity: entity.name,
        metric: 'sum',
        field: money.name,
        icon: 'trending-up',
      });
      break;
    }
  }

  // Repartition par statut : un graphe par entite disposant d'un select.
  for (const entity of spec.entities) {
    if (entity.display.statusField) {
      widgets.push({
        id: `breakdown-${entity.name}`,
        type: 'breakdown',
        title: `${entity.labelPlural} par statut`,
        entity: entity.name,
        field: entity.display.statusField,
      });
      break;
    }
  }

  // Derniers enregistrements de la premiere entite.
  if (spec.entities[0]) {
    widgets.push({
      id: `recent-${spec.entities[0].name}`,
      type: 'recent',
      title: `${spec.entities[0].labelPlural} recents`,
      entity: spec.entities[0].name,
      limit: 5,
    });
  }

  return widgets;
}

/**
 * Reconstruit entierement les pages a partir des entites.
 * Appele apres toute mutation structurelle du spec.
 */
export function rebuildPages(spec) {
  const custom = spec.pages.filter((p) => p.custom);
  const pages = [createDashboardPage(spec)];

  for (const entity of spec.entities) {
    pages.push(createEntityPage(entity, 'list'));
    for (const view of entity.views) {
      if (view === 'list') continue;
      pages.push(createEntityPage(entity, view));
    }
  }

  spec.pages = [...pages, ...custom];
  return spec;
}

/** Recherche une entite par nom, label ou pluriel (tolerant). */
export function findEntity(spec, needle) {
  if (!needle) return null;
  const key = snake(needle);
  return spec.entities.find((e) => snake(e.name) === key
    || snake(e.label) === key
    || snake(e.labelPlural) === key) || null;
}

/** Recherche un champ dans une entite. */
export function findField(entity, needle) {
  if (!entity || !needle) return null;
  const key = snake(needle);
  return entity.fields.find((f) => f.name === key || snake(f.label) === key) || null;
}

/**
 * Valide un spec et retourne la liste des problemes detectes.
 * Le moteur s'en sert pour s'auto-corriger avant de repondre.
 */
export function validateSpec(spec) {
  const issues = [];

  if (!spec || typeof spec !== 'object') {
    return [{ level: 'error', message: 'Spec absent ou invalide.' }];
  }
  if (!spec.name) issues.push({ level: 'error', message: "L'application n'a pas de nom." });
  if (!Array.isArray(spec.entities)) {
    issues.push({ level: 'error', message: 'La liste des entites est invalide.' });
    return issues;
  }

  const names = new Set();
  for (const entity of spec.entities) {
    if (names.has(entity.name)) {
      issues.push({ level: 'error', message: `Entite dupliquee : ${entity.name}.` });
    }
    names.add(entity.name);

    if (!entity.fields?.length) {
      issues.push({ level: 'warn', message: `L'entite ${entity.label} n'a aucun champ.` });
    }

    const fieldNames = new Set();
    for (const field of entity.fields || []) {
      if (fieldNames.has(field.name)) {
        issues.push({
          level: 'warn',
          message: `Champ duplique ${field.label} dans ${entity.label}.`,
        });
      }
      fieldNames.add(field.name);

      if (field.type === 'relation' && field.ref && !spec.entities.some((e) => e.name === field.ref)) {
        issues.push({
          level: 'warn',
          message: `La relation ${entity.label}.${field.label} pointe vers une entite absente (${field.ref}).`,
        });
      }
    }
  }

  return issues;
}

/**
 * Corrige automatiquement les problemes reparables (relations orphelines,
 * doublons de champs, vues incoherentes).
 */
export function repairSpec(spec) {
  const entityNames = new Set(spec.entities.map((e) => e.name));

  for (const entity of spec.entities) {
    // Deduplication des champs.
    const seen = new Set();
    entity.fields = entity.fields.filter((field) => {
      if (seen.has(field.name)) return false;
      seen.add(field.name);
      return true;
    });

    // Une relation orpheline redevient un simple champ texte.
    for (const field of entity.fields) {
      if (field.type === 'relation' && (!field.ref || !entityNames.has(field.ref))) {
        field.type = 'text';
        delete field.ref;
      }
    }
  }

  // Deduplication des entites (la premiere gagne).
  const seenEntities = new Set();
  spec.entities = spec.entities.filter((entity) => {
    if (seenEntities.has(entity.name)) return false;
    seenEntities.add(entity.name);
    return true;
  });

  return spec;
}
