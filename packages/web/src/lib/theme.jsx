/**
 * Gestion du theme.
 *
 * Deux niveaux : le mode clair/sombre du studio (persiste dans le navigateur)
 * et la couleur d'accent, qui suit l'application ouverte pour donner un apercu
 * fidele de son rendu.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'base44:theme';

function readStoredMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Stockage indisponible (navigation privee) : on retombe sur le systeme.
  }
  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(readStoredMode);
  const [accent, setAccentState] = useState('#2563eb');
  const [radius, setRadiusState] = useState(10);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Sans persistance, le theme reste valable pour la session.
    }
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-soft', withAlpha(accent, 0.13));
    root.style.setProperty('--accent-text', readableOn(accent));
    root.style.setProperty('--radius', `${radius}px`);
  }, [accent, radius]);

  const toggle = useCallback(() => {
    setMode((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  /** Applique le theme d'une application (ou revient au theme du studio). */
  const applySpecTheme = useCallback((theme) => {
    setAccentState(theme?.primary || '#2563eb');
    setRadiusState(Number(theme?.radius) || 10);
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, toggle, accent, radius, applySpecTheme }),
    [mode, toggle, accent, radius, applySpecTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme doit etre utilise dans un ThemeProvider.');
  return context;
}

/** #rrggbb -> rgba(...) */
function withAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(37, 99, 235, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Noir ou blanc selon la luminance, pour rester lisible sur l'accent. */
function readableOn(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  // Luminance perceptuelle (ITU-R BT.601).
  const luminance = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return luminance > 150 ? '#111827' : '#ffffff';
}

function hexToRgb(hex) {
  let value = String(hex || '').replace('#', '');
  if (value.length === 3) {
    value = value.split('').map((c) => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}
