import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import MobileHeader from './layouts/MobileHeader';
import MobileBottomNav from './layouts/MobileBottomNav';
import MobileHomePage from './pages/MobileHomePage';
import MobileCardsPage from './pages/MobileCardsPage';
import MobileScannerView from './pages/MobileScannerView';
import MobileProfilePage from './pages/MobileProfilePage';
import AuthModal from './components/auth/AuthModal';
import ExhibitionSelectorModal from './components/exhibition/ExhibitionSelectorModal';
import ExhibitionManageModal from './components/exhibition/ExhibitionManageModal';
import { ToastProvider, useToast } from './context/ToastContext';
import {
    fetchCards,
    fetchAuthUser,
    logoutUser,
    getStoredToken,
    fetchWorkspaces,
    acceptInvitation,
    fetchCurrentExhibition,
    fetchExhibitions,
    exportCards
} from './services/cardApi';

function MobileAppContent() {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('home'); // 'home' | 'cards' | 'scan' | 'profile'
    const [cards, setCards] = useState([]);
    const [selectedCardForModal, setSelectedCardForModal] = useState(null);

    // Authentication state
    const [authUser, setAuthUser] = useState(null);
    const [authWorkspace, setAuthWorkspace] = useState(null);
    const [workspacesList, setWorkspacesList] = useState([]);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    // Exhibition state
    const [currentExhibition, setCurrentExhibition] = useState(null);
    const [exhibitionsList, setExhibitionsList] = useState([]);
    const [isExhibitionSelectorOpen, setIsExhibitionSelectorOpen] = useState(false);
    const [isExhibitionManageOpen, setIsExhibitionManageOpen] = useState(false);

    // Fetch cards from backend API
    const loadCards = async () => {
        try {
            const res = await fetchCards();
            if (res.unauthenticated) {
                setIsAuthModalOpen(true);
                return;
            }
            if (res.success && Array.isArray(res.cards)) {
                setCards(res.cards);
            }
        } catch (err) {
            console.error('Failed to load cards:', err);
        }
    };

    // Load all user workspaces
    const loadWorkspaces = async () => {
        try {
            const res = await fetchWorkspaces();
            if (res.success && Array.isArray(res.workspaces)) {
                setWorkspacesList(res.workspaces);
            }
        } catch (err) {
            console.error('Failed to load workspaces list:', err);
        }
    };

    // Load exhibitions and user's current selection
    const loadExhibitionState = async () => {
        try {
            const [currRes, listRes] = await Promise.all([
                fetchCurrentExhibition(),
                fetchExhibitions()
            ]);
            if (currRes.success && currRes.exhibition) {
                setCurrentExhibition(currRes.exhibition);
            }
            if (listRes.success && Array.isArray(listRes.exhibitions)) {
                setExhibitionsList(listRes.exhibitions);
            }
        } catch (err) {
            console.error('Failed to load exhibition state:', err);
        }
    };

    // Verify authentication on mount
    const checkAuthStatus = async () => {
        const token = getStoredToken();
        if (!token) {
            setIsAuthModalOpen(true);
            return;
        }

        try {
            const res = await fetchAuthUser();
            if (res.success && res.user) {
                setAuthUser(res.user);
                setAuthWorkspace(res.current_workspace);
                loadCards();
                loadWorkspaces();
                loadExhibitionState();
                checkPendingInvite();
            } else {
                setAuthUser(null);
                setAuthWorkspace(null);
                setIsAuthModalOpen(true);
            }
        } catch {
            setIsAuthModalOpen(true);
        }
    };

    // Check if there is an invitation token in the URL (/invitations/{token})
    const checkPendingInvite = async () => {
        const path = window.location.pathname;
        const match = path.match(/\/invitations\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            const inviteToken = match[1];
            try {
                const res = await acceptInvitation(inviteToken);
                if (res.success && res.workspace) {
                    showToast(res.message || `Joined ${res.workspace.name}!`, 'success');
                    setAuthWorkspace(res.workspace);
                    loadWorkspaces();
                    loadExhibitionState();
                    loadCards();
                    window.history.replaceState({}, document.title, '/');
                } else {
                    showToast(res.message || 'Could not accept invitation.', 'error');
                }
            } catch (err) {
                console.error('Accept invite error:', err);
            }
        }
    };

    useEffect(() => {
        checkAuthStatus();

        // Global listener for 401 unauthenticated events
        const handleUnauthorized = () => {
            setAuthUser(null);
            setAuthWorkspace(null);
            setCards([]);
            setCurrentExhibition(null);
            setIsAuthModalOpen(true);
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    const handleAuthSuccess = (data) => {
        setAuthUser(data.user);
        setAuthWorkspace(data.workspace);
        setIsAuthModalOpen(false);
        loadCards();
        loadWorkspaces();
        loadExhibitionState();
        checkPendingInvite();
        showToast(`Welcome back, ${data.user.name}!`);
    };

    const handleWorkspaceChanged = (newWs) => {
        setAuthWorkspace(newWs);
        loadCards();
        loadWorkspaces();
        loadExhibitionState();
    };

    const handleLogout = async () => {
        await logoutUser();
        setAuthUser(null);
        setAuthWorkspace(null);
        setCards([]);
        setCurrentExhibition(null);
        setIsAuthModalOpen(true);
        showToast('Signed out successfully');
    };

    const handleCardSaved = (savedCard) => {
        loadCards();
        if (savedCard) {
            setSelectedCardForModal(savedCard);
        }
        setActiveTab('cards');
    };

    // Export CSV Helper with backend plan entitlement check
    const handleExportCSV = async () => {
        if (cards.length === 0) {
            showToast('No cards to export', 'info');
            return;
        }

        try {
            const res = await exportCards('csv');
            if (res.forbidden) {
                showToast(res.message, 'error');
            } else if (res.success) {
                showToast('CSV Exported successfully!');
            } else {
                showToast(res.message || 'Export failed', 'error');
            }
        } catch (err) {
            console.error('Export error:', err);
            showToast('Failed to export cards', 'error');
        }
    };

    return (
        <div className="min-h-screen bg-[#ECECEE] flex justify-center selection:bg-black selection:text-white">
            {/* Auth Modal for Unauthenticated Users */}
            <AuthModal
                isOpen={isAuthModalOpen}
                onSuccess={handleAuthSuccess}
            />

            {/* Mobile Viewport Container (Native mobile on phones, sleek phone shell on desktop) */}
            <div className="w-full max-w-md min-h-screen bg-[#F4F4F6] relative shadow-2xl flex flex-col border-x border-black/[0.04]">
                {/* Subtle background dot grid pattern */}
                <div className="absolute inset-0 bg-subtle-grid pointer-events-none opacity-60"></div>

                {/* Top Header */}
                <MobileHeader
                    currentExhibition={currentExhibition}
                    onOpenExhibitionSelector={() => setIsExhibitionSelectorOpen(true)}
                    onLoadSample={() => {
                        setActiveTab('scan');
                        setTimeout(() => {
                            const sampleBtn = document.querySelector('button[title*="Morbi Depo"]');
                            if (sampleBtn) sampleBtn.click();
                        }, 100);
                    }}
                />

                {/* Account / Workspace Suspension Recovery Banner */}
                {(authUser?.status === 'suspended' || authWorkspace?.status === 'suspended') && (
                    <div className="mx-4 mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs flex items-start space-x-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-amber-900">
                                {authUser?.status === 'suspended' ? 'Account Suspended' : 'Workspace Suspended'}
                            </p>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                                {authUser?.status === 'suspended'
                                    ? (authUser?.suspension_reason ? `Reason: ${authUser.suspension_reason}` : 'Your account access has been restricted by an administrator.')
                                    : (authWorkspace?.suspension_reason ? `Reason: ${authWorkspace.suspension_reason}` : 'This workspace has been suspended by an administrator.')}
                            </p>
                            <p className="text-[10px] text-amber-700/80 mt-1">
                                Scanning and card creation are paused. Your cards and data are fully preserved.
                            </p>
                        </div>
                    </div>
                )}

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
                                initialSelectedCard={selectedCardForModal}
                                onClearSelectedCard={() => setSelectedCardForModal(null)}
                                exhibitions={exhibitionsList}
                                currentExhibition={currentExhibition}
                                workspaceRole={authWorkspace?.role}
                                workspaceId={authWorkspace?.id}
                            />
                        )}

                        {activeTab === 'scan' && (
                            <MobileScannerView
                                onCardSaved={handleCardSaved}
                                onNavigateToCards={(card) => {
                                    if (card) {
                                        setSelectedCardForModal(card);
                                    }
                                    setActiveTab('cards');
                                }}
                                currentExhibition={currentExhibition}
                                onOpenExhibitionSelector={() => setIsExhibitionSelectorOpen(true)}
                            />
                        )}

                        {activeTab === 'profile' && (
                            <MobileProfilePage
                                cardsCount={cards.length}
                                onExportCSV={handleExportCSV}
                                user={authUser}
                                workspace={authWorkspace}
                                workspaces={workspacesList}
                                onWorkspaceChanged={handleWorkspaceChanged}
                                currentExhibition={currentExhibition}
                                onExhibitionChanged={loadExhibitionState}
                                onLogout={handleLogout}
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

                {/* Global Exhibition Modals */}
                <ExhibitionSelectorModal
                    isOpen={isExhibitionSelectorOpen}
                    onClose={() => setIsExhibitionSelectorOpen(false)}
                    currentExhibition={currentExhibition}
                    onExhibitionChanged={(newEx) => {
                        setCurrentExhibition(newEx);
                        loadExhibitionState();
                    }}
                    userRole={authWorkspace?.role || 'member'}
                    onOpenManage={() => setIsExhibitionManageOpen(true)}
                />

                <ExhibitionManageModal
                    isOpen={isExhibitionManageOpen}
                    onClose={() => setIsExhibitionManageOpen(false)}
                    currentWorkspace={authWorkspace}
                    userRole={authWorkspace?.role || 'owner'}
                    onExhibitionUpdated={loadExhibitionState}
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
