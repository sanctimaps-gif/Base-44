/** Onglet « Structure » : modele de donnees et pages generees. */

import Icon from '../../components/Icon.jsx';

const TYPE_LABELS = {
  text: 'Texte', longtext: 'Texte long', number: 'Nombre', currency: 'Montant',
  percent: 'Pourcentage', boolean: 'Oui / Non', date: 'Date', datetime: 'Date et heure',
  email: 'E-mail', phone: 'Telephone', url: 'Lien', select: 'Liste', multiselect: 'Liste multiple',
  relation: 'Relation', image: 'Image', file: 'Fichier', rating: 'Note', color: 'Couleur',
  json: 'JSON',
};

const VIEW_LABELS = {
  list: 'Liste', kanban: 'Kanban', calendar: 'Calendrier',
  gallery: 'Galerie', dashboard: 'Tableau de bord', form: 'Formulaire', detail: 'Fiche',
};

export default function SchemaPanel({ spec, data }) {
  return (
    <div className="content__inner stack">
      <div className="grid grid--stats">
        <Stat icon="database" label="Tables" value={spec.entities.length} />
        <Stat
          icon="columns"
          label="Champs"
          value={spec.entities.reduce((sum, e) => sum + e.fields.length, 0)}
        />
        <Stat icon="layout" label="Pages" value={spec.pages.length} />
        <Stat
          icon="grid"
          label="Enregistrements"
          value={Object.values(data || {}).reduce((sum, rows) => sum + rows.length, 0)}
        />
      </div>

      {spec.entities.map((entity) => (
        <div key={entity.name} className="card">
          <div className="card__header">
            <Icon name={entity.icon} size={16} />
            <div className="grow">
              <h3>{entity.labelPlural}</h3>
              <p className="small faint">
                Table <code className="mono">{entity.name}</code> · {entity.fields.length} champs
                · {(data?.[entity.name] || []).length} enregistrement(s)
              </p>
            </div>
            <div className="row wrap" style={{ gap: 5 }}>
              {entity.views.map((view) => (
                <span key={view} className="badge badge--accent">{VIEW_LABELS[view] || view}</span>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Champ</th>
                  <th>Identifiant</th>
                  <th>Type</th>
                  <th>Contraintes</th>
                  <th>Valeurs</th>
                </tr>
              </thead>
              <tbody>
                {entity.fields.map((field) => (
                  <tr key={field.name}>
                    <td>
                      <strong>{field.label}</strong>
                      {entity.display?.titleField === field.name && (
                        <span className="badge badge--accent" style={{ marginLeft: 6 }}>titre</span>
                      )}
                    </td>
                    <td><code className="mono faint">{field.name}</code></td>
                    <td><span className="badge">{TYPE_LABELS[field.type] || field.type}</span></td>
                    <td>
                      <div className="row wrap" style={{ gap: 4 }}>
                        {field.required && <span className="badge badge--warning">obligatoire</span>}
                        {field.unique && <span className="badge">unique</span>}
                        {!field.required && !field.unique && <span className="faint small">—</span>}
                      </div>
                    </td>
                    <td>
                      {field.type === 'relation' && field.ref && (
                        <span className="badge badge--accent">
                          <Icon name="repeat" size={11} />{field.ref}
                        </span>
                      )}
                      {field.options?.length > 0 && (
                        <span className="cell-truncate faint small">{field.options.join(' · ')}</span>
                      )}
                      {!field.options?.length && field.type !== 'relation' && (
                        <span className="faint small">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="card">
        <div className="card__header">
          <Icon name="layout" size={16} />
          <h3>Pages</h3>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Chemin</th>
                <th>Type</th>
                <th>Table liee</th>
              </tr>
            </thead>
            <tbody>
              {spec.pages.map((page) => (
                <tr key={page.id}>
                  <td>
                    <Icon name={page.icon || 'layout'} size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                    <strong>{page.name}</strong>
                  </td>
                  <td><code className="mono faint">{page.path}</code></td>
                  <td><span className="badge">{VIEW_LABELS[page.type] || page.type}</span></td>
                  <td>{page.entity || <span className="faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="stat">
      <div className="stat__label"><Icon name={icon} size={13} />{label}</div>
      <div className="stat__value">{value}</div>
    </div>
  );
}
