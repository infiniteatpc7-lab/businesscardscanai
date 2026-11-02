import React, { useState, useEffect } from 'react';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import ScannerPage from './pages/ScannerPage';
import ContactsPage from './pages/ContactsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { ToastProvider } from './context/ToastContext';
import { fetchCards } from './services/cardApi';

function MainApp() {
    const [activePage, setActivePage] = useState('dashboard');
    const [cards, setCards] = useState([]);
    const [loadingCards, setLoadingCards] = useState(false);

    // Fetch cards from backend API
    const loadCards = async () => {
        setLoadingCards(true);
        try {
            const res = await fetchCards();
            if (res.success && Array.isArray(res.cards)) {
                setCards(res.cards);
            }
        } catch (err) {
            console.error('Failed to load cards:', err);
        } finally {
            setLoadingCards(false);
        }
    };

    useEffect(() => {
        loadCards();
    }, []);

    const handleCardSaved = (newCard) => {
        loadCards();
    };

    return (
        <AppLayout activePage={activePage} onSelectPage={setActivePage}>
            {activePage === 'dashboard' && (
                <DashboardPage
                    cards={cards}
                    onNavigateToScanner={() => setActivePage('scanner')}
                    onNavigateToContacts={() => setActivePage('contacts')}
                />
            )}

            {activePage === 'scanner' && (
                <ScannerPage
                    onCardSaved={handleCardSaved}
                    onNavigateToContacts={() => setActivePage('contacts')}
                />
            )}

            {activePage === 'contacts' && (
                <ContactsPage
                    cards={cards}
                    onRefresh={loadCards}
                    onNavigateToScanner={() => setActivePage('scanner')}
                />
            )}

            {![ 'dashboard', 'scanner', 'contacts' ].includes(activePage) && (
                <PlaceholderPage
                    pageId={activePage}
                    onNavigateToScanner={() => setActivePage('scanner')}
                />
            )}
        </AppLayout>
    );
}

export default function App() {
    return (
        <ToastProvider>
            <MainApp />
        </ToastProvider>
    );
}
