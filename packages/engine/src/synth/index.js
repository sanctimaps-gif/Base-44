/**
 * Synthetiseurs de code.
 *
 * L'AppSpec est traduit en fichiers source reels : schema SQL, API REST Express
 * et composants React. C'est ce qui permet d'exporter une application generee
 * et de la faire tourner en dehors de Base 44.
 */

import { pascal, camel, snake, slugify } from '../util/text.js';

/** Mappe un type Base 44 vers un type SQL. */
const SQL_TYPES = {
  text: 'TEXT',
  longtext: 'TEXT',
  number: 'REAL',
  currency: 'REAL',
  percent: 'REAL',
  rating: 'INTEGER',
  boolean: 'INTEGER',
  date: 'TEXT',
  datetime: 'TEXT',
  email: 'TEXT',
  phone: 'TEXT',
  url: 'TEXT',
  select: 'TEXT',
  multiselect: 'TEXT',
  relation: 'TEXT',
  image: 'TEXT',
  file: 'TEXT',
  color: 'TEXT',
  json: 'TEXT',
};

/** Mappe un type Base 44 vers un type TypeScript. */
const TS_TYPES = {
  number: 'number', currency: 'number', percent: 'number', rating: 'number',
  boolean: 'boolean', multiselect: 'string[]', json: 'Record<string, unknown>',
};

const tsType = (field) => TS_TYPES[field.type] || 'string';

/** Genere le schema SQL complet. */
export function synthSQL(spec) {
  const lines = [
    `-- Schema genere par Base 44 pour « ${spec.name} »`,
    `-- ${new Date().toISOString()}`,
    '',
  ];

  for (const entity of spec.entities) {
    const table = snake(entity.labelPlural);
    lines.push(`CREATE TABLE IF NOT EXISTS ${table} (`);
    const cols = ['  id TEXT PRIMARY KEY', '  created_at TEXT NOT NULL', '  updated_at TEXT'];

    for (const field of entity.fields) {
      let col = `  ${field.name} ${SQL_TYPES[field.type] || 'TEXT'}`;
      if (field.required) col += ' NOT NULL';
      if (field.unique) col += ' UNIQUE';
      cols.push(col);
    }

    for (const field of entity.fields) {
      if (field.type === 'relation' && field.ref) {
        const refEntity = spec.entities.find((e) => e.name === field.ref);
        if (refEntity) {
          cols.push(`  FOREIGN KEY (${field.name}) REFERENCES ${snake(refEntity.labelPlural)}(id)`);
        }
      }
    }

    lines.push(cols.join(',\n'));
    lines.push(');');
    lines.push('');
  }

  return lines.join('\n');
}

/** Genere les types TypeScript des entites. */
export function synthTypes(spec) {
  const blocks = [
    `// Types generes par Base 44 — « ${spec.name} »`,
    '',
  ];

  for (const entity of spec.entities) {
    blocks.push(`export interface ${entity.name} {`);
    blocks.push('  id: string;');
    blocks.push('  createdAt: string;');
    for (const field of entity.fields) {
      const optional = field.required ? '' : '?';
      if (field.type === 'select' && field.options?.length) {
        const union = field.options.map((o) => `'${String(o).replace(/'/g, "\\'")}'`).join(' | ');
        blocks.push(`  ${field.name}${optional}: ${union};`);
      } else {
        blocks.push(`  ${field.name}${optional}: ${tsType(field)};`);
      }
    }
    blocks.push('}');
    blocks.push('');
  }

  return blocks.join('\n');
}

