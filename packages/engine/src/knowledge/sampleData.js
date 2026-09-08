/**
 * Generateur de donnees d'exemple.
 *
 * Une application vide est difficile a juger : l'IA peuple donc chaque entite
 * avec des enregistrements plausibles et coherents entre eux (les relations
 * pointent vers des enregistrements reellement existants).
 */

import { deaccent } from '../util/text.js';

const FIRST_NAMES = [
  'Camille', 'Lucas', 'Amina', 'Nathan', 'Sofia', 'Hugo', 'Chloe', 'Youssef',
  'Emma', 'Gabriel', 'Ines', 'Adam', 'Lea', 'Mehdi', 'Jade', 'Theo',
];

const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Moreau', 'Petit', 'Durand', 'Leroy', 'Roux',
  'Benali', 'Fournier', 'Girard', 'Lambert', 'Mercier', 'Blanc', 'Faure', 'Rossi',
];

const COMPANIES = [
  'Atelier Nord', 'Groupe Solaris', 'Maison Verte', 'Studio Kova', 'Cap Horizon',
  'Delta Services', 'Eclat Digital', 'Forge & Co', 'Helios Conseil', 'Novaterra',
];

const CITIES = [
  'Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Nantes', 'Toulouse', 'Rennes',
];

const WORDS = [
  'projet', 'dossier', 'operation', 'mission', 'lot', 'campagne', 'edition',
  'programme', 'chantier', 'serie',
];

const ADJECTIVES = [
  'prioritaire', 'annuel', 'pilote', 'special', 'standard', 'express', 'renforce',
];

const SENTENCES = [
  'Suivi regulier a assurer avec le referent.',
  'Dossier complet, en attente de validation finale.',
  'Retour positif lors du dernier point d etape.',
  'Quelques ajustements restent a planifier.',
  'Priorite confirmee pour le trimestre en cours.',
  'Historique disponible dans les archives internes.',
];

/**
 * Generateur pseudo-aleatoire deterministe (Mulberry32).
 * Une meme graine produit toujours le meme jeu de donnees : les previsualisations
 * restent stables entre deux rendus.
 */
