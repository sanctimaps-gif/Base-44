/**
 * Backend autonome, execute dans le navigateur.
 *
 * Base 44 fonctionne normalement avec son API Express. Sur un hebergement
 * purement statique (GitHub Pages), aucun serveur n'est disponible : ce module
 * rejoue les memes routes en local et persiste dans `localStorage`.
 *
 * Le moteur d'IA n'ayant aucune dependance ni appel reseau, il s'execute tel
 * quel ici : l'application reste entierement fonctionnelle et hors ligne.
 */

import {
  createEngine, generateSampleData, validateSpec, synthProject, BLUEPRINTS,
  coerceRecord, checkUnique,
} from '@base44/engine';

const APPS_KEY = 'base44:apps';
const RECORDS_KEY = (appId) => `base44:records:${appId}`;

/** Erreur portant un code HTTP, pour rester identique au client HTTP. */
function fail(status, message, details) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

function uid(length) {
  const raw = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return raw.slice(0, length);
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    // Stockage indisponible (navigation privee) ou JSON corrompu : on repart
    // d'un etat vide plutot que de bloquer l'application.
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw fail(507, "Stockage du navigateur plein ou indisponible. Liberez de l'espace et reessayez.");
  }
}

const store = {
  listApps() {
    return read(APPS_KEY, [])
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  },

  getApp(id) {
    return read(APPS_KEY, []).find((a) => a.id === id) || null;
  },

  createApp(app) {
    const apps = read(APPS_KEY, []);
    const now = new Date().toISOString();
    const created = { id: uid(8), createdAt: now, updatedAt: now, ...app };
    apps.push(created);
    write(APPS_KEY, apps);
    return created;
  },

  updateApp(id, patch) {
    const apps = read(APPS_KEY, []);
    const index = apps.findIndex((a) => a.id === id);
    if (index === -1) return null;
    apps[index] = { ...apps[index], ...patch, id, updatedAt: new Date().toISOString() };
    write(APPS_KEY, apps);
    return apps[index];
  },

  deleteApp(id) {
    const apps = read(APPS_KEY, []);
    const next = apps.filter((a) => a.id !== id);
    if (next.length === apps.length) return false;
    write(APPS_KEY, next);
    localStorage.removeItem(RECORDS_KEY(id));
    return true;
  },

  getRecords(appId) {
    return read(RECORDS_KEY(appId), {});
  },

  setRecords(appId, records) {
    write(RECORDS_KEY(appId), records);
    return records;
  },

  listRecords(appId, entity) {
    return store.getRecords(appId)[entity] || [];
  },

  createRecord(appId, entity, data) {
    const all = store.getRecords(appId);
    const rows = all[entity] || [];
    const record = { ...data, id: uid(12), createdAt: new Date().toISOString() };
    rows.push(record);
    all[entity] = rows;
    write(RECORDS_KEY(appId), all);
    return record;
  },

  updateRecord(appId, entity, recordId, patch) {
    const all = store.getRecords(appId);
    const rows = all[entity] || [];
    const index = rows.findIndex((r) => r.id === recordId);
    if (index === -1) return null;
    rows[index] = { ...rows[index], ...patch, id: recordId, updatedAt: new Date().toISOString() };
    all[entity] = rows;
    write(RECORDS_KEY(appId), all);
    return rows[index];
  },

  deleteRecord(appId, entity, recordId) {
    const all = store.getRecords(appId);
    const rows = all[entity] || [];
    const next = rows.filter((r) => r.id !== recordId);
    if (next.length === rows.length) return false;
    all[entity] = next;
    write(RECORDS_KEY(appId), all);
    return true;
  },
};

/** Vue allegee pour la liste des applications. */
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

function requireApp(id) {
  const app = store.getApp(id);
  if (!app) throw fail(404, 'Application introuvable.');
  return app;
}

function requireEntity(app, name) {
  const entity = app.spec.entities.find((e) => e.name === name);
  if (!entity) throw fail(404, `Entite « ${name} » introuvable.`);
  return entity;
}

