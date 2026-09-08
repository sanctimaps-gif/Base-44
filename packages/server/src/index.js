/**
 * Base 44 — serveur d'API.
 *
 * Il orchestre trois choses : le moteur d'IA local, le stockage des
 * applications et l'API de donnees des applications generees.
 */

import express from 'express';
import cors from 'cors';

import { store } from './store.js';
import { appsRouter } from './routes/apps.js';
import { chatRouter } from './routes/chat.js';
import { recordsRouter } from './routes/records.js';
import { exportRouter, catalogRouter } from './routes/export.js';

const PORT = Number(process.env.PORT) || 844;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

export function createServer() {
  const app = express();

  app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'base44-api', time: new Date().toISOString() });
  });

  // Catalogue global (modeles, moteur) : sans identifiant d'application.
  app.use('/api', catalogRouter);

  // Routes propres a une application.
  app.use('/api/apps', appsRouter);
  app.use('/api/apps', chatRouter);
  app.use('/api/apps', recordsRouter);
  app.use('/api/apps', exportRouter);

  app.use((req, res) => {
    res.status(404).json({ error: `Route inconnue : ${req.method} ${req.originalUrl}` });
  });

  // Gestionnaire d'erreurs : rien ne doit fuiter vers le client.
  app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = error.status || 500;
    if (status >= 500) console.error('[api]', error);
    res.status(status).json({
      error: status >= 500 ? 'Erreur interne du serveur.' : error.message,
    });
  });

  return app;
}

/** Demarrage direct (et non lors d'un import depuis les tests). */
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await store.init();
  createServer().listen(PORT, () => {
    console.log(`Base 44 — API prete sur http://localhost:${PORT}`);
    console.log(`   Moteur d'IA : natif, hors ligne, sans dependance externe.`);
  });
}
