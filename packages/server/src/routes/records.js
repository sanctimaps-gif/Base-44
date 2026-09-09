/**
 * CRUD sur les donnees d'une application generee.
 *
 * Les regles de validation sont derivees du spec : chaque application generee
 * obtient donc une API reellement typee, sans code specifique.
 */

import { Router } from 'express';
import { coerceRecord, checkUnique } from '@base44/engine';
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
