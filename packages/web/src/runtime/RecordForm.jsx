/**
 * Formulaire genere dynamiquement a partir du spec d'une entite.
 * Chaque type de champ produit le controle adapte.
 */

import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { emptyValue, inputType, toInputDate, toInputDateTime } from '../lib/format.js';

export default function RecordForm({ entity, record, entities = {}, onSubmit, onCancel, saving }) {
  const [values, setValues] = useState(() => buildInitialValues(entity, record));
  const [errors, setErrors] = useState([]);

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    // Validation cote client : l'API revalide de toute facon.
    const missing = entity.fields
      .filter((f) => f.required && isEmpty(values[f.name]))
      .map((f) => `${f.label} est obligatoire.`);

    if (missing.length) {
      setErrors(missing);
      return;
    }

    setErrors([]);
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal__body">
        {errors.length > 0 && (
          <div className="badge badge--danger" style={{ marginBottom: 14, display: 'block', padding: '8px 12px' }}>
            {errors.join(' ')}
          </div>
        )}

        {entity.fields.map((field) => (
          <FieldControl
            key={field.name}
            field={field}
            value={values[field.name]}
            options={field.type === 'relation' ? entities[field.ref] || [] : null}
            onChange={(v) => setField(field.name, v)}
          />
        ))}
      </div>

      <div className="modal__footer">
        <button type="button" className="btn" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? <span className="spinner" /> : <Icon name="check" size={14} />}
          {record ? 'Mettre a jour' : 'Creer'}
        </button>
      </div>
    </form>
  );
}

function buildInitialValues(entity, record) {
  const values = {};
  for (const field of entity.fields) {
    const raw = record?.[field.name];
    if (raw === undefined || raw === null) {
      values[field.name] = emptyValue(field);
    } else if (field.type === 'date') {
      values[field.name] = toInputDate(raw);
    } else if (field.type === 'datetime') {
      values[field.name] = toInputDateTime(raw);
    } else {
      values[field.name] = raw;
    }
  }
  return values;
}

function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === '' || value === null || value === undefined;
}

/** Rend le controle adapte au type du champ. */
function FieldControl({ field, value, options, onChange }) {
  const id = `field-${field.name}`;

  const label = (
    <label className="field__label" htmlFor={id}>
      {field.label}
      {field.required && <span className="req">*</span>}
    </label>
  );

  switch (field.type) {
    case 'longtext':
      return (
        <div className="field">
          {label}
          <textarea
            id={id}
            className="textarea"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'boolean':
      return (
        <div className="field">
          <label className="checkbox" htmlFor={id}>
            <input
              id={id}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="field__label" style={{ margin: 0 }}>{field.label}</span>
          </label>
        </div>
      );

    case 'select':
      return (
        <div className="field">
          {label}
          <select id={id} className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      );

    case 'multiselect': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="field">
          {label}
          <div className="row wrap" style={{ gap: 6 }}>
            {(field.options || []).map((option) => {
              const active = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  className={`chip ${active ? 'is-active' : ''}`}
                  style={active ? {
                    borderColor: 'var(--accent)',
                    color: 'var(--accent)',
                    background: 'var(--accent-soft)',
                  } : undefined}
                  onClick={() => onChange(
                    active ? selected.filter((v) => v !== option) : [...selected, option],
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    case 'relation':
      return (
        <div className="field">
          {label}
          <select id={id} className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {(options || []).map((row) => (
              <option key={row.id} value={row.id}>{row.__label || row.id}</option>
            ))}
          </select>
        </div>
      );

    case 'rating':
      return (
        <div className="field">
          {label}
          <div className="row" style={{ gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="btn btn--ghost btn--icon"
                aria-label={`${n} sur 5`}
                onClick={() => onChange(n)}
                style={{ color: n <= Number(value) ? 'var(--warning)' : 'var(--text-faint)' }}
              >
                <Icon name="star" size={17} />
              </button>
            ))}
          </div>
        </div>
      );

    case 'json':
      return (
        <div className="field">
          {label}
          <textarea
            id={id}
            className="textarea mono"
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : (value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    default:
      return (
        <div className="field">
          {label}
          <input
            id={id}
            className="input"
            type={inputType(field.type)}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}
