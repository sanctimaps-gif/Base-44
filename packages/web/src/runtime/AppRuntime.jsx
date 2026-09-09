/**
 * Runtime d'application.
 *
 * Interprete un AppSpec et affiche l'application generee, avec sa navigation,
 * ses vues et ses formulaires. C'est ce composant qui donne la previsualisation
 * « vivante » du studio et l'application publiee.
 */

import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import RecordForm from './RecordForm.jsx';
import {
  ListView, KanbanView, GalleryView, CalendarView, DashboardView, EmptyState, recordLabel,
} from './views.jsx';

export default function AppRuntime({
  spec,
  data,
  onCreate,
  onUpdate,
  onDelete,
  readOnly = false,
  compact = false,
}) {
  const pages = spec.pages || [];
  const navPages = pages.filter((p) => p.showInNav !== false);

  const [activeId, setActiveId] = useState(() => navPages[0]?.id);
  const [editing, setEditing] = useState(null); // { entity, record|null }
  const [confirming, setConfirming] = useState(null);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [search, setSearch] = useState('');

  // Le spec peut changer sous nos pieds (l'IA modifie l'application en direct).
  useEffect(() => {
    if (!pages.some((p) => p.id === activeId)) {
      setActiveId(navPages[0]?.id);
    }
  }, [spec, activeId, pages, navPages]);

  // Raccourcis clavier : Escape pour fermer, Ctrl+N pour créer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (editing) setEditing(null);
        if (confirming) setConfirming(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && entity && !readOnly) {
        e.preventDefault();
        setEditing({ entity, record: null });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editing, confirming, entity, readOnly]);

  const page = pages.find((p) => p.id === activeId) || pages[0];
  const entity = page?.entity ? spec.entities.find((e) => e.name === page.entity) : null;

  // Index des entites liees, pour resoudre les relations a l'affichage.
  const related = useMemo(() => {
    const map = {};
    for (const e of spec.entities) {
      map[e.name] = { entity: e, rows: data[e.name] || [] };
    }
    return map;
  }, [spec, data]);

  // Options des listes deroulantes de relation.
  const relationOptions = useMemo(() => {
    const map = {};
    for (const e of spec.entities) {
      map[e.name] = (data[e.name] || []).map((row) => ({
        id: row.id,
        __label: recordLabel(e, row),
      }));
    }
    return map;
  }, [spec, data]);

  const rows = useMemo(() => {
    if (!entity) return [];
    const all = data[entity.name] || [];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((row) => Object.values(row).some(
      (v) => String(v ?? '').toLowerCase().includes(needle),
    ));
  }, [entity, data, search]);

  async function handleSubmit(values) {
    setSaving(true);
    try {
      if (editing.record) {
        await onUpdate?.(editing.entity, editing.record.id, values);
      } else {
        await onCreate?.(editing.entity, values);
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await onDelete?.(confirming.entity, confirming.record.id);
    setConfirming(null);
  }

  if (!page) {
    return <EmptyState icon="layout" title="Cette application n'a aucune page." />;
  }

  return (
    <div className="runtime">
      <nav className="runtime__nav">
        <div className="runtime__brand">
          <span className="brand-mark" style={{ width: 22, height: 22, fontSize: 10 }}>
            {spec.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="cell-truncate">{spec.name}</span>
        </div>

        {navPages.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${item.id === page.id ? 'is-active' : ''}`}
            onClick={() => { setActiveId(item.id); setSearch(''); }}
          >
            <Icon name={item.icon || 'database'} size={15} />
            <span className="cell-truncate">{item.name}</span>
            {item.entity && (
              <span className="nav-item__count">{(data[item.entity] || []).length}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="runtime__main">
        <header className="runtime__header">
          <div className="grow">
            <h1>{page.name}</h1>
            {entity && (
              <p className="small faint">
                {rows.length} enregistrement(s)
                {search && ` sur ${(data[entity.name] || []).length}`}
              </p>
            )}
          </div>

          {entity && !compact && (
            <div className="row" style={{ position: 'relative' }}>
              <Icon
                name="search"
                size={14}
                style={{ position: 'absolute', left: 10, color: 'var(--text-faint)' }}
              />
              <input
                className="input"
                style={{ paddingLeft: 30, width: 200 }}
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {entity && !readOnly && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setEditing({ entity, record: null })}
            >
              <Icon name="plus" size={14} />
              Ajouter
            </button>
          )}
        </header>

        <PageBody
          page={page}
          entity={entity}
          spec={spec}
          rows={rows}
          data={data}
          related={related}
          readOnly={readOnly}
          month={month}
          onMonthChange={setMonth}
          onEdit={(record) => !readOnly && setEditing({ entity, record })}
          onDelete={(record) => setConfirming({ entity, record })}
          onOpenEntity={(target) => {
            const listPage = pages.find((p) => p.entity === target.name && p.type === 'list');
            if (listPage) setActiveId(listPage.id);
          }}
        />
      </div>

      {editing && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal__header">
              <Icon name={editing.entity.icon} size={16} />
              <h2 style={{ marginLeft: 8 }}>
                {editing.record ? `Modifier — ${editing.entity.label}` : `Nouveau — ${editing.entity.label}`}
              </h2>
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                style={{ marginLeft: 'auto' }}
                onClick={() => setEditing(null)}
                aria-label="Fermer"
              >
                <Icon name="x" size={15} />
              </button>
            </div>
            <RecordForm
              entity={editing.entity}
              record={editing.record}
              entities={relationOptions}
              saving={saving}
              onSubmit={handleSubmit}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}

      {confirming && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setConfirming(null)}>
          <div className="modal" style={{ maxWidth: 400 }} role="dialog" aria-modal="true">
            <div className="modal__header"><h2>Supprimer cet enregistrement ?</h2></div>
            <div className="modal__body">
              <p className="muted">
                « {recordLabel(confirming.entity, confirming.record)} » sera definitivement supprime.
              </p>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn" onClick={() => setConfirming(null)}>Annuler</button>
              <button type="button" className="btn btn--danger" onClick={handleDelete}>
                <Icon name="trash" size={14} />Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Selectionne la vue correspondant au type de page. */
function PageBody({
  page, entity, spec, rows, data, related, readOnly,
  month, onMonthChange, onEdit, onDelete, onOpenEntity,
}) {
  if (page.type === 'dashboard') {
    return <DashboardView spec={spec} page={page} data={data} onOpenEntity={onOpenEntity} />;
  }

  if (!entity) {
    return <EmptyState icon="layout" title="Cette page n'est reliee a aucune table." />;
  }

  switch (page.type) {
    case 'kanban':
      return <KanbanView entity={entity} rows={rows} onEdit={onEdit} />;
    case 'gallery':
      return <GalleryView entity={entity} rows={rows} onEdit={onEdit} />;
    case 'calendar':
      return (
        <CalendarView
          entity={entity}
          rows={rows}
          onEdit={onEdit}
          month={month}
          onMonthChange={onMonthChange}
        />
      );
    default:
      return (
        <ListView
          entity={entity}
          rows={rows}
          related={related}
          readOnly={readOnly}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );
  }
}