function makeRandom(seed = 42) {
  let a = seed >>> 0;
  return function random() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const intBetween = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;

/** Date aleatoire autour d'aujourd'hui, en ISO. */
function randomDate(rng, spreadDays = 60, withTime = false) {
  const offset = intBetween(rng, -spreadDays, spreadDays);
  const date = new Date();
  date.setDate(date.getDate() + offset);
  if (withTime) {
    date.setHours(intBetween(rng, 8, 19), pick(rng, [0, 15, 30, 45]), 0, 0);
    return date.toISOString();
  }
  return date.toISOString().slice(0, 10);
}

/** Produit une valeur plausible pour un champ donne. */
function valueForField(field, rng, context) {
  const label = deaccent(field.label || field.name || '');

  switch (field.type) {
    case 'email': {
      const first = deaccent(context.firstName || pick(rng, FIRST_NAMES));
      const last = deaccent(context.lastName || pick(rng, LAST_NAMES));
      return `${first}.${last}@example.com`.replace(/\s+/g, '');
    }
    case 'phone':
      return `0${intBetween(rng, 6, 7)} ${intBetween(rng, 10, 99)} ${intBetween(rng, 10, 99)} ${intBetween(rng, 10, 99)} ${intBetween(rng, 10, 99)}`;
    case 'url':
      return `https://www.${deaccent(pick(rng, COMPANIES)).replace(/[^a-z]/g, '')}.example`;
    case 'longtext':
      return pick(rng, SENTENCES);
    case 'number': {
      if (/age/.test(label)) return intBetween(rng, 18, 65);
      if (/duree|duration/.test(label)) return pick(rng, [15, 30, 45, 60, 90, 120]);
      if (/stock|quantite|quantity/.test(label)) return intBetween(rng, 0, 250);
      if (/surface/.test(label)) return intBetween(rng, 25, 180);
      if (/piece|room/.test(label)) return intBetween(rng, 1, 6);
      if (/calorie/.test(label)) return intBetween(rng, 120, 900);
      if (/note|grade/.test(label)) return intBetween(rng, 5, 20);
      return intBetween(rng, 1, 100);
    }
    case 'currency': {
      if (/salaire|salary/.test(label)) return intBetween(rng, 28, 75) * 1000;
      if (/prix|price|tarif/.test(label)) return Number((rng() * 400 + 9).toFixed(2));
      return Number((rng() * 5000 + 100).toFixed(2));
    }
    case 'percent':
      return intBetween(rng, 0, 100);
    case 'rating':
      return intBetween(rng, 1, 5);
    case 'boolean':
      return rng() > 0.45;
    case 'date':
      return randomDate(rng, 60, false);
    case 'datetime':
      return randomDate(rng, 30, true);
    case 'select':
      return field.options?.length ? pick(rng, field.options) : '';
    case 'multiselect': {
      if (!field.options?.length) return [];
      const count = intBetween(rng, 1, Math.min(2, field.options.length));
      const shuffled = [...field.options].sort(() => rng() - 0.5);
      return shuffled.slice(0, count);
    }
    case 'color':
      return pick(rng, ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed']);
    case 'image':
    case 'file':
      return '';
    case 'json':
      return {};
    case 'relation':
      return context.relationValue ?? '';
    default: {
      // Champs texte : on s'appuie sur la semantique de l'intitule.
      if (/prenom|first ?name/.test(label)) return context.firstName;
      if (/^nom$|last ?name|nom de famille/.test(label)) return context.lastName;
      if (/nom|name|titre|title|intitule|libelle|sujet|subject/.test(label)) return context.title;
      if (/societe|company|entreprise|organisation/.test(label)) return context.company;
      if (/ville|city/.test(label)) return pick(rng, CITIES);
      if (/adresse|address/.test(label)) return `${intBetween(rng, 1, 120)} rue des ${pick(rng, WORDS)}s, ${pick(rng, CITIES)}`;
      if (/reference|numero|number|code|sku|isbn|siret/.test(label)) {
        return `${deaccent(context.entityLabel).slice(0, 3).toUpperCase()}-${String(intBetween(rng, 1000, 9999))}`;
      }
      if (/auteur|author|assigne|responsable|owner|emprunteur|demandeur|visiteur|enseignant|professeur/.test(label)) {
        return `${context.firstName} ${context.lastName}`;
      }
      if (/poste|role|fonction|job/.test(label)) {
        return pick(rng, ['Charge de projet', 'Developpeur', 'Commercial', 'Designer', 'Manager']);
      }
      if (/lieu|salle|place|location/.test(label)) return `Salle ${pick(rng, ['A', 'B', 'C'])} — ${pick(rng, CITIES)}`;
      return context.title;
    }
  }
}

/**
 * Genere des enregistrements pour toutes les entites d'un spec.
 * @returns {Record<string, object[]>} enregistrements indexes par nom d'entite
 */
export function generateSampleData(spec, { perEntity = 8, seed = 1337 } = {}) {
  const rng = makeRandom(seed);
  const data = {};

  // Premiere passe : creation des enregistrements sans les relations.
  for (const entity of spec.entities) {
    const rows = [];
    for (let i = 0; i < perEntity; i += 1) {
      const firstName = pick(rng, FIRST_NAMES);
      const lastName = pick(rng, LAST_NAMES);
      const company = pick(rng, COMPANIES);

      const isPerson = /client|contact|personne|employe|salarie|etudiant|eleve|patient|membre|utilisateur|auteur|participant|user|customer/
        .test(deaccent(entity.label));

      const title = isPerson
        ? `${firstName} ${lastName}`
        : `${capitalizeWord(pick(rng, WORDS))} ${capitalizeWord(pick(rng, ADJECTIVES))} ${i + 1}`;

      const context = {
        firstName, lastName, company, title, entityLabel: entity.label,
      };

      const record = {
        id: `${deaccent(entity.name).toLowerCase()}_${i + 1}`,
        createdAt: randomDate(rng, 90, true),
      };
      for (const field of entity.fields) {
        if (field.type === 'relation') continue;
        record[field.name] = valueForField(field, rng, context);
      }
      rows.push(record);
    }
    data[entity.name] = rows;
  }

  // Seconde passe : resolution des relations vers des ids reellement crees.
  for (const entity of spec.entities) {
    const relations = entity.fields.filter((f) => f.type === 'relation' && f.ref);
    if (!relations.length) continue;

    for (const record of data[entity.name]) {
      for (const field of relations) {
        const targets = data[field.ref];
        record[field.name] = targets?.length ? pick(rng, targets).id : '';
      }
    }
  }

  return data;
}

function capitalizeWord(word = '') {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
