/** Routage du studio Base 44. */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Shell.jsx';
import { ThemeProvider } from './lib/theme.jsx';

import Dashboard from './pages/Dashboard.jsx';
import Builder from './pages/Builder.jsx';
import Preview from './pages/Preview.jsx';
import Templates from './pages/Templates.jsx';
import EnginePage from './pages/Engine.jsx';
import Settings from './pages/Settings.jsx';

function Layout() {
  const { pathname } = useLocation();

  // L'application generee s'affiche en plein ecran, sans la navigation du studio.
  const fullscreen = /^\/apps\/[^/]+\/preview$/.test(pathname);

  return (
    <div className={`shell ${fullscreen ? 'no-sidebar' : ''}`}>
      {!fullscreen && <Sidebar />}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/apps/:id" element={<Builder />} />
        <Route path="/apps/:id/preview" element={<Preview />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/engine" element={<EnginePage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </ThemeProvider>
  );
}
