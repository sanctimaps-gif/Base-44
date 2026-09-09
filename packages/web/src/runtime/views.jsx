/**
 * Vues du runtime : liste, kanban, galerie, calendrier, tableau de bord.
 *
 * Toutes se construisent a partir du spec — aucune vue n'est ecrite a la main
 * pour une application donnee.
 */

import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { formatValue, statusTone } from '../lib/format.js';

/** Libelle lisible d'un enregistrement (utilise partout : cartes, relations). */
export function recordLabel(entity, record) {
  if (!record) return '—';
  const title = entity.display?.titleField;
  if (title && record[title]) return String(record[title]);
  const firstText = entity.fields.find((f) => f.type === 'text' && record[f.name]);
  return firstText ? String(record[firstText.name]) : record.id;
}

/** Resout la valeur affichable d'un champ, relations comprises. */
function displayValue(field, record, related) {
  const value = record[field.name];
  if (field.type === 'relation') {
    const target = related?.[field.ref];
    if (!target) return '—';
    const match = target.rows.find((r) => r.id === value);
    return match ? recordLabel(target.entity, match) : '—';
  }
  return formatValue(value, field.type);
}

/** Filtre les enregistrements selon la recherche. */
function filterRows(rows, searchQuery, entity) {
  if (!searchQuery.trim()) return rows;
  const query = searchQuery.toLowerCase();
  return rows.filter((row) => {
    return entity.fields.some((field) => {
      const value = String(row[field.name] || '').toLowerCase();
      return value.includes(query);
    });
  });
}

/* ------------------------------------------------------------------ Liste */