/**
 * Aligne les donnees sur le spec courant : les entites nouvelles recoivent un
 * echantillon, les entites supprimees liberent leurs enregistrements.
 */
function reconcileRecords(appId, spec) {
  const records = store.getRecords(appId);
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
    Object.assign(records, generateSampleData(
      { ...spec, entities: missing },
      { perEntity: 8, seed: Date.now() % 100000 },
    ));
    dirty = true;
  }

  if (dirty) store.setRecords(appId, records);
}

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY = 200;

/* ------------------------------------------------------------------ Routes */

function getApps() {
  return store.listApps().map(summarize);
}

function postApps(body) {
  const { prompt, spec: providedSpec, seed = true } = body || {};

  let spec = providedSpec;
  let reply = null;
  let messages = [];

  if (!spec) {
    if (!prompt || !String(prompt).trim()) {
      throw fail(400, 'Fournissez une description (prompt) ou un spec.');
    }
    const result = createEngine().chat(String(prompt));
    spec = result.spec;
    reply = result.reply;
    const at = new Date().toISOString();
    messages = [
      { role: 'user', content: String(prompt), at },
      {
        role: 'assistant',
        content: result.reply,
        changes: result.changes,
        suggestions: result.suggestions,
        at,
      },
    ];
  }

  if (!spec?.entities?.length) {
    throw fail(400, "Le moteur n'a pas pu construire d'application exploitable.");
  }

  const app = store.createApp({ name: spec.name, spec, messages, published: false });
  if (seed) store.setRecords(app.id, generateSampleData(spec, { perEntity: 8 }));

  return { app, reply };
}

function putApp(id, body) {
  const { spec, name, published } = body || {};
  const patch = {};

  if (spec) {
    const errors = validateSpec(spec).filter((i) => i.level === 'error');
    if (errors.length) throw fail(400, 'Spec invalide.', errors);
    patch.spec = spec;
    patch.name = spec.name;
  }
  if (typeof name === 'string') patch.name = name;
  if (typeof published === 'boolean') patch.published = published;

  const app = store.updateApp(id, patch);
  if (!app) throw fail(404, 'Application introuvable.');
  return app;
}

function postChat(id, body) {
  const message = String(body?.message ?? '').slice(0, MAX_MESSAGE_LENGTH);
  if (!message.trim()) throw fail(400, 'Message vide.');

  const app = requireApp(id);
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

  const updated = store.updateApp(app.id, patch);

  if (specChanged && result.spec) reconcileRecords(app.id, result.spec);
  if (result.seed) {
    store.setRecords(app.id, generateSampleData(result.spec, {
      perEntity: 8,
      seed: Date.now() % 100000,
    }));
  }

  return {
    reply: result.reply,
    intent: result.intent,
    confidence: result.confidence,
    changes: result.changes,
    suggestions: result.suggestions,
    issues: result.issues,
    specChanged,
    app: updated,
  };
}

function postSeed(id, body) {
  const app = requireApp(id);
  const perEntity = Math.min(Math.max(Number(body?.perEntity) || 8, 1), 50);
  const data = generateSampleData(app.spec, { perEntity, seed: Date.now() % 100000 });
  store.setRecords(app.id, data);
  return {
    ok: true,
    counts: Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])),
  };
}

function postDuplicate(id) {
  const app = requireApp(id);
  const spec = structuredClone(app.spec);
  spec.name = `${spec.name} (copie)`;

  const copy = store.createApp({ name: spec.name, spec, messages: [], published: false });
  store.setRecords(copy.id, store.getRecords(app.id));
  return copy;
}

function listRecords(id, entityName, params) {
  const app = requireApp(id);
  const entity = requireEntity(app, entityName);
  let rows = store.listRecords(id, entity.name);

  const search = String(params.get('q') || '').trim().toLowerCase();
  if (search) {
    rows = rows.filter((row) => Object.values(row).some(
      (v) => String(v ?? '').toLowerCase().includes(search),
    ));
  }

  const field = params.get('field');
  const value = params.get('value');
  if (field && value !== null) {
    rows = rows.filter((row) => String(row[field] ?? '') === String(value));
  }

  const sort = String(params.get('sort') || '');
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

  return rows;
}

