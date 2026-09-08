/** Routes de gestion des applications. */

import { Router } from 'express';
import { createEngine, generateSampleData, validateSpec } from '@base44/engine';
import { store } from '../store.js';

export const appsRouter = Router();

/** Vue allegee pour les listes (le spec complet est inutile ici). */
function summarize(app) {
  return {
    id: app.id,
    name: app.spec?.name || app.name,
    description: app.spec?.description || '',
    icon: app.spec?.icon || 'layout',
    theme: app.spec?.theme,
    domain: app.spec?.domain,
    entityCount: app.spec?.entities?.length || 0,
    pageCount: app.spec?.pages?.length || 0,
    published: Boolean(app.published),
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

appsRouter.get('/', async (req, res, next) => {
  try {
    const apps = await store.listApps();
    res.json(apps.map(summarize));
  } catch (error) { next(error); }
});

appsRouter.get('/:id', async (req, res, next) => {
  try {
    const app = await store.getApp(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application introuvable.' });
    res.json(app);
  } catch (error) { next(error); }
});

/**
 * Cree une application.
 * Avec un `prompt`, le moteur genere le spec ; sinon on part d'un spec fourni.
 */
appsRouter.post('/', async (req, res, next) => {
  try {
    const { prompt, spec: providedSpec, seed = true } = req.body || {};

    let spec = providedSpec;
    let reply = null;
    let messages = [];

    if (!spec) {
      if (!prompt || !String(prompt).trim()) {
        return res.status(400).json({ error: 'Fournissez une description (prompt) ou un spec.' });
      }
      const engine = createEngine();
      const result = engine.chat(String(prompt));
      spec = result.spec;
      reply = result.reply;
      messages = [
        { role: 'user', content: String(prompt), at: new Date().toISOString() },
        {
          role: 'assistant',
          content: result.reply,
          changes: result.changes,
          suggestions: result.suggestions,
          at: new Date().toISOString(),
        },
      ];
    }

    if (!spec?.entities?.length) {
      return res.status(400).json({ error: "Le moteur n'a pas pu construire d'application exploitable." });
    }

    const app = await store.createApp({
      name: spec.name,
      spec,
      messages,
      published: false,
    });

    // Une application vide est difficile a evaluer : on la peuple par defaut.
    if (seed) {
      await store.setRecords(app.id, generateSampleData(spec, { perEntity: 8 }));
    }

    res.status(201).json({ app, reply });
  } catch (error) { next(error); }
});

appsRouter.put('/:id', async (req, res, next) => {
  try {
    const { spec, name, published } = req.body || {};
    const patch = {};

    if (spec) {
      const errors = validateSpec(spec).filter((i) => i.level === 'error');
      if (errors.length) {
        return res.status(400).json({ error: 'Spec invalide.', details: errors });
      }
      patch.spec = spec;
      patch.name = spec.name;
    }
    if (typeof name === 'string') patch.name = name;
    if (typeof published === 'boolean') patch.published = published;

    const app = await store.updateApp(req.params.id, patch);
    if (!app) return res.status(404).json({ error: 'Application introuvable.' });
    res.json(app);
  } catch (error) { next(error); }
});

appsRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await store.deleteApp(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Application introuvable.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

/** Regenere un jeu de donnees d'exemple. */
appsRouter.post('/:id/seed', async (req, res, next) => {
  try {
    const app = await store.getApp(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application introuvable.' });

    const perEntity = Math.min(Math.max(Number(req.body?.perEntity) || 8, 1), 50);
    const data = generateSampleData(app.spec, { perEntity, seed: Date.now() % 100000 });
    await store.setRecords(app.id, data);

    res.json({ ok: true, counts: Object.fromEntries(
      Object.entries(data).map(([key, rows]) => [key, rows.length]),
    ) });
  } catch (error) { next(error); }
});

/** Duplique une application (spec + donnees). */
appsRouter.post('/:id/duplicate', async (req, res, next) => {
  try {
    const app = await store.getApp(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application introuvable.' });

    const spec = structuredClone(app.spec);
    spec.name = `${spec.name} (copie)`;

    const copy = await store.createApp({
      name: spec.name,
      spec,
      messages: [],
      published: false,
    });
    await store.setRecords(copy.id, await store.getRecords(app.id));

    res.status(201).json(copy);
  } catch (error) { next(error); }
});
