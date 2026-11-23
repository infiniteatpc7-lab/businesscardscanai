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

    // Register Service Worker for PWA Add-to-Home-Screen Support
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        const registerServiceWorker = () => {
            navigator.serviceWorker.register('/sw.js').then((reg) => {
                console.debug('PWA ServiceWorker registered successfully:', reg.scope);
            }).catch((err) => {
                console.debug('PWA ServiceWorker registration error:', err);
            });
        };

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            registerServiceWorker();
        } else {
            window.addEventListener('load', registerServiceWorker);
        }
    }
}
