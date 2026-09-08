/** Parametres du studio : apparence et etat du service. */

import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Topbar } from '../components/Shell.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';

const ACCENTS = [
  { name: 'Bleu', value: '#2563eb' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Emeraude', value: '#059669' },
  { name: 'Vert', value: '#16a34a' },
  { name: 'Ambre', value: '#d97706' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Turquoise', value: '#0d9488' },
];

export default function Settings() {
  const { mode, setMode, accent, applySpecTheme } = useTheme();
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.health().then(setHealth).catch((err) => setHealth({ status: 'error', error: err.message }));
  }, []);

  return (
    <div className="main">
      <Topbar title="Parametres" subtitle="Apparence du studio et etat du service" />

      <div className="content">
        <div className="content__inner stack" style={{ maxWidth: 720 }}>
          <div className="card">
            <div className="card__header">
              <Icon name="sun" size={16} />
              <h3>Apparence</h3>
            </div>
            <div className="card__body">
              <div className="field">
                <span className="field__label">Mode d'affichage</span>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className={`btn ${mode === 'light' ? 'btn--primary' : ''}`}
                    onClick={() => setMode('light')}
                  >
                    <Icon name="sun" size={14} />Clair
                  </button>
                  <button
                    type="button"
                    className={`btn ${mode === 'dark' ? 'btn--primary' : ''}`}
                    onClick={() => setMode('dark')}
                  >
                    <Icon name="moon" size={14} />Sombre
                  </button>
                </div>
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <span className="field__label">Couleur d'accent par defaut</span>
                <p className="small faint" style={{ marginBottom: 8 }}>
                  A l'ouverture d'une application, le studio adopte automatiquement la couleur
                  definie dans son theme.
                </p>
                <div className="row wrap" style={{ gap: 8 }}>
                  {ACCENTS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      title={option.name}
                      aria-label={option.name}
                      onClick={() => applySpecTheme({ primary: option.value })}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        background: option.value,
                        border: accent === option.value
                          ? '2px solid var(--text)'
                          : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <Icon name="info" size={16} />
              <h3>Etat du service</h3>
            </div>
            <div className="card__body">
              <div className="row row--between" style={{ marginBottom: 10 }}>
                <span className="muted small">API</span>
                {health?.status === 'ok'
                  ? <span className="badge badge--success"><span className="dot" />Operationnelle</span>
                  : <span className="badge badge--danger"><span className="dot" />Indisponible</span>}
              </div>
              <div className="row row--between" style={{ marginBottom: 10 }}>
                <span className="muted small">Moteur d'IA</span>
                <span className="badge badge--success">
                  <Icon name="shield" size={11} />Local, sans dependance externe
                </span>
              </div>
              <div className="row row--between">
                <span className="muted small">Stockage</span>
                <span className="badge">Fichiers JSON sur le serveur</span>
              </div>
              {health?.error && (
                <p className="small" style={{ color: 'var(--danger)', marginTop: 10 }}>
                  {health.error}
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <Icon name="shield" size={16} />
              <h3>Confidentialite</h3>
            </div>
            <div className="card__body">
              <p className="small muted">
                Vos descriptions et vos donnees restent sur votre serveur. Le moteur ne transmet
                rien a l'exterieur : il n'effectue aucune requete reseau et ne depend d'aucune
                cle d'API. Vous pouvez couper la connexion Internet, Base 44 continue de
                fonctionner.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
