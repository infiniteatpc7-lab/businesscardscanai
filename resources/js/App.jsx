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
import PlanUpgradeModal from './components/subscription/PlanUpgradeModal';
import CustomerSubscriptionDashboard from './components/subscription/CustomerSubscriptionDashboard';
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
    exportCards,
    fetchCustomerSubscription
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

    // Plan Upgrade & Feature Gate Modal state
    const [upgradeModal, setUpgradeModal] = useState({
        isOpen: false,
        reason: 'on_load', // 'on_load' | 'feature_locked' | 'quota_exceeded'
        featureKey: null,
        featureName: null,
        message: null,
    });
    const [isSubscriptionDashboardOpen, setIsSubscriptionDashboardOpen] = useState(false);
    const [subscriptionQuota, setSubscriptionQuota] = useState(null);

    // Live Quota refresh helper
    const refreshQuota = async () => {
        try {
            const res = await fetchCustomerSubscription();
            if (res.success && res.quota) {
                setSubscriptionQuota(res.quota);
                return res.quota;
            }
        } catch (err) {
            console.error('Failed to refresh quota:', err);
        }
        return null;
    };

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
                refreshQuota();
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

        // Global listener for 403 feature gate & quota limits
        const handleUpgradeRequired = (e) => {
            const detail = e.detail || {};
            setUpgradeModal({
                isOpen: true,
                reason: detail.error_code === 'QUOTA_EXCEEDED' ? 'quota_exceeded' : 'feature_locked',
                featureKey: detail.feature || null,
                featureName: null,
                message: detail.message || null,
            });
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        window.addEventListener('plan:upgrade_required', handleUpgradeRequired);
        const handleQuotaRefresh = () => {
            refreshQuota();
        };
        window.addEventListener('quota:refresh', handleQuotaRefresh);
        return () => {
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
            window.removeEventListener('plan:upgrade_required', handleUpgradeRequired);
            window.removeEventListener('quota:refresh', handleQuotaRefresh);
        };
    }, []);

    // Website load popup: Trigger Plan Promotion for Free Plan users
    useEffect(() => {
        if (authWorkspace && (authWorkspace.plan_name === 'Free' || !authWorkspace.plan_name)) {
            const hasSeen = sessionStorage.getItem('seen_upgrade_modal_on_load');
            if (!hasSeen) {
                sessionStorage.setItem('seen_upgrade_modal_on_load', '1');
                const timer = setTimeout(() => {
                    setUpgradeModal({
                        isOpen: true,
                        reason: 'on_load',
                        featureKey: null,
                        featureName: null,
                        message: null,
                    });
                }, 800);
                return () => clearTimeout(timer);
            }
        }
    }, [authWorkspace?.id]);

    const handleAuthSuccess = (data) => {
        setAuthUser(data.user);
        setAuthWorkspace(data.workspace);
        setIsAuthModalOpen(false);
        loadCards();
        loadWorkspaces();
        loadExhibitionState();
        checkPendingInvite();
        refreshQuota();
        showToast(`Welcome back, ${data.user.name}!`);
    };

    const handleWorkspaceChanged = (newWs) => {
        setAuthWorkspace(newWs);
        loadCards();
        loadWorkspaces();
        loadExhibitionState();
        refreshQuota();
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
        refreshQuota();
        if (savedCard) {
            setSelectedCardForModal(savedCard);
        }
        setActiveTab('cards');
    };

    // Export CSV Helper with backend plan entitlement check
    const handleExportCSV = async () => {
        // Pre-emptive check: If workspace plan does not include export_csv, open upgrade modal
        const features = authWorkspace?.features || [];
        if (features.length > 0 && !features.includes('export_csv')) {
            setUpgradeModal({
                isOpen: true,
                reason: 'feature_locked',
                featureKey: 'export_csv',
                featureName: 'CSV & Excel Export',
                message: 'Exporting contacts to CSV or Excel is included in Pro & Business plans.',
            });
            return;
        }

        if (cards.length === 0) {
            showToast('No cards to export', 'info');
            return;
        }

        try {
            const res = await exportCards('csv');
            if (res.forbidden) {
                setUpgradeModal({
                    isOpen: true,
                    reason: 'feature_locked',
                    featureKey: res.feature || 'export_csv',
                    featureName: 'CSV & Excel Export',
                    message: res.message || 'Exporting contacts is not included in your current plan.',
                });
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
                                workspace={authWorkspace}
                                quota={subscriptionQuota}
                                onQuotaRefresh={refreshQuota}
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
                                quota={subscriptionQuota}
                                onQuotaRefresh={refreshQuota}
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

                {/* Plan Upgrade & Feature Gate Paywall Modal */}
                <PlanUpgradeModal
                    isOpen={upgradeModal.isOpen}
                    onClose={() => setUpgradeModal((prev) => ({ ...prev, isOpen: false }))}
                    reason={upgradeModal.reason}
                    featureKey={upgradeModal.featureKey}
                    featureName={upgradeModal.featureName}
                    message={upgradeModal.message}
                    workspace={authWorkspace}
                    onOpenFullDashboard={() => setIsSubscriptionDashboardOpen(true)}
                />

                {/* Full Customer Subscription & Usage Dashboard Sheet */}
                <CustomerSubscriptionDashboard
                    isOpen={isSubscriptionDashboardOpen}
                    onClose={() => setIsSubscriptionDashboardOpen(false)}
                    currentWorkspace={authWorkspace}
                    userRole={authWorkspace?.role || 'owner'}
                    onSwitchWorkspace={handleWorkspaceChanged}
                    workspaces={workspacesList}
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
