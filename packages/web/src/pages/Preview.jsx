/**
 * Application generee en plein ecran, sans le studio autour.
 * C'est la vue que verrait un utilisateur final.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Topbar, Loading, ErrorState, Toast, ThemeToggle } from '../components/Shell.jsx';
import AppRuntime from '../runtime/AppRuntime.jsx';
import { api } from '../lib/api.js';
import { useTheme } from '../lib/theme.jsx';

export default function Preview() {
  const { id } = useParams();
  const { applySpecTheme } = useTheme();

  const [app, setApp] = useState(null);
  const [data, setData] = useState({});
  const [error, setError] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (app?.spec?.theme) applySpecTheme(app.spec.theme);
    return () => applySpecTheme(null);
  }, [app?.spec?.theme, applySpecTheme]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  async function load() {
    setError(null);
    try {
      const [loaded, records] = await Promise.all([api.apps.get(id), api.data.all(id)]);
      setApp(loaded);
      setData(records);
    } catch (err) {
      setError(err);
    }
  }

  const refresh = useCallback(async () => {
    setData(await api.data.all(id));
  }, [id]);

  const onCreate = useCallback(async (entity, values) => {
    try {
      await api.data.create(id, entity.name, values);
      await refresh();
      setToast('Enregistrement cree.');
    } catch (err) {
      setToast(err.details?.join(' ') || err.message);
      throw err;
    }
  }, [id, refresh]);

  const onUpdate = useCallback(async (entity, recordId, values) => {
    try {
      await api.data.update(id, entity.name, recordId, values);
      await refresh();
      setToast('Enregistrement mis a jour.');
    } catch (err) {
      setToast(err.details?.join(' ') || err.message);
      throw err;
    }
  }, [id, refresh]);

  const onDelete = useCallback(async (entity, recordId) => {
    try {
      await api.data.remove(id, entity.name, recordId);
      await refresh();
      setToast('Enregistrement supprime.');
    } catch (err) {
      setToast(err.message);
    }
  }, [id, refresh]);

  if (error) {
    return (
      <div className="main">
        <Topbar title="Application" back={`/apps/${id}`} />
        <div className="content"><div className="content__inner">
          <ErrorState error={error} onRetry={load} />
        </div></div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="main">
        <Topbar title="Chargement…" back={`/apps/${id}`} />
        <div className="content"><Loading /></div>
      </div>
    );
  }

  return (
    <div className="main">
      <Topbar
        title={app.spec.name}
        subtitle="Application en fonctionnement"
        back={`/apps/${id}`}
      >
        <span className="badge badge--success"><span className="dot" />En ligne</span>
        <div style={{ width: 150 }}><ThemeToggle /></div>
        <button type="button" className="btn btn--sm" onClick={load}>
          <Icon name="refresh" size={13} />Actualiser
        </button>
      </Topbar>

      <div className="content content--flush">
        <AppRuntime
          spec={app.spec}
          data={data}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </div>

      <Toast message={toast} />
    </div>
  );
}
