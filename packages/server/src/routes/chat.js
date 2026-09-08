/**
 * Route de conversation — c'est ici que l'IA modifie l'application.
 *
 * Le moteur est instancie avec la memoire persistee de l'application, ce qui
 * lui permet de comprendre les references au fil de la discussion.
 */

import { Router } from 'express';
import { createEngine, generateSampleData } from '@base44/engine';
import { store } from '../store.js';

export const chatRouter = Router();

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY = 200;

chatRouter.post('/:id/chat', async (req, res, next) => {
  try {
    const message = String(req.body?.message ?? '').slice(0, MAX_MESSAGE_LENGTH);
    if (!message.trim()) {
      return res.status(400).json({ error: 'Message vide.' });
    }

    const app = await store.getApp(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application introuvable.' });

    const engine = createEngine({ memory: app.memory });
    const before = JSON.stringify(app.spec);
    const result = engine.chat(message, structuredClone(app.spec));

    const specChanged = JSON.stringify(result.spec) !== before;
    const now = new Date().toISOString();

    const messages = [
      ...(app.messages || []),
      { role: 'user', content: message, at: now },
      {
        role: 'assistant',
        content: result.reply,
        intent: result.intent,
        confidence: result.confidence,
        changes: result.changes,
        suggestions: result.suggestions,
        at: now,
      },
    ].slice(-MAX_HISTORY);

    const patch = { messages, memory: result.memory };
    if (specChanged && result.spec) {
      patch.spec = result.spec;
      patch.name = result.spec.name;
    }

    const updated = await store.updateApp(app.id, patch);

    // Une nouvelle entite serait vide : on la remplit pour rester coherent.
    if (specChanged && result.spec) {
      await reconcileRecords(app.id, result.spec);
    }
    // Demande explicite de donnees d'exemple.
    if (result.seed) {
      await store.setRecords(app.id, generateSampleData(result.spec, {
        perEntity: 8,
        seed: Date.now() % 100000,
      }));
    }

    res.json({
      reply: result.reply,
      intent: result.intent,
      confidence: result.confidence,
      changes: result.changes,
      suggestions: result.suggestions,
      issues: result.issues,
      specChanged,
      app: updated,
    });
  } catch (error) { next(error); }
});

/**
 * Aligne les donnees stockees sur le spec courant :
 * - les entites nouvellement creees recoivent un echantillon,
 * - les entites supprimees liberent leurs enregistrements.
 */
async function reconcileRecords(appId, spec) {
  const records = await store.getRecords(appId);
  const names = new Set(spec.entities.map((e) => e.name));
  let dirty = false;

  for (const key of Object.keys(records)) {
    if (!names.has(key)) {
      delete records[key];
      dirty = true;
    }
  }

  const missing = spec.entities.filter((e) => !records[e.name]);
  if (missing.length) {
    const partial = { ...spec, entities: missing };
    const generated = generateSampleData(partial, { perEntity: 8, seed: Date.now() % 100000 });
    Object.assign(records, generated);
    dirty = true;
  }

  if (dirty) await store.setRecords(appId, records);
  return records;
}

/** Historique de conversation d'une application. */
chatRouter.get('/:id/messages', async (req, res, next) => {
  try {
    const app = await store.getApp(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application introuvable.' });
    res.json(app.messages || []);
  } catch (error) { next(error); }
});
