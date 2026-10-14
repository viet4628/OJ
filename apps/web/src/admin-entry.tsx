import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminGate from './pages/admin/AdminGate';
import './index.css';
import { applyTheme, getInitialTheme } from './lib/theme';

applyTheme(getInitialTheme());

// Normalize URL to /admin if accessed as /admin.html
if (typeof window !== 'undefined' && window.location.pathname.endsWith('/admin.html')) {
  window.history.replaceState(null, '', '/admin' + window.location.search + window.location.hash);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 sm:px-8 py-6">
      <AdminGate />
    </div>
  </React.StrictMode>
);