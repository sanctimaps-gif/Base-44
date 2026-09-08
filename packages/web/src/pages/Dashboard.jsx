/** Ecran d'accueil : composer une nouvelle application ou ouvrir une existante. */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Topbar, Loading, ErrorState, Toast } from '../components/Shell.jsx';
import { api } from '../lib/api.js';
import { relativeTime } from '../lib/format.js';

const EXAMPLES = [
  'Une application de gestion de clients avec un suivi des factures',
  'Un outil de suivi de projets et de taches avec un kanban',
  'Une boutique en ligne avec catalogue et commandes',
  'Un planning de reservations pour un salon de coiffure',
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [apps, setApps] = useState(null);
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const [menuFor, setMenuFor] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => { load(); }, []);

  // Le toast disparait tout seul.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function load() {
    setError(null);
    try {
      setApps(await api.apps.list());
    } catch (err) {
      setError(err);
    }
  }

  async function handleCreate(text) {
    const description = String(text ?? prompt).trim();
    if (!description || creating) return;

    setCreating(true);
    setError(null);
    try {
      const { app } = await api.apps.create({ prompt: description });
      navigate(`/apps/${app.id}`);
    } catch (err) {
      setError(err);
      setCreating(false);
    }
  }

  async function handleDuplicate(app) {
    setMenuFor(null);
    try {
      await api.apps.duplicate(app.id);
      setToast('Application dupliquee.');
      load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function handleDelete(app) {
    setMenuFor(null);
    try {
      await api.apps.remove(app.id);
      setToast('Application supprimee.');
      load();
    } catch (err) {
      setToast(err.message);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleCreate();
    }
  }

  return (
    <div className="main">
      <Topbar title="Mes applications" subtitle="Decrivez une idee, l'IA la construit" />

      <div className="content">
        <div className="content__inner">
          <section className="hero">
            <h1>Que voulez-vous construire aujourd'hui ?</h1>
            <p>
              Decrivez votre application en francais courant. Le moteur de Base 44 concoit le
              modele de donnees, les pages et l'interface, puis vous laisse tout ajuster.
            </p>

            <div className="hero__composer">
              <div className="composer">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={prompt}
                  placeholder="Ex. : une application de gestion de clients avec un suivi des factures…"
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={creating}
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => handleCreate()}
                  disabled={creating || !prompt.trim()}
                >
                  {creating ? <span className="spinner" /> : <Icon name="sparkles" size={14} />}
                  {creating ? 'Construction…' : 'Creer'}
                </button>
              </div>

              <div className="row wrap" style={{ marginTop: 10 }}>
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="chip"
                    disabled={creating}
                    onClick={() => { setPrompt(example); textareaRef.current?.focus(); }}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {error && <ErrorState error={error} onRetry={load} />}

          {apps === null && !error && <Loading label="Chargement de vos applications…" />}

          {apps && apps.length === 0 && !error && (
            <div className="empty">
              <div className="empty__icon"><Icon name="grid" size={20} /></div>
              <strong>Aucune application pour l'instant</strong>
              <p className="small muted">Utilisez le champ ci-dessus pour creer la premiere.</p>
            </div>
          )}

          {apps && apps.length > 0 && (
            <>
              <div className="row row--between" style={{ marginBottom: 14 }}>
                <h2>{apps.length} application{apps.length > 1 ? 's' : ''}</h2>
                <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
                  <Icon name="refresh" size={13} />Actualiser
                </button>
              </div>

              <div className="grid grid--apps">
                {apps.map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    menuOpen={menuFor === app.id}
                    onToggleMenu={() => setMenuFor(menuFor === app.id ? null : app.id)}
                    onOpen={() => navigate(`/apps/${app.id}`)}
                    onDuplicate={() => handleDuplicate(app)}
                    onDelete={() => handleDelete(app)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

function AppCard({ app, menuOpen, onToggleMenu, onOpen, onDuplicate, onDelete }) {
  return (
    <div className="app-card" style={{ position: 'relative' }}>
      <div className="row row--between">
        <div
          className="app-card__icon"
          style={app.theme?.primary ? {
            background: `${app.theme.primary}1f`,
            color: app.theme.primary,
          } : undefined}
        >
          <Icon name={app.icon} size={18} />
        </div>

        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label="Actions"
          onClick={onToggleMenu}
        >
          <Icon name="chevron-down" size={15} />
        </button>
      </div>

      <button
        type="button"
        onClick={onOpen}
        style={{
          border: 0, background: 'none', padding: 0, textAlign: 'left',
          font: 'inherit', color: 'inherit', cursor: 'pointer',
        }}
      >
        <div className="app-card__name">{app.name}</div>
        <p className="app-card__desc">{app.description || 'Sans description.'}</p>
      </button>

      <div className="app-card__meta">
        <span><Icon name="database" size={12} /> {app.entityCount} table(s)</span>
        <span><Icon name="layout" size={12} /> {app.pageCount} page(s)</span>
        <span style={{ marginLeft: 'auto' }}>{relativeTime(app.updatedAt)}</span>
      </div>

      {menuOpen && (
        <div
          className="card"
          style={{
            position: 'absolute', top: 46, right: 12, zIndex: 10,
            boxShadow: 'var(--shadow-lg)', padding: 5, minWidth: 168,
          }}
        >
          <button type="button" className="nav-item" onClick={onOpen}>
            <Icon name="eye" size={14} />Ouvrir
          </button>
          <button type="button" className="nav-item" onClick={onDuplicate}>
            <Icon name="copy" size={14} />Dupliquer
          </button>
          <button
            type="button"
            className="nav-item"
            style={{ color: 'var(--danger)' }}
            onClick={onDelete}
          >
            <Icon name="trash" size={14} />Supprimer
          </button>
        </div>
      )}
    </div>
  );
}
