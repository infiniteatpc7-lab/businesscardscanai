import React from 'react';
import { PanelLeft, RefreshCw, ChevronRight } from 'lucide-react';
import ModeToggle from './ModeToggle';
import { Badge } from './ui/badge';
import { IconButton } from './ui/button';
import { Separator } from './ui/separator';

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
        <header className="h-16 bg-white dark:bg-zinc-950 border-b border-slate-200/80 dark:border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none transition-colors">
            {/* Left: Sidebar Trigger + Vertical Divider + Breadcrumbs matching admincn */}
            <div className="flex items-center gap-3 min-w-0">
                <IconButton
                    variant="ghost"
                    onClick={onToggleSidebar}
                    title="Toggle Sidebar"
                    className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                >
                    <PanelLeft className="w-5 h-5" />
                    <span className="sr-only">Toggle Sidebar</span>
                </IconButton>

                <Separator orientation="vertical" className="hidden sm:block h-4" />

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
                <Badge variant="success" className="hidden md:inline-flex items-center gap-1.5 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>System Active</span>
                </Badge>

                {/* Refresh Button */}
                <IconButton
                    variant="outline"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    title="Refresh data"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orange-500' : ''}`} />
                </IconButton>

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
