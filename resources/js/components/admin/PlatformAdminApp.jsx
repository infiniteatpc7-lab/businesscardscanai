import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import {
    getAdminToken,
    getAdminProfile,
    fetchAdminMe,
    logoutAdmin,
    fetchDashboardStats
} from '../../services/platformAdminApi';
import AdminLoginView from './AdminLoginView';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import AdminDashboardView from './AdminDashboardView';
import AdminCustomersView from './AdminCustomersView';
import AdminWorkspacesView from './AdminWorkspacesView';
import AdminAuditLogsView from './AdminAuditLogsView';

export default function PlatformAdminApp() {
    const [adminProfile, setAdminProfile] = useState(() => getAdminProfile());
    const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAdminToken()));
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [currentTab, setCurrentTab] = useState('dashboard'); // dashboard | customers | workspaces | audit
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Dark/Light Theme state matching admincn ModeToggle
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('admin_theme');
        if (saved) return saved === 'dark';
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('admin_theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('admin_theme', 'light');
        }
    }, [isDark]);

    const handleToggleTheme = () => {
        setIsDark((prev) => !prev);
    };

    // Dashboard metrics
    const [stats, setStats] = useState(null);
    const [isStatsLoading, setIsStatsLoading] = useState(false);

    // Cross-view selection
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);

    // Verify session
    useEffect(() => {
        const verify = async () => {
            const token = getAdminToken();
            if (!token) {
                setIsAuthenticated(false);
                setIsCheckingAuth(false);
                return;
            }

            try {
                const res = await fetchAdminMe();
                if (res.success && res.admin) {
                    setAdminProfile(res.admin);
                    setIsAuthenticated(true);
                } else {
                    setIsAuthenticated(false);
                    setAdminProfile(null);
                }
            } catch (err) {
                console.error('Session verify error:', err);
                setIsAuthenticated(false);
            } finally {
                setIsCheckingAuth(false);
            }
        };

        verify();
    }, []);

    // Load stats
    const loadStats = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsStatsLoading(true);
        try {
            const res = await fetchDashboardStats();
            if (res.success && res.metrics) {
                setStats(res);
            }
        } catch (err) {
            console.error('Failed to load dashboard metrics:', err);
        } finally {
            setIsStatsLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated && currentTab === 'dashboard') {
            loadStats();
        }
    }, [isAuthenticated, currentTab, loadStats]);

    const handleLoginSuccess = (admin) => {
        setAdminProfile(admin);
        setIsAuthenticated(true);
        setCurrentTab('dashboard');
    };

    const handleLogout = async () => {
        await logoutAdmin();
        setAdminProfile(null);
        setIsAuthenticated(false);
        setStats(null);
    };

    const handleTabChange = (tab) => {
        setCurrentTab(tab);
        setMobileOpen(false);
    };

    const handleSelectCustomer = (customerId) => {
        setSelectedCustomerId(customerId);
        setCurrentTab('customers');
    };

    // Splash loading spinner
    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center text-slate-800 dark:text-zinc-200 select-none">
                <Loader2 className="w-6 h-6 text-orange-500 animate-spin mb-2" />
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Verifying Session...</p>
            </div>
        );
    }

    // Login screen if not authenticated
    if (!isAuthenticated) {
        return <AdminLoginView onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 flex flex-col lg:flex-row text-slate-900 dark:text-zinc-100 antialiased font-sans transition-colors">
            {/* Sidebar Navigation */}
            <AdminSidebar
                currentTab={currentTab}
                onTabChange={handleTabChange}
                adminProfile={adminProfile}
                onLogout={handleLogout}
                mobileOpen={mobileOpen}
                onCloseMobile={() => setMobileOpen(false)}
                isCollapsed={isCollapsed}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 min-h-screen">
                <AdminHeader
                    currentTab={currentTab}
                    onToggleSidebar={() => {
                        if (window.innerWidth < 1024) {
                            setMobileOpen((prev) => !prev);
                        } else {
                            setIsCollapsed((prev) => !prev);
                        }
                    }}
                    isDark={isDark}
                    onToggleTheme={handleToggleTheme}
                    onRefresh={currentTab === 'dashboard' ? loadStats : () => window.location.reload()}
                    isRefreshing={isStatsLoading}
                    adminProfile={adminProfile}
                />

                <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
                    {currentTab === 'dashboard' && (
                        <AdminDashboardView
                            stats={stats}
                            isLoading={isStatsLoading}
                            onNavigateTab={handleTabChange}
                            onSelectCustomer={handleSelectCustomer}
                        />
                    )}

                    {currentTab === 'customers' && (
                        <AdminCustomersView
                            initialSelectedCustomerId={selectedCustomerId}
                            onClearSelectedCustomer={() => setSelectedCustomerId(null)}
                        />
                    )}

                    {currentTab === 'workspaces' && <AdminWorkspacesView />}

                    {currentTab === 'audit' && <AdminAuditLogsView />}
                </main>
            </div>
        </div>
    );
}
