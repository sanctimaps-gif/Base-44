/** Catalogue des domaines metier connus par le moteur. */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Topbar, Loading, ErrorState } from '../components/Shell.jsx';
import { api } from '../lib/api.js';

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setError(null);
    try {
      setTemplates(await api.templates());
    } catch (err) {
      setError(err);
    }
  }

  async function useTemplate(template) {
    setCreating(template.id);
    try {
      const { app } = await api.apps.create({ prompt: template.prompt });
      navigate(`/apps/${app.id}`);
    } catch (err) {
      setError(err);
      setCreating(null);
    }
  }

  return (
    <div className="main">
      <Topbar
        title="Modeles"
        subtitle="Les domaines que le moteur sait construire immediatement"
      />

      <div className="content">
        <div className="content__inner">
          {error && <ErrorState error={error} onRetry={load} />}
          {!templates && !error && <Loading />}

          {templates && (
            <>
              <p className="muted" style={{ marginBottom: 18, maxWidth: 640 }}>
                Ces {templates.length} domaines sont encodes dans la base de connaissance de l'IA.
                Choisissez-en un pour demarrer, puis affinez l'application en discutant avec le moteur.
                Vous pouvez aussi decrire tout autre besoin : le moteur construira un modele sur mesure.
              </p>

              <div className="grid grid--apps">
                {templates.map((template) => (
                  <div key={template.id} className="app-card" style={{ cursor: 'default' }}>
                    <div
                      className="app-card__icon"
                      style={{ background: `${template.color}1f`, color: template.color }}
                    >
                      <Icon name={template.icon} size={18} />
                    </div>

                    <div>
                      <div className="app-card__name">{template.label}</div>
                      <p className="small muted" style={{ marginTop: 4 }}>
                        {template.entities.map((e) => e.label).join(' · ')}
                      </p>
                    </div>

                    <div className="app-card__meta">
                      <span>
                        <Icon name="database" size={12} /> {template.entities.length} table(s)
                      </span>
                      <span>
                        <Icon name="columns" size={12} />{' '}
                        {template.entities.reduce((sum, e) => sum + e.fieldCount, 0)} champs
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => useTemplate(template)}
                      disabled={creating !== null}
                    >
                      {creating === template.id
                        ? <span className="spinner" />
                        : <Icon name="sparkles" size={14} />}
                      {creating === template.id ? 'Construction…' : 'Utiliser ce modele'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