export function ListView({ entity, rows, related, onEdit, onDelete, readOnly }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const columns = entity.fields.slice(0, 6);

  let filtered = filterRows(rows, searchQuery, entity);

  if (sortField) {
    filtered = [...filtered].sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortAsc ? cmp : -cmp;
    });
  }

  const toggleSort = (fieldName) => {
    if (sortField === fieldName) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(fieldName);
      setSortAsc(true);
    }
  };

  if (!rows.length) {
    return (
      <EmptyState
        icon={entity.icon}
        title={`Aucun enregistrement dans ${entity.labelPlural.toLowerCase()}`}
        hint="Ajoutez-en un pour commencer."
      />
    );
  }

  return (
    <div className="card">
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface-2)' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <Icon name="search" size={16} style={{ opacity: 0.5 }} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              font: 'inherit',
              outline: 'none',
              minWidth: 0,
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-2)' }}>
          Aucun résultat pour "{searchQuery}"
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((field) => (
                  <th
                    key={field.name}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort(field.name)}
                    title="Cliquer pour trier"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {field.label}
                      {sortField === field.name && (
                        <Icon name={sortAsc ? 'chevron-up' : 'chevron-down'} size={12} />
                      )}
                    </div>
                  </th>
                ))}
                {!readOnly && <th style={{ width: 90 }} />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  {columns.map((field) => (
                    <td key={field.name}>
                      <Cell field={field} row={row} related={related} />
                    </td>
                  ))}
                  {!readOnly && (
                    <td>
                      <div className="table__actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--icon"
                          title="Modifier"
                          onClick={() => onEdit(row)}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--icon"
                          title="Supprimer"
                          onClick={() => onDelete(row)}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Cell({ field, row, related }) {
  const value = row[field.name];

  if (field.type === 'select' && value) {
    return <span className={`badge badge--${statusTone(value)}`}><span className="dot" />{value}</span>;
  }
  if (field.type === 'boolean') {
    return value
      ? <span className="badge badge--success"><Icon name="check" size={11} />Oui</span>
      : <span className="badge">Non</span>;
  }
  if (field.type === 'multiselect' && Array.isArray(value) && value.length) {
    return (
      <span className="row wrap" style={{ gap: 4 }}>
        {value.map((v) => <span key={v} className="badge">{v}</span>)}
      </span>
    );
  }
  if (field.type === 'image') {
    return <span className="faint"><Icon name="eye" size={13} /></span>;
  }

  return <span className="cell-truncate">{displayValue(field, row, related)}</span>;
}

/* ----------------------------------------------------------------- Kanban */

export function KanbanView({ entity, rows, onEdit }) {
  const statusField = entity.fields.find((f) => f.name === entity.display?.statusField);
  if (!statusField) {
    return <EmptyState icon="columns" title="Cette table n'a pas de champ de statut." />;
  }

  const columns = statusField.options?.length ? statusField.options : ['Sans statut'];
  // Le sous-titre doit apporter une information nouvelle : ni le statut
  // (deja porte par la colonne), ni le champ deja affiche comme titre.
  const subtitleField = entity.fields.find(
    (f) => f.name !== statusField.name
      && f.name !== entity.display?.titleField
      && ['currency', 'date', 'datetime', 'email', 'number', 'text'].includes(f.type),
  );

  return (
    <div className="kanban">
      {columns.map((column) => {
        const cards = rows.filter((r) => (r[statusField.name] || 'Sans statut') === column);
        return (
          <div key={column} className="kanban__col">
            <div className="kanban__title">
              <span className={`badge badge--${statusTone(column)}`}><span className="dot" />{column}</span>
              <span className="kanban__count">{cards.length}</span>
            </div>
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className="kanban__card"
                style={{ width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit' }}
                onClick={() => onEdit?.(card)}
              >
                <strong>{recordLabel(entity, card)}</strong>
                {subtitleField && (
                  <small>{formatValue(card[subtitleField.name], subtitleField.type)}</small>
                )}
              </button>
            ))}
            {!cards.length && <p className="faint small" style={{ padding: '6px 2px' }}>Vide</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Galerie */

export function GalleryView({ entity, rows, onEdit }) {
  const subtitleField = entity.fields.find(
    (f) => f.name !== entity.display?.titleField
      && ['currency', 'select', 'date', 'number'].includes(f.type),
  );

  if (!rows.length) return <EmptyState icon={entity.icon} title="Aucun element a afficher." />;

  return (
    <div className="gallery">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          className="gallery__card"
          style={{ textAlign: 'left', font: 'inherit', color: 'inherit', padding: 0 }}
          onClick={() => onEdit?.(row)}
        >
          <div className="gallery__thumb"><Icon name={entity.icon} size={26} /></div>
          <div className="gallery__body">
            <strong>{recordLabel(entity, row)}</strong>
            {subtitleField && (
              <small>{formatValue(row[subtitleField.name], subtitleField.type)}</small>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- Calendrier */

export function CalendarView({ entity, rows, onEdit, month, onMonthChange }) {
  const dateField = entity.fields.find((f) => f.name === entity.display?.dateField);
  if (!dateField) {
    return <EmptyState icon="calendar" title="Cette table n'a pas de champ de date." />;
  }

  const cursor = month || new Date();
  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();

  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  // Semaine demarrant le lundi.
  const startOffset = (first.getDay() + 6) % 7;

  // Regroupement des enregistrements par jour.
  const byDay = new Map();
  for (const row of rows) {
    const raw = row[dateField.name];
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex) continue;
    const key = date.getDate();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(row);
  }

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;

  return (
    <div className="calendar">
      <div className="calendar__head">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => onMonthChange?.(new Date(year, monthIndex - 1, 1))}
          aria-label="Mois precedent"
        >
          <Icon name="chevron-left" size={15} />
        </button>
        <strong style={{ minWidth: 150, textAlign: 'center' }}>
          {cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </strong>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => onMonthChange?.(new Date(year, monthIndex + 1, 1))}
          aria-label="Mois suivant"
        >
          <Icon name="chevron-right" size={15} />
        </button>
        <span className="faint small" style={{ marginLeft: 'auto' }}>
          {rows.length} enregistrement(s)
        </span>
      </div>

      <div className="calendar__grid">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="calendar__dow">{d}</div>
        ))}

        {cells.map((day, index) => (
          <div
            // Les cellules vides n'ont pas d'identite stable : l'index convient.
            key={day ?? `empty-${index}`}
            className={`calendar__cell ${day ? '' : 'is-muted'} ${
              day && isCurrentMonth && day === today.getDate() ? 'is-today' : ''
            }`}
          >
            {day && <span className="calendar__day">{day}</span>}
            {(byDay.get(day) || []).slice(0, 3).map((row) => (
              <button
                key={row.id}
                type="button"
                className="calendar__event"
                style={{ border: 0, width: '100%', textAlign: 'left' }}
                onClick={() => onEdit?.(row)}
                title={recordLabel(entity, row)}
              >
                {recordLabel(entity, row)}
              </button>
            ))}
            {(byDay.get(day) || []).length > 3 && (
              <small className="faint">+{byDay.get(day).length - 3}</small>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- Tableau de bord */

export function DashboardView({ spec, page, data, onOpenEntity }) {
  const widgets = page.widgets || [];
  const stats = widgets.filter((w) => w.type === 'stat');
  const breakdowns = widgets.filter((w) => w.type === 'breakdown');
  const recents = widgets.filter((w) => w.type === 'recent');

  return (
    <div className="stack">
      {stats.length > 0 && (
        <div className="grid grid--stats">
          {stats.map((widget) => (
            <StatWidget key={widget.id} widget={widget} data={data} />
          ))}
        </div>
      )}

      {breakdowns.map((widget) => (
        <BreakdownWidget key={widget.id} widget={widget} spec={spec} data={data} />
      ))}

      {recents.map((widget) => (
        <RecentWidget
          key={widget.id}
          widget={widget}
          spec={spec}
          data={data}
          onOpen={onOpenEntity}
        />
      ))}

      {!widgets.length && <EmptyState icon="home" title="Ce tableau de bord est vide." />}
    </div>
  );
}

function StatWidget({ widget, data }) {
  const rows = data[widget.entity] || [];

  let value = rows.length;
  if (widget.metric === 'sum' && widget.field) {
    value = rows.reduce((sum, row) => sum + (Number(row[widget.field]) || 0), 0);
  }

  return (
    <div className="stat">
      <div className="stat__label">
        <Icon name={widget.icon || 'database'} size={13} />
        {widget.title}
      </div>
      <div className="stat__value">
        {widget.metric === 'sum'
          ? formatValue(value, 'currency')
          : formatValue(value, 'number')}
      </div>
    </div>
  );
}

function BreakdownWidget({ widget, spec, data }) {
  const entity = spec.entities.find((e) => e.name === widget.entity);
  const rows = data[widget.entity] || [];
  const field = entity?.fields.find((f) => f.name === widget.field);
  if (!entity || !field) return null;

  const counts = new Map();
  for (const row of rows) {
    const key = row[field.name] || 'Non renseigne';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));

  return (
    <div className="card">
      <div className="card__header">
        <Icon name="trending-up" size={15} />
        <h3>{widget.title}</h3>
        <span className="faint small" style={{ marginLeft: 'auto' }}>{rows.length} au total</span>
      </div>
      <div className="card__body stack" style={{ gap: 10 }}>
        {entries.length === 0 && <p className="faint small">Aucune donnee.</p>}
        {entries.map(([label, count]) => (
          <div key={label}>
            <div className="row row--between small" style={{ marginBottom: 4 }}>
              <span className={`badge badge--${statusTone(label)}`}><span className="dot" />{label}</span>
              <span className="faint">{count}</span>
            </div>
            <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(count / max) * 100}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentWidget({ widget, spec, data, onOpen }) {
  const entity = spec.entities.find((e) => e.name === widget.entity);
  const rows = data[widget.entity] || [];
  if (!entity) return null;

  const recent = [...rows]
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, widget.limit || 5);

  return (
    <div className="card">
      <div className="card__header">
        <Icon name={entity.icon} size={15} />
        <h3>{widget.title}</h3>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => onOpen?.(entity)}
        >
          Tout voir <Icon name="chevron-right" size={13} />
        </button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <tbody>
            {recent.map((row) => (
              <tr key={row.id}>
                <td><strong>{recordLabel(entity, row)}</strong></td>
                {entity.display?.statusField && (
                  <td style={{ width: 130 }}>
                    <span className={`badge badge--${statusTone(row[entity.display.statusField])}`}>
                      <span className="dot" />
                      {row[entity.display.statusField] || '—'}
                    </span>
                  </td>
                )}
              </tr>
            ))}
            {!recent.length && (
              <tr><td className="faint small">Aucune donnee.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Vides */

export function EmptyState({ icon = 'layout', title, hint, action }) {
  return (
    <div className="empty">
      <div className="empty__icon"><Icon name={icon} size={20} /></div>
      <strong>{title}</strong>
      {hint && <p className="small faint">{hint}</p>}
      {action}
    </div>
  );
}
