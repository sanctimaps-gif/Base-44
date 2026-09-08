/** Export du code source genere et acces au catalogue de modeles. */

import { Router } from 'express';
import { synthProject, BLUEPRINTS, createEngine } from '@base44/engine';
import { store } from '../store.js';

/** Routes liees a une application donnee — montees sous /api/apps. */
export const exportRouter = Router();

/** Routes globales (catalogue, moteur) — montees sous /api. */
export const catalogRouter = Router();

/** Arborescence complete du projet exporte (chemin -> contenu). */
exportRouter.get('/:id/export', async (req, res, next) => {
  try {
    const app = await store.getApp(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application introuvable.' });

    const files = synthProject(app.spec);
    res.json({
      name: app.spec.name,
      fileCount: Object.keys(files).length,
      files,
    });
  } catch (error) { next(error); }
});

/** Un seul fichier, en texte brut (pratique pour l'onglet « Code »). */
exportRouter.get('/:id/export/file', async (req, res, next) => {
  try {
    const app = await store.getApp(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application introuvable.' });

    const files = synthProject(app.spec);
    const path = String(req.query.path || '');
    if (!Object.hasOwn(files, path)) {
      return res.status(404).json({ error: 'Fichier introuvable.', available: Object.keys(files) });
    }

    res.type('text/plain').send(files[path]);
  } catch (error) { next(error); }
});

/** Catalogue des domaines connus par l'IA — alimente l'ecran « Modeles ». */
catalogRouter.get('/templates', (req, res) => {
  res.json(BLUEPRINTS.map((bp) => ({
    id: bp.id,
    label: bp.label,
    icon: bp.icon,
    color: bp.theme?.primary,
    entities: bp.entities.map((e) => ({
      label: e.label,
      fieldCount: e.fields.length,
    })),
    prompt: `Cree une application de ${bp.label.toLowerCase()}`,
  })));
});

/** Carte d'identite du moteur — utilisee par l'ecran « IA ». */
catalogRouter.get('/engine', (req, res) => {
  res.json(createEngine().identity());
});
