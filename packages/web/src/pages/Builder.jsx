/**
 * Studio de construction.
 *
 * A gauche : la conversation avec le moteur d'IA.
 * A droite : l'application generee (apercu vivant, donnees, code, structure).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Topbar, Loading, ErrorState, Toast } from '../components/Shell.jsx';
import AppRuntime from '../runtime/AppRuntime.jsx';
import { api } from '../lib/api.js';
import { useTheme } from '../lib/theme.jsx';
import { relativeTime, splitBold } from '../lib/format.js';
import SchemaPanel from './panels/SchemaPanel.jsx';
import CodePanel from './panels/CodePanel.jsx';

const TABS = [
  { id: 'preview', label: 'Apercu', icon: 'eye' },
  { id: 'schema', label: 'Structure', icon: 'database' },
  { id: 'code', label: 'Code', icon: 'code' },
];

export default function Builder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { applySpecTheme } = useTheme();

  const [app, setApp] = useState(null);
  const [data, setData] = useState({});
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('preview');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [toast, setToast] = useState('');

  const logRef = useRef(null);
  const composerRef = useRef(null);

  const messages = app?.messages || [];

  useEffect(() => { load(); }, [id]);

  // La couleur du studio suit celle de l'application ouverte.
  useEffect(() => {
    if (app?.spec?.theme) applySpecTheme(app.spec.theme);
    return () => applySpecTheme(null);
  }, [app?.spec?.theme, applySpecTheme]);

  // On garde la conversation calee en bas.
  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, sending]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function load() {
    setError(null);
    try {
      const [loaded, records] = await Promise.all([api.apps.get(id), api.data.all(id)]);
      setApp(loaded);
      setData(records);

      const lastAssistant = [...(loaded.messages || [])].reverse().find((m) => m.role === 'assistant');
      setSuggestions(lastAssistant?.suggestions || []);
    } catch (err) {
      setError(err);
    }
  }

  const refreshData = useCallback(async () => {
    try {
      setData(await api.data.all(id));
    } catch (err) {
      setToast(err.message);
    }
  }, [id]);

  async function send(text) {
    const message = String(text ?? input).trim();
    if (!message || sending) return;

    setInput('');
    setSending(true);

    // Affichage optimiste : le message de l'utilisateur apparait immediatement.
    setApp((current) => ({
      ...current,
      messages: [...(current.messages || []), { role: 'user', content: message, at: new Date().toISOString() }],
    }));

    try {
      const result = await api.chat.send(id, message);
      setApp(result.app);
      setSuggestions(result.suggestions || []);
      if (result.specChanged) {
        await refreshData();
        setToast('Application mise a jour.');
      }
    } catch (err) {
      setToast(err.message);
      // On recharge pour ne pas rester sur un etat optimiste faux.
      load();
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  // --- Operations sur les donnees de l'application generee ---------------

  const handleCreate = useCallback(async (entity, values) => {
    try {
      await api.data.create(id, entity.name, values);
      await refreshData();
      setToast('Enregistrement cree.');
    } catch (err) {
      setToast(err.details?.join(' ') || err.message);
      throw err;
    }
  }, [id, refreshData]);

  const handleUpdate = useCallback(async (entity, recordId, values) => {
    try {
      await api.data.update(id, entity.name, recordId, values);
      await refreshData();
      setToast('Enregistrement mis a jour.');
    } catch (err) {
      setToast(err.details?.join(' ') || err.message);
      throw err;
    }
  }, [id, refreshData]);

  const handleDelete = useCallback(async (entity, recordId) => {
    try {
      await api.data.remove(id, entity.name, recordId);
      await refreshData();
      setToast('Enregistrement supprime.');
    } catch (err) {
      setToast(err.message);
    }
  }, [id, refreshData]);

  async function handleSeed() {
    try {
      await api.apps.seed(id, 8);
      await refreshData();
      setToast("Donnees d'exemple regenerees.");
    } catch (err) {
      setToast(err.message);
    }
  }

  const stats = useMemo(() => {
    if (!app?.spec) return null;
    const records = Object.values(data).reduce((sum, rows) => sum + rows.length, 0);
    return {
      entities: app.spec.entities.length,
      pages: app.spec.pages.length,
      records,
    };
  }, [app, data]);

  if (error) {
    return (
      <div className="main">
        <Topbar title="Application" back="/" />
        <div className="content"><div className="content__inner">
          <ErrorState error={error} onRetry={load} />
        </div></div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="main">
        <Topbar title="Chargement…" back="/" />
        <div className="content"><Loading /></div>
      </div>
    );
  }

  return (
    <div className="main">
      <Topbar
        title={app.spec.name}
        subtitle={stats && `${stats.entities} table(s) · ${stats.pages} page(s) · ${stats.records} enregistrement(s)`}
        back="/"
      >
        <button type="button" className="btn btn--sm" onClick={handleSeed}>
          <Icon name="refresh" size={13} />Donnees d'exemple
        </button>
        <button
          type="button"
          className="btn btn--sm btn--primary"
          onClick={() => navigate(`/apps/${id}/preview`)}
        >
          <Icon name="play" size={13} />Ouvrir l'application
        </button>
      </Topbar>

      <div className="builder">
        {/* ---------------------------------------------------- Conversation */}
        <section className="chat">
          <div className="chat__header">
            <span className="brand-mark" style={{ width: 24, height: 24, fontSize: 10 }}>IA</span>
            <div className="grow">
              <strong style={{ fontSize: 13.5 }}>Moteur Base 44</strong>
              <p className="small faint">Autonome · hors ligne</p>
            </div>
          </div>

          <div className="chat__log" ref={logRef}>
            {messages.length === 0 && (
              <Message
                role="assistant"
                content={"Bonjour ! Dites-moi ce que vous voulez ajouter ou modifier dans cette application."}
              />
            )}

            {messages.map((message, index) => (
              <Message
                key={`${message.at}-${index}`}
                role={message.role}
                content={message.content}
                changes={message.changes}
                at={message.at}
              />
            ))}

            {sending && (
              <div className="msg msg--ai">
                <div className="msg__avatar">IA</div>
                <div className="msg__bubble">
                  <span className="typing"><span /><span /><span /></span>
                </div>
              </div>
            )}
          </div>

          {suggestions.length > 0 && !sending && (
            <div className="chat__suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="chip"
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="chat__composer">
            <div className="composer">
              <textarea
                ref={composerRef}
                rows={1}
                value={input}
                placeholder="Ajoute un champ, une table, une vue…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
              />
              <button
                type="button"
                className="btn btn--primary btn--icon"
                onClick={() => send()}
                disabled={sending || !input.trim()}
                aria-label="Envoyer"
              >
                <Icon name="send" size={15} />
              </button>
            </div>
            <p className="small faint" style={{ marginTop: 7 }}>
              Entree pour envoyer · Maj+Entree pour un saut de ligne
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------- Apercu */}
        <section className="preview">
          <div className="preview__tabs">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`tab ${tab === item.id ? 'is-active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                <Icon name={item.icon} size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="preview__body">
            {tab === 'preview' && (
              <AppRuntime
                spec={app.spec}
                data={data}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                compact
              />
            )}
            {tab === 'schema' && <SchemaPanel spec={app.spec} data={data} />}
            {tab === 'code' && <CodePanel appId={id} />}
          </div>
        </section>
      </div>

      <Toast message={toast} />
    </div>
  );
}

/** Bulle de conversation, avec rendu du Markdown simple du moteur. */
function Message({ role, content, changes, at }) {
  const isUser = role === 'user';

  return (
    <div className={`msg ${isUser ? 'msg--user' : 'msg--ai'}`}>
      <div className="msg__avatar">{isUser ? 'V' : 'IA'}</div>
      <div className="msg__bubble">
        <RichText text={content} />

        {!isUser && changes?.length > 0 && (
          <div className="msg__changes">
            {changes.filter((c) => c.kind !== 'noop').map((c, i) => (
              <span key={`${c.kind}-${i}`} className="badge badge--accent">
                <Icon name={iconForChange(c.kind)} size={11} />
                {labelForChange(c.kind)}
              </span>
            ))}
          </div>
        )}

        {at && <div className="small faint" style={{ marginTop: 5 }}>{relativeTime(at)}</div>}
      </div>
    </div>
  );
}

function iconForChange(kind) {
  return {
    app: 'sparkles', entity: 'database', field: 'columns',
    page: 'layout', theme: 'sun', data: 'refresh', domain: 'grid',
  }[kind] || 'check';
}

function labelForChange(kind) {
  return {
    app: 'Application', entity: 'Table', field: 'Champ',
    page: 'Page', theme: 'Theme', data: 'Donnees', domain: 'Domaine',
  }[kind] || 'Modification';
}

/**
 * Rendu du sous-ensemble Markdown produit par le moteur : paragraphes, listes
 * et **gras**. Tout est rendu via React (aucun HTML brut injecte).
 */
function RichText({ text }) {
  const blocks = String(text || '').split(/\n{2,}/);

  return blocks.map((block, blockIndex) => {
    const lines = block.split('\n').filter(Boolean);
    const isList = lines.length > 0 && lines.every((line) => /^\s*[-*]\s+/.test(line));

    if (isList) {
      return (
        <ul key={blockIndex}>
          {lines.map((line, i) => (
            <li key={i}><Bold text={line.replace(/^\s*[-*]\s+/, '')} /></li>
          ))}
        </ul>
      );
    }

    return (
      <p key={blockIndex}>
        {lines.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            <Bold text={line} />
          </span>
        ))}
      </p>
    );
  });
}

function Bold({ text }) {
  return splitBold(text).map((part, index) => (
    part.bold
      ? <strong key={index}>{part.text}</strong>
      : <span key={index}>{part.text}</span>
  ));
}
