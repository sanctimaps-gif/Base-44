/**
 * Stockage sur fichiers JSON.
 *
 * Volontairement sans dependance native : Base 44 doit demarrer partout avec un
 * simple `npm install`. L'interface est suffisamment etroite pour etre
 * remplacee par PostgreSQL ou SQLite sans toucher aux routes.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const APPS_FILE = path.join(DATA_DIR, 'apps.json');
const RECORDS_DIR = path.join(DATA_DIR, 'records');

/** Serialise les ecritures pour eviter deux `writeFile` concurrents. */
let writeQueue = Promise.resolve();
function serialize(task) {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(RECORDS_DIR, { recursive: true });
}

async function readJSON(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    if (error instanceof SyntaxError) {
      // Un fichier corrompu ne doit pas empecher le serveur de demarrer.
      console.warn(`[store] ${file} illisible, reinitialisation.`);
      return fallback;
    }
    throw error;
  }
}

/** Ecriture atomique : on ecrit un fichier temporaire puis on le renomme. */
async function writeJSON(file, data) {
  await ensureDirs();
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

const recordsFile = (appId) => path.join(RECORDS_DIR, `${appId}.json`);

/** Empeche toute traversee de chemin via un identifiant fabrique. */
function assertSafeId(id) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(id || ''))) {
    const error = new Error('Identifiant invalide.');
    error.status = 400;
    throw error;
  }
  return id;
}

export const store = {
  async init() {
    await ensureDirs();
    return this;
  },

  // --- Applications -------------------------------------------------------

  async listApps() {
    const apps = await readJSON(APPS_FILE, []);
    return apps.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  },

  async getApp(id) {
    assertSafeId(id);
    const apps = await readJSON(APPS_FILE, []);
    return apps.find((a) => a.id === id) || null;
  },

  async createApp(app) {
    return serialize(async () => {
      const apps = await readJSON(APPS_FILE, []);
      const now = new Date().toISOString();
      const created = {
        id: randomUUID().slice(0, 8),
        createdAt: now,
        updatedAt: now,
        ...app,
      };
      apps.push(created);
      await writeJSON(APPS_FILE, apps);
      return created;
    });
  },

  async updateApp(id, patch) {
    assertSafeId(id);
    return serialize(async () => {
      const apps = await readJSON(APPS_FILE, []);
      const index = apps.findIndex((a) => a.id === id);
      if (index === -1) return null;
      apps[index] = { ...apps[index], ...patch, id, updatedAt: new Date().toISOString() };
      await writeJSON(APPS_FILE, apps);
      return apps[index];
    });
  },

  async deleteApp(id) {
    assertSafeId(id);
    return serialize(async () => {
      const apps = await readJSON(APPS_FILE, []);
      const next = apps.filter((a) => a.id !== id);
      if (next.length === apps.length) return false;
      await writeJSON(APPS_FILE, next);
      await fs.rm(recordsFile(id), { force: true });
      return true;
    });
  },

  // --- Enregistrements ----------------------------------------------------

  /** Toutes les donnees d'une application, indexees par nom d'entite. */
  async getRecords(appId) {
    assertSafeId(appId);
    return readJSON(recordsFile(appId), {});
  },

  async setRecords(appId, records) {
    assertSafeId(appId);
    return serialize(async () => {
      await writeJSON(recordsFile(appId), records);
      return records;
    });
  },

  async listRecords(appId, entity) {
    const all = await this.getRecords(appId);
    return all[entity] || [];
  },

  async createRecord(appId, entity, data) {
    assertSafeId(appId);
    return serialize(async () => {
      const all = await readJSON(recordsFile(appId), {});
      const rows = all[entity] || [];
      const record = {
        ...data,
        id: randomUUID().slice(0, 12),
        createdAt: new Date().toISOString(),
      };
      rows.push(record);
      all[entity] = rows;
      await writeJSON(recordsFile(appId), all);
      return record;
    });
  },

  async updateRecord(appId, entity, recordId, patch) {
    assertSafeId(appId);
    return serialize(async () => {
      const all = await readJSON(recordsFile(appId), {});
      const rows = all[entity] || [];
      const index = rows.findIndex((r) => r.id === recordId);
      if (index === -1) return null;
      rows[index] = { ...rows[index], ...patch, id: recordId, updatedAt: new Date().toISOString() };
      all[entity] = rows;
      await writeJSON(recordsFile(appId), all);
      return rows[index];
    });
  },

  async deleteRecord(appId, entity, recordId) {
    assertSafeId(appId);
    return serialize(async () => {
      const all = await readJSON(recordsFile(appId), {});
      const rows = all[entity] || [];
      const next = rows.filter((r) => r.id !== recordId);
      if (next.length === rows.length) return false;
      all[entity] = next;
      await writeJSON(recordsFile(appId), all);
      return true;
    });
  },
};

export { DATA_DIR };
