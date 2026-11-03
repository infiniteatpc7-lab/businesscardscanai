import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import PlatformAdminApp from './components/admin/PlatformAdminApp';
import '../css/app.css';

// Check if currently navigating under platform administration routes
const isAdminRoute = window.location.pathname.startsWith('/admin') ||
    window.location.pathname.startsWith('/platform-admin');

const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            {isAdminRoute ? <PlatformAdminApp /> : <App />}
        </React.StrictMode>
    );
}
