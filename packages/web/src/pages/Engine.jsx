/**
 * Ecran « Moteur d'IA ».
 *
 * Il documente l'independance du moteur : d'ou vient son raisonnement, ce
 * qu'il sait faire, et la garantie qu'aucun service externe n'est appele.
 */

import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Topbar, Loading, ErrorState } from '../components/Shell.jsx';
import { api } from '../lib/api.js';

const PIPELINE = [
  {
    icon: 'list',
    title: '1 · Analyse linguistique',
    text: "Normalisation du texte (accents, ponctuation), decoupage en mots, "
      + "n-grammes et tolerance aux fautes de frappe. Le francais et l'anglais sont traites nativement.",
  },
  {
    icon: 'target',
    title: "2 · Detection d'intention",
    text: "Un classifieur pondere determine ce que vous demandez : creer une application, "
      + 'ajouter une table ou un champ, activer une vue, changer le theme, ou poser une question.',
  },
  {
    icon: 'database',
    title: '3 · Extraction et connaissance metier',
    text: "Le moteur identifie le domaine, les entites et les champs cites, puis les confronte a "
      + 'sa base de connaissance de domaines pour completer ce que vous n\'avez pas precise.',
  },
  {
    icon: 'layout',
    title: '4 · Planification',
    text: "Un AppSpec est construit ou modifie : tables, champs types, relations, pages, "
      + 'vues et tableau de bord. Le resultat est valide puis auto-corrige si necessaire.',
  },
  {
    icon: 'code',
    title: '5 · Synthese',
    text: "Le spec est rendu a l'ecran par le runtime et traduit en code source : schema SQL, "
      + 'API Express, composants React et types TypeScript.',
  },
];

export default function EnginePage() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setError(null);
    try {
      setInfo(await api.engine());
    } catch (err) {
      setError(err);
    }
  }

  return (
    <div className="main">
      <Topbar title="Moteur d'IA" subtitle="Architecture et garanties d'independance" />

      <div className="content">
        <div className="content__inner stack">
          {error && <ErrorState error={error} onRetry={load} />}
          {!info && !error && <Loading />}

          {info && (
            <>
              <div className="card">
                <div className="card__header">
                  <span className="brand-mark" style={{ width: 26, height: 26, fontSize: 10 }}>IA</span>
                  <div className="grow">
                    <h2>{info.name}</h2>
                    <p className="small faint">Version {info.version} · fournisseur « {info.provider} »</p>
                  </div>
                  {info.independent && (
                    <span className="badge badge--success">
                      <Icon name="shield" size={12} />Totalement independant
                    </span>
                  )}
                </div>

                <div className="card__body">
                  <div className="grid grid--stats">
                    <Stat
                      icon="shield"
                      label="Modeles tiers utilises"
                      value="0"
                      hint="Aucune IA externe"
                    />
                    <Stat
                      icon="cpu"
                      label="Appels reseau sortants"
                      value={String(info.externalCalls)}
                      hint="Fonctionne hors ligne"
                    />
                    <Stat
                      icon="grid"
                      label="Domaines metier"
                      value={String(info.knowledge.domains)}
                      hint="Base de connaissance locale"
                    />
                    <Stat
                      icon="database"
                      label="Modeles d'entites"
                      value={String(info.knowledge.entities)}
                      hint="Prets a l'emploi"
                    />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <Icon name="shield" size={16} />
                  <h3>Ce que « independant » signifie ici</h3>
                </div>
                <div className="card__body stack" style={{ gap: 12 }}>
                  <Point ok>
                    Le moteur est un paquet <code className="mono">@base44/engine</code> sans
                    aucune dependance npm : son raisonnement est integralement ecrit dans ce projet.
                  </Point>
                  <Point ok>
                    Il n'appelle aucun service d'IA tiers et ne requiert aucune cle d'API.
                    L'application fonctionne sans connexion Internet.
                  </Point>
                  <Point ok>
                    Vos descriptions et vos donnees ne quittent jamais votre serveur.
                  </Point>
                  <Point>
                    Il s'agit d'un moteur symbolique specialise dans la generation
                    d'applications : c'est ce qui le rend autonome et previsible, mais il ne
                    tient pas une conversation de culture generale comme un grand modele de langage.
                  </Point>
                  <Point>
                    Une couche d'adaptateurs permet de brancher plus tard un modele externe, sans
                    rien changer au reste de l'application. Tant qu'aucun adaptateur n'est
                    enregistre, l'IA reste 100 % autonome.
                  </Point>
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <Icon name="cpu" size={16} />
                  <h3>Comment le moteur raisonne</h3>
                </div>
                <div className="card__body stack">
                  {PIPELINE.map((step) => (
                    <div key={step.title} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                      <div className="empty__icon" style={{ width: 34, height: 34, flexShrink: 0 }}>
                        <Icon name={step.icon} size={16} />
                      </div>
                      <div>
                        <strong>{step.title}</strong>
                        <p className="small muted" style={{ marginTop: 3 }}>{step.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <Icon name="list" size={16} />
                  <h3>Fournisseurs enregistres</h3>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Nom</th>
                        <th>Type</th>
                        <th>Hors ligne</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {info.providers.map((provider) => (
                        <tr key={provider.name}>
                          <td><strong>{provider.name}</strong></td>
                          <td>
                            <span className={`badge ${provider.external ? 'badge--warning' : 'badge--success'}`}>
                              {provider.external ? 'Externe' : 'Natif'}
                            </span>
                          </td>
                          <td>{provider.offline ? 'Oui' : 'Non'}</td>
                          <td className="muted small">{provider.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint }) {
  return (
    <div className="stat">
      <div className="stat__label"><Icon name={icon} size={13} />{label}</div>
      <div className="stat__value">{value}</div>
      {hint && <p className="small faint" style={{ marginTop: 2 }}>{hint}</p>}
    </div>
  );
}

function Point({ children, ok }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 9 }}>
      <Icon
        name={ok ? 'check' : 'info'}
        size={15}
        style={{ marginTop: 3, flexShrink: 0, color: ok ? 'var(--success)' : 'var(--text-faint)' }}
      />
      <p className="small">{children}</p>
    </div>
  );
}