function createRecord(id, entityName, body) {
  const entity = requireEntity(requireApp(id), entityName);
  const { values, errors } = coerceRecord(entity, body);
  const all = [...errors, ...checkUnique(entity, store.listRecords(id, entity.name), values)];
  if (all.length) throw fail(400, 'Validation echouee.', all);
  return store.createRecord(id, entity.name, values);
}

function updateRecord(id, entityName, recordId, body) {
  const entity = requireEntity(requireApp(id), entityName);
  const { values, errors } = coerceRecord(entity, body, { partial: true });
  const rows = store.listRecords(id, entity.name);
  const all = [...errors, ...checkUnique(entity, rows, values, recordId)];
  if (all.length) throw fail(400, 'Validation echouee.', all);

  const record = store.updateRecord(id, entity.name, recordId, values);
  if (!record) throw fail(404, 'Enregistrement introuvable.');
  return record;
}

function deleteRecord(id, entityName, recordId) {
  const entity = requireEntity(requireApp(id), entityName);
  if (!store.deleteRecord(id, entity.name, recordId)) {
    throw fail(404, 'Enregistrement introuvable.');
  }
  return null;
}

function exportProject(id) {
  const app = requireApp(id);
  const files = synthProject(app.spec);
  return { name: app.spec.name, fileCount: Object.keys(files).length, files };
}

function templates() {
  return BLUEPRINTS.map((bp) => ({
    id: bp.id,
    label: bp.label,
    icon: bp.icon,
    color: bp.theme?.primary,
    entities: bp.entities.map((e) => ({ label: e.label, fieldCount: e.fields.length })),
    prompt: `Cree une application de ${bp.label.toLowerCase()}`,
  }));
}

/**
 * Point d'entree : meme signature que le client HTTP.
 * @param {string} path chemin apres `/api`, query string comprise
 */
export async function localRequest(path, { method = 'GET', body } = {}) {
  const [rawPath, rawQuery = ''] = String(path).split('?');
  const params = new URLSearchParams(rawQuery);
  const segments = rawPath.split('/').filter(Boolean);
  const [root, id, section, entityName, , recordId] = segments;

  if (root === 'health') {
    return { status: 'ok', service: 'base44-standalone', time: new Date().toISOString() };
  }
  if (root === 'engine') return createEngine().identity();
  if (root === 'templates') return templates();

  if (root !== 'apps') throw fail(404, `Route inconnue : ${rawPath}`);

  // /apps
  if (!id) {
    if (method === 'GET') return getApps();
    if (method === 'POST') return postApps(body);
    throw fail(405, `Methode ${method} non supportee.`);
  }

  // /apps/:id
  if (!section) {
    if (method === 'GET') return requireApp(id);
    if (method === 'PUT') return putApp(id, body);
    if (method === 'DELETE') {
      if (!store.deleteApp(id)) throw fail(404, 'Application introuvable.');
      return null;
    }
    throw fail(405, `Methode ${method} non supportee.`);
  }

  // /apps/:id/entities/:entity/records[/:recordId]
  if (section === 'entities') {
    if (!recordId) {
      if (method === 'GET') return listRecords(id, entityName, params);
      if (method === 'POST') return createRecord(id, entityName, body);
      throw fail(405, `Methode ${method} non supportee.`);
    }
    if (method === 'PUT') return updateRecord(id, entityName, recordId, body);
    if (method === 'DELETE') return deleteRecord(id, entityName, recordId);
    throw fail(405, `Methode ${method} non supportee.`);
  }

  switch (section) {
    case 'chat': return postChat(id, body);
    case 'messages': return requireApp(id).messages || [];
    case 'data': { requireApp(id); return store.getRecords(id); }
    case 'seed': return postSeed(id, body);
    case 'duplicate': return postDuplicate(id);
    case 'export': return exportProject(id);
    default: throw fail(404, `Route inconnue : ${rawPath}`);
  }
}