/** Genere une API REST Express complete. */
export function synthAPI(spec) {
  const routes = spec.entities.map((entity) => {
    const path = slugify(entity.labelPlural);
    const store = camel(entity.labelPlural);
    return `
// --- ${entity.label} ---
app.get('/api/${path}', (req, res) => {
  res.json(db.${store});
});

app.get('/api/${path}/:id', (req, res) => {
  const item = db.${store}.find((r) => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Introuvable' });
  res.json(item);
});

app.post('/api/${path}', (req, res) => {
  const errors = validate${entity.name}(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const item = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...req.body,
  };
  db.${store}.push(item);
  res.status(201).json(item);
});

app.put('/api/${path}/:id', (req, res) => {
  const index = db.${store}.findIndex((r) => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Introuvable' });
  const errors = validate${entity.name}({ ...db.${store}[index], ...req.body });
  if (errors.length) return res.status(400).json({ errors });
  db.${store}[index] = {
    ...db.${store}[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  res.json(db.${store}[index]);
});

app.delete('/api/${path}/:id', (req, res) => {
  const index = db.${store}.findIndex((r) => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Introuvable' });
  db.${store}.splice(index, 1);
  res.status(204).end();
});`;
  }).join('\n');

  const validators = spec.entities.map((entity) => {
    const checks = entity.fields
      .filter((f) => f.required)
      .map((f) => `  if (body.${f.name} === undefined || body.${f.name} === '') errors.push('${f.label} est obligatoire.');`);

    const enums = entity.fields
      .filter((f) => f.type === 'select' && f.options?.length)
      .map((f) => {
        const options = f.options.map((o) => `'${String(o).replace(/'/g, "\\'")}'`).join(', ');
        return `  if (body.${f.name} && ![${options}].includes(body.${f.name})) errors.push('${f.label} : valeur non autorisee.');`;
      });

    return `function validate${entity.name}(body = {}) {
  const errors = [];
${[...checks, ...enums].join('\n') || '  // Aucune contrainte declaree.'}
  return errors;
}`;
  }).join('\n\n');

  const stores = spec.entities.map((e) => `  ${camel(e.labelPlural)}: [],`).join('\n');

  return `/**
 * API REST generee par Base 44 pour « ${spec.name} ».
 * Lancement : node server.js
 */
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';

const app = express();
app.use(cors());
app.use(express.json());

// Stockage en memoire — remplacez-le par votre base de donnees.
const db = {
${stores}
};

${validators}
${routes}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(\`${spec.name} — API sur http://localhost:\${port}\`));
`;
}

/** Genere le client d'API cote front. */
export function synthClient(spec) {
  const methods = spec.entities.map((entity) => {
    const path = slugify(entity.labelPlural);
    const key = camel(entity.labelPlural);
    return `  ${key}: {
    list: () => request('/api/${path}'),
    get: (id) => request(\`/api/${path}/\${id}\`),
    create: (data) => request('/api/${path}', { method: 'POST', body: data }),
    update: (id, data) => request(\`/api/${path}/\${id}\`, { method: 'PUT', body: data }),
    remove: (id) => request(\`/api/${path}/\${id}\`, { method: 'DELETE' }),
  },`;
  }).join('\n');

  return `/** Client d'API genere par Base 44 — « ${spec.name} ». */
const BASE_URL = import.meta.env?.VITE_API_URL || '';

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || \`Erreur \${response.status}\`);
  }
  return response.status === 204 ? null : response.json();
}

export const api = {
${methods}
};
`;
}

/** Genere un composant React de liste pour une entite. */
export function synthListComponent(spec, entity) {
  const columns = entity.fields.slice(0, 6);
  const key = camel(entity.labelPlural);

  const headers = columns.map((f) => `            <th>${f.label}</th>`).join('\n');
  const cells = columns.map((f) => `              <td>{format(item.${f.name}, '${f.type}')}</td>`).join('\n');

  return `import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { format } from '../lib/format.js';

export default function ${entity.name}List() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.${key}.list()
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p>Chargement…</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <section>
      <header>
        <h1>${entity.labelPlural}</h1>
        <p>{items.length} enregistrement(s)</p>
      </header>
      <table>
        <thead>
          <tr>
${headers}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
${cells}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
`;
}

