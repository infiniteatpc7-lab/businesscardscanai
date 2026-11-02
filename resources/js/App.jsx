import React, { useState, useEffect } from 'react';
import MobileHeader from './layouts/MobileHeader';
import MobileBottomNav from './layouts/MobileBottomNav';
import MobileHomePage from './pages/MobileHomePage';
import MobileCardsPage from './pages/MobileCardsPage';
import MobileScannerView from './pages/MobileScannerView';
import MobileProfilePage from './pages/MobileProfilePage';
import { ToastProvider, useToast } from './context/ToastContext';
import { fetchCards } from './services/cardApi';

function MobileAppContent() {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('home'); // 'home' | 'cards' | 'scan' | 'profile'
    const [cards, setCards] = useState([]);
    const [selectedCardForModal, setSelectedCardForModal] = useState(null);

    // Fetch cards from backend API
    const loadCards = async () => {
        try {
            const res = await fetchCards();
            if (res.success && Array.isArray(res.cards)) {
                setCards(res.cards);
            }
        } catch (err) {
            console.error('Failed to load cards:', err);
        }
    };

    useEffect(() => {
        loadCards();
    }, []);

    const handleCardSaved = () => {
        loadCards();
        setActiveTab('cards');
    };

    // Export CSV Helper
    const handleExportCSV = () => {
        if (cards.length === 0) {
            showToast('No cards to export', 'info');
            return;
        }

        const headers = ['ID', 'Company', 'Company English', 'Name', 'Phone', 'Email', 'Address', 'Accuracy Score', 'Created At'];
        const rows = cards.map((c) => [
            c.id,
            `"${(c.company || '').replace(/"/g, '""')}"`,
            `"${(c.company_english || '').replace(/"/g, '""')}"`,
            `"${(c.name || '').replace(/"/g, '""')}"`,
            `"${(Array.isArray(c.phone) ? c.phone.join('; ') : c.phone || '').replace(/"/g, '""')}"`,
            `"${(c.email || '').replace(/"/g, '""')}"`,
            `"${(c.address || '').replace(/"/g, '""')}"`,
            c.accuracy_score || 95,
            c.created_at || ''
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `business_cards_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV Exported successfully!');
    };

    return (
        <div className="min-h-screen bg-[#ECECEE] flex justify-center selection:bg-black selection:text-white">
            {/* Mobile Viewport Container (Native mobile on phones, sleek phone shell on desktop) */}
            <div className="w-full max-w-md min-h-screen bg-[#F4F4F6] relative shadow-2xl flex flex-col border-x border-black/[0.04]">
                {/* Subtle background dot grid pattern */}
                <div className="absolute inset-0 bg-subtle-grid pointer-events-none opacity-60"></div>

                {/* Top Header */}
                <MobileHeader
                    onLoadSample={() => {
                        setActiveTab('scan');
                        setTimeout(() => {
                            const sampleBtn = document.querySelector('button[title*="Morbi Depo"]');
                            if (sampleBtn) sampleBtn.click();
                        }, 100);
                    }}
                />

                {/* Page Content Body */}
                <main className="flex-1 p-4 relative z-10 overflow-y-auto flex flex-col">
                    <div key={activeTab} className="animate-tab-fade flex-1 flex flex-col">
                        {activeTab === 'home' && (
                            <MobileHomePage
                                cards={cards}
                                onNavigateToScan={() => setActiveTab('scan')}
                                onNavigateToCards={() => setActiveTab('cards')}
                                onSelectCard={(card) => {
                                    setSelectedCardForModal(card);
                                    setActiveTab('cards');
                                }}
                                onLoadSample={() => setActiveTab('scan')}
                                onExportCSV={handleExportCSV}
                            />
                        )}

                        {activeTab === 'cards' && (
                            <MobileCardsPage
                                cards={cards}
                                onRefresh={loadCards}
                                onNavigateToScan={() => setActiveTab('scan')}
                                onExportCSV={handleExportCSV}
                            />
                        )}

                        {activeTab === 'scan' && (
                            <MobileScannerView
                                onCardSaved={handleCardSaved}
                                onNavigateToCards={() => setActiveTab('cards')}
                            />
                        )}

                        {activeTab === 'profile' && (
                            <MobileProfilePage
                                cardsCount={cards.length}
                                onExportCSV={handleExportCSV}
                            />
                        )}
                    </div>
                </main>

                {/* Bottom Navigation */}
                <MobileBottomNav
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    cardsCount={cards.length}
                />
            </div>
        </div>
    );
}

export default function App() {
    return (
        <ToastProvider>
            <MobileAppContent />
        </ToastProvider>
    );
}
