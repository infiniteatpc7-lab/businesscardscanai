import React from 'react';
import { PanelLeft, RefreshCw, ChevronRight } from 'lucide-react';
import ModeToggle from './ModeToggle';

export default function AdminHeader({
    currentTab,
    onToggleSidebar,
    isDark,
    onToggleTheme,
    onRefresh,
    isRefreshing,
    adminProfile
}) {
    const titles = {
        dashboard: { section: 'Dashboards', label: 'Overview', subtitle: 'Platform telemetry and analytics' },
        'ai-costs': { section: 'Dashboards', label: 'AI Usage & Costs', subtitle: 'Gemini API requests and cost tracking' },
        customers: { section: 'Management', label: 'Customers', subtitle: 'Customer accounts and workspace tenants' },
        workspaces: { section: 'Management', label: 'Workspaces', subtitle: 'Multi-tenant organizations and card stores' },
        plans: { section: 'Management', label: 'Plans & Pricing', subtitle: 'SaaS subscription plans and tier limits' },
        audit: { section: 'Security', label: 'Audit Trail', subtitle: 'Cryptographic system audit logs' },
    };

    const currentMeta = titles[currentTab] || { section: 'Platform', label: 'Console', subtitle: '' };

    return (
        <header className="h-16 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none transition-colors">
            {/* Left: Sidebar Trigger + Vertical Divider + Breadcrumbs matching admincn */}
            <div className="flex items-center gap-3 min-w-0">
                <button
                    type="button"
                    onClick={onToggleSidebar}
                    title="Toggle Sidebar"
                    className="p-2 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                    <PanelLeft className="w-5 h-5" />
                    <span className="sr-only">Toggle Sidebar</span>
                </button>

                <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-zinc-800" />

                {/* Breadcrumbs matching admincn */}
                <nav className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 dark:text-zinc-400 font-medium hidden sm:inline">{currentMeta.section}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 hidden sm:inline" />
                    <span className="font-semibold text-slate-900 dark:text-white">{currentMeta.label}</span>
                </nav>
            </div>

            {/* Right: Status Pill + Refresh + Theme Toggle + User Avatar */}
            <div className="flex items-center gap-2 sm:gap-3">
                {/* Status Pill */}
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>System Active</span>
                </div>

                {/* Refresh Button */}
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    title="Refresh data"
                    className="size-9 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orange-500' : ''}`} />
                </button>

                {/* Dark/Light Mode Toggle matching admincn */}
                <ModeToggle isDark={isDark} onToggle={onToggleTheme} />

                {/* Profile Pill */}
                <div className="flex items-center gap-2 pl-1">
                    <div className="relative">
                        <div className="size-8 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center border border-slate-300 dark:border-zinc-700">
                            {adminProfile?.name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <span className="absolute right-0 bottom-0 block size-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
                    </div>
                </div>
            </div>
        </header>
    );
}
