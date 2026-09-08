/**
 * CRUD sur les donnees d'une application generee.
 *
 * Les regles de validation sont derivees du spec : chaque application generee
 * obtient donc une API reellement typee, sans code specifique.
 */

import { Router } from 'express';
import { store } from '../store.js';

export const recordsRouter = Router();

/** Charge l'application et l'entite ciblee, ou repond 404. */
async function resolveEntity(req, res) {
  const app = await store.getApp(req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Application introuvable.' });
    return null;
  }
  const entity = app.spec.entities.find((e) => e.name === req.params.entity);
  if (!entity) {
    res.status(404).json({ error: `Entite « ${req.params.entity} » introuvable.` });
    return null;
  }
  return { app, entity };
}

/**
 * Valide et normalise un enregistrement d'apres le spec de l'entite.
 * @returns {{values: object, errors: string[]}}
 */
export function coerceRecord(entity, body = {}, { partial = false } = {}) {
  const values = {};
  const errors = [];

  for (const field of entity.fields) {
    // Champ absent : en creation il peut manquer a l'appel, en mise a jour
    // partielle son absence signifie simplement « ne pas toucher ».
    if (!Object.hasOwn(body, field.name)) {
      if (!partial && field.required) errors.push(`${field.label} est obligatoire.`);
      continue;
    }

    const raw = body[field.name];
    const empty = raw === null || raw === undefined || raw === '';

    if (empty) {
      if (field.required && !partial) errors.push(`${field.label} est obligatoire.`);
      values[field.name] = field.type === 'multiselect' ? [] : '';
      continue;
    }

    switch (field.type) {
      case 'number':
      case 'currency':
      case 'percent':
      case 'rating': {
        const num = Number(raw);
        if (Number.isNaN(num)) {
          errors.push(`${field.label} doit etre un nombre.`);
        } else {
          values[field.name] = num;
        }
        break;
      }

      case 'boolean':
        values[field.name] = raw === true || raw === 'true' || raw === 1 || raw === '1';
        break;

      case 'select':
        if (field.options?.length && !field.options.includes(String(raw))) {
          errors.push(`${field.label} : « ${raw} » n'est pas une valeur autorisee.`);
        } else {
          values[field.name] = String(raw);
        }
        break;

      case 'multiselect': {
        const list = Array.isArray(raw) ? raw.map(String) : [String(raw)];
        const invalid = field.options?.length
          ? list.filter((v) => !field.options.includes(v))
          : [];
        if (invalid.length) {
          errors.push(`${field.label} : valeurs non autorisees (${invalid.join(', ')}).`);
        } else {
          values[field.name] = list;
        }
        break;
      }

      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw))) {
          errors.push(`${field.label} : adresse e-mail invalide.`);
        } else {
          values[field.name] = String(raw);
        }
        break;

      case 'date':
      case 'datetime':
        if (Number.isNaN(Date.parse(String(raw)))) {
          errors.push(`${field.label} : date invalide.`);
        } else {
          values[field.name] = String(raw);
        }
        break;

      case 'json':
        if (typeof raw === 'object') {
          values[field.name] = raw;
        } else {
          try {
            values[field.name] = JSON.parse(String(raw));
          } catch {
            errors.push(`${field.label} : JSON invalide.`);
          }
        }
        break;

      default:
        values[field.name] = String(raw);
    }
  }

  return { values, errors };
}

/** Verifie les contraintes d'unicite declarees dans le spec. */
function checkUnique(entity, rows, values, ignoreId = null) {
  const errors = [];
  for (const field of entity.fields.filter((f) => f.unique)) {
    const value = values[field.name];
    if (value === undefined || value === '') continue;
    const clash = rows.some((r) => r.id !== ignoreId && r[field.name] === value);
    if (clash) errors.push(`${field.label} doit etre unique (« ${value} » existe deja).`);
  }
  return errors;
}

recordsRouter.get('/:id/entities/:entity/records', async (req, res, next) => {
  try {
    const resolved = await resolveEntity(req, res);
    if (!resolved) return;

    let rows = await store.listRecords(req.params.id, resolved.entity.name);

    // Recherche plein texte simple sur les champs textuels.
    const search = String(req.query.q || '').trim().toLowerCase();
    if (search) {
      rows = rows.filter((row) => Object.values(row).some(
        (v) => String(v ?? '').toLowerCase().includes(search),
      ));
    }

    // Filtre par valeur exacte : ?field=statut&value=Actif
    const { field, value } = req.query;
    if (field && value !== undefined) {
      rows = rows.filter((row) => String(row[field] ?? '') === String(value));
    }

    // Tri
    const sort = String(req.query.sort || '');
    if (sort) {
      const desc = sort.startsWith('-');
      const key = desc ? sort.slice(1) : sort;
      rows = [...rows].sort((a, b) => {
        const av = a[key] ?? '';
        const bv = b[key] ?? '';
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'fr');
        return desc ? -cmp : cmp;
      });
    }

    res.json(rows);
  } catch (error) { next(error); }
});

recordsRouter.post('/:id/entities/:entity/records', async (req, res, next) => {
  try {
    const resolved = await resolveEntity(req, res);
    if (!resolved) return;
    const { entity } = resolved;

    const { values, errors } = coerceRecord(entity, req.body);
    const rows = await store.listRecords(req.params.id, entity.name);
    const uniqueErrors = checkUnique(entity, rows, values);
    const all = [...errors, ...uniqueErrors];

    if (all.length) return res.status(400).json({ error: 'Validation echouee.', details: all });

    const record = await store.createRecord(req.params.id, entity.name, values);
    res.status(201).json(record);
  } catch (error) { next(error); }
});

recordsRouter.put('/:id/entities/:entity/records/:recordId', async (req, res, next) => {
  try {
    const resolved = await resolveEntity(req, res);
    if (!resolved) return;
    const { entity } = resolved;

    const { values, errors } = coerceRecord(entity, req.body, { partial: true });
    const rows = await store.listRecords(req.params.id, entity.name);
    const uniqueErrors = checkUnique(entity, rows, values, req.params.recordId);
    const all = [...errors, ...uniqueErrors];

    if (all.length) return res.status(400).json({ error: 'Validation echouee.', details: all });

    const record = await store.updateRecord(req.params.id, entity.name, req.params.recordId, values);
    if (!record) return res.status(404).json({ error: 'Enregistrement introuvable.' });
    res.json(record);
  } catch (error) { next(error); }
});

recordsRouter.delete('/:id/entities/:entity/records/:recordId', async (req, res, next) => {
  try {
    const resolved = await resolveEntity(req, res);
    if (!resolved) return;

    const ok = await store.deleteRecord(req.params.id, resolved.entity.name, req.params.recordId);
    if (!ok) return res.status(404).json({ error: 'Enregistrement introuvable.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

/** Toutes les donnees de l'application, pour le rendu du tableau de bord. */
recordsRouter.get('/:id/data', async (req, res, next) => {
  try {
    const app = await store.getApp(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application introuvable.' });
    res.json(await store.getRecords(req.params.id));
  } catch (error) { next(error); }
});
