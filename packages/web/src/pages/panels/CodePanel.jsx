/**
 * Onglet « Code » : le code source reellement genere par le moteur.
 * Chaque fichier est copiable, et l'ensemble est telechargeable en un lot.
 */

import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Loading, ErrorState } from '../../components/Shell.jsx';
import { api } from '../../lib/api.js';

export default function CodePanel({ appId }) {
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { load(); }, [appId]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  async function load() {
    setError(null);
    setProject(null);
    try {
      const result = await api.export.project(appId);
      setProject(result);
      setActive(Object.keys(result.files)[0]);
    } catch (err) {
      setError(err);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(project.files[active]);
      setCopied(true);
    } catch {
      // Presse-papiers indisponible (contexte non securise) : on ignore.
    }
  }

  /** Telecharge tous les fichiers dans une archive texte lisible. */
  function downloadAll() {
    const bundle = Object.entries(project.files)
      .map(([path, content]) => `${'='.repeat(78)}\n=== ${path}\n${'='.repeat(78)}\n\n${content}`)
      .join('\n\n');

    const blob = new Blob([bundle], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/[^\w-]+/g, '-').toLowerCase()}-source.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (error) return <div className="content__inner"><ErrorState error={error} onRetry={load} /></div>;
  if (!project) return <Loading label="Generation du code source…" />;

  const paths = Object.keys(project.files);

  return (
    <div className="code">
      <div className="code__files">
        <div className="row row--between" style={{ padding: '4px 6px 8px' }}>
          <span className="small faint">{project.fileCount} fichiers</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={downloadAll} title="Tout telecharger">
            <Icon name="download" size={13} />
          </button>
        </div>

        {paths.map((path) => (
          <button
            key={path}
            type="button"
            className={`code__file ${path === active ? 'is-active' : ''}`}
            onClick={() => setActive(path)}
            title={path}
          >
            {path}
          </button>
        ))}
      </div>

      <div className="code__view">
        <div
          className="row row--between"
          style={{
            padding: '9px 16px',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            background: 'var(--surface)',
            zIndex: 1,
          }}
        >
          <code className="mono">{active}</code>
          <button type="button" className="btn btn--sm" onClick={copy}>
            <Icon name={copied ? 'check' : 'copy'} size={13} />
            {copied ? 'Copie' : 'Copier'}
          </button>
        </div>
        <pre>{project.files[active]}</pre>
      </div>
    </div>
  );
}