/** Genere un formulaire React pour une entite. */
export function synthFormComponent(spec, entity) {
  const key = camel(entity.labelPlural);

  const inputs = entity.fields.map((field) => {
    const label = `        <label htmlFor="${field.name}">${field.label}${field.required ? ' *' : ''}</label>`;
    let control;

    if (field.type === 'longtext') {
      control = `        <textarea id="${field.name}" name="${field.name}" value={values.${field.name} ?? ''} onChange={handleChange} rows={4} />`;
    } else if (field.type === 'boolean') {
      control = `        <input id="${field.name}" name="${field.name}" type="checkbox" checked={Boolean(values.${field.name})} onChange={handleChange} />`;
    } else if (field.type === 'select') {
      const options = (field.options || [])
        .map((o) => `          <option value="${String(o).replace(/"/g, '&quot;')}">${o}</option>`)
        .join('\n');
      control = `        <select id="${field.name}" name="${field.name}" value={values.${field.name} ?? ''} onChange={handleChange}>
          <option value="">—</option>
${options}
        </select>`;
    } else {
      control = `        <input id="${field.name}" name="${field.name}" type="${htmlInputType(field.type)}" value={values.${field.name} ?? ''} onChange={handleChange}${field.required ? ' required' : ''} />`;
    }

    return `      <div className="field">\n${label}\n${control}\n      </div>`;
  }).join('\n');

  return `import { useState } from 'react';
import { api } from '../lib/api.js';

export default function ${entity.name}Form({ initial = {}, onSaved }) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(event) {
    const { name, type, value, checked } = event.target;
    setValues((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = values.id
        ? await api.${key}.update(values.id, values)
        : await api.${key}.create(values);
      onSaved?.(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>${entity.label}</h2>
      {error && <p role="alert">{error}</p>}
${inputs}
      <button type="submit" disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  );
}
`;
}

function htmlInputType(type) {
  switch (type) {
    case 'number': case 'currency': case 'percent': case 'rating': return 'number';
    case 'date': return 'date';
    case 'datetime': return 'datetime-local';
    case 'email': return 'email';
    case 'phone': return 'tel';
    case 'url': return 'url';
    case 'color': return 'color';
    default: return 'text';
  }
}

/** Utilitaire de formatage embarque dans le projet exporte. */
export function synthFormatHelper() {
  return `/** Formatage des valeurs — genere par Base 44. */
export function format(value, type) {
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value));
    case 'percent':
      return \`\${Number(value)} %\`;
    case 'boolean':
      return value ? 'Oui' : 'Non';
    case 'date':
      return new Date(value).toLocaleDateString('fr-FR');
    case 'datetime':
      return new Date(value).toLocaleString('fr-FR');
    case 'multiselect':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'rating':
      return '★'.repeat(Number(value)) + '☆'.repeat(Math.max(0, 5 - Number(value)));
    default:
      return String(value);
  }
}
`;
}

/** Genere le README du projet exporte. */
export function synthReadme(spec) {
  const entityList = spec.entities
    .map((e) => `- **${e.labelPlural}** — ${e.fields.length} champs (${e.fields.map((f) => f.label).join(', ')})`)
    .join('\n');

  return `# ${spec.name}

${spec.description || 'Application generee par Base 44.'}

## Modele de donnees

${entityList}

## Demarrage

\`\`\`bash
npm install express cors
node server.js
\`\`\`

L'API ecoute sur http://localhost:3000.

## Contenu

| Fichier | Role |
| --- | --- |
| \`schema.sql\` | Schema de base de donnees |
| \`types.ts\` | Types TypeScript des entites |
| \`server.js\` | API REST Express |
| \`src/lib/api.js\` | Client d'API |
| \`src/lib/format.js\` | Formatage des valeurs |
| \`src/pages/*\` | Composants React (listes et formulaires) |

---
Genere par Base 44 — moteur d'IA autonome.
`;
}

/**
 * Produit l'arborescence complete du projet exporte.
 * @returns {Record<string,string>} chemin -> contenu
 */
export function synthProject(spec) {
  const files = {
    'README.md': synthReadme(spec),
    'schema.sql': synthSQL(spec),
    'types.ts': synthTypes(spec),
    'server.js': synthAPI(spec),
    'src/lib/api.js': synthClient(spec),
    'src/lib/format.js': synthFormatHelper(),
    'app.spec.json': JSON.stringify(spec, null, 2),
  };

  for (const entity of spec.entities) {
    files[`src/pages/${entity.name}List.jsx`] = synthListComponent(spec, entity);
    files[`src/pages/${entity.name}Form.jsx`] = synthFormComponent(spec, entity);
  }

  return files;
}
