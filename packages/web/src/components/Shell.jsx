/** Coquille de l'interface : barre laterale, barre haute, notifications. */

import { NavLink, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useTheme } from '../lib/theme.jsx';

const NAV = [
  { to: '/', label: 'Mes applications', icon: 'grid', end: true },
  { to: '/templates', label: 'Modeles', icon: 'sparkles' },
  { to: '/engine', label: "Moteur d'IA", icon: 'cpu' },
  { to: '/settings', label: 'Parametres', icon: 'settings' },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="brand-mark">44</span>
        <span className="brand-name">Base 44</span>
      </div>

      <nav className="sidebar__nav">
        <div className="sidebar__section">Studio</div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
          >
            <Icon name={item.icon} size={15} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <ThemeToggle />
      </div>
    </aside>
  );
}

export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  return (
    <button type="button" className="nav-item" onClick={toggle}>
      <Icon name={mode === 'dark' ? 'sun' : 'moon'} size={15} />
      {mode === 'dark' ? 'Mode clair' : 'Mode sombre'}
    </button>
  );
}

export function Topbar({ title, subtitle, back, children }) {
  const navigate = useNavigate();

  return (
    <header className="topbar">
      {back && (
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => navigate(back)}
          aria-label="Retour"
        >
          <Icon name="arrow-left" size={16} />
        </button>
      )}
      <div className="topbar__title">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <div className="topbar__spacer" />
      {children}
    </header>
  );
}

/** Notification ephemere. */
export function Toast({ message }) {
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}

/** Etat de chargement plein cadre. */
export function Loading({ label = 'Chargement…' }) {
  return (
    <div className="empty">
      <span className="spinner" />
      <span className="muted small">{label}</span>
    </div>
  );
}

/** Message d'erreur avec possibilite de reessayer. */
export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty">
      <div className="empty__icon" style={{ color: 'var(--danger)' }}>
        <Icon name="alert" size={20} />
      </div>
      <strong>Une erreur est survenue</strong>
      <p className="small muted">{error?.message || String(error)}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          <Icon name="refresh" size={14} />Reessayer
        </button>
      )}
    </div>
  );
}
