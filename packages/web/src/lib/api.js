/** Client HTTP de l'API Base 44. */

const BASE = '/api';

async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text };
  }

  if (!response.ok) {
    const error = new Error(payload?.error || `Erreur ${response.status}`);
    error.status = response.status;
    error.details = payload?.details;
    throw error;
  }

  return payload;
}

export const api = {
  health: () => request('/health'),
  engine: () => request('/engine'),
  templates: () => request('/templates'),

  apps: {
    list: () => request('/apps'),
    get: (id) => request(`/apps/${id}`),
    create: (payload) => request('/apps', { method: 'POST', body: payload }),
    update: (id, patch) => request(`/apps/${id}`, { method: 'PUT', body: patch }),
    remove: (id) => request(`/apps/${id}`, { method: 'DELETE' }),
    duplicate: (id) => request(`/apps/${id}/duplicate`, { method: 'POST' }),
    seed: (id, perEntity) => request(`/apps/${id}/seed`, { method: 'POST', body: { perEntity } }),
  },

  chat: {
    send: (id, message) => request(`/apps/${id}/chat`, { method: 'POST', body: { message } }),
    messages: (id) => request(`/apps/${id}/messages`),
  },

  data: {
    all: (id) => request(`/apps/${id}/data`),
    list: (id, entity, query = {}) => {
      const params = new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== '' && v !== undefined && v !== null),
      );
      const suffix = params.toString() ? `?${params}` : '';
      return request(`/apps/${id}/entities/${entity}/records${suffix}`);
    },
    create: (id, entity, values) => request(`/apps/${id}/entities/${entity}/records`, {
      method: 'POST', body: values,
    }),
    update: (id, entity, recordId, values) => request(`/apps/${id}/entities/${entity}/records/${recordId}`, {
      method: 'PUT', body: values,
    }),
    remove: (id, entity, recordId) => request(`/apps/${id}/entities/${entity}/records/${recordId}`, {
      method: 'DELETE',
    }),
  },

  export: {
    project: (id) => request(`/apps/${id}/export`),
    csv: async (appId, entity, rows, fields) => {
      const header = fields.map((f) => `"${f.label}"`).join(',');
      const lines = rows.map((row) => {
        return fields.map((f) => {
          const val = row[f.name];
          const str = Array.isArray(val) ? val.join('; ') : String(val ?? '');
          return `"${str.replace(/"/g, '""')}"`;
        }).join(',');
      });
      return [header, ...lines].join('\n');
    },
  },
};
