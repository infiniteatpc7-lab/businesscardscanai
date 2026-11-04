import React from 'react';
import {
    LayoutDashboard,
    Users,
    Building2,
    CreditCard,
    FileText,
    LogOut,
    ExternalLink,
    X,
    Shield,
    Cpu
} from 'lucide-react';
import AdminCnLogo from './AdminCnLogo';

export default function AdminSidebar({
    currentTab,
    onTabChange,
    adminProfile,
    onLogout,
    mobileOpen,
    onCloseMobile,
    isCollapsed
}) {
    const navGroups = [
        {
            groupLabel: 'Dashboards',
            items: [
                { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, badge: null },
                { id: 'ai-costs', label: 'AI Usage & Costs', icon: Cpu, badge: 'Gemini', badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
            ],
        },
        {
            groupLabel: 'Management',
            items: [
                { id: 'customers', label: 'Customers', icon: Users, badge: null },
                { id: 'workspaces', label: 'Workspaces', icon: Building2, badge: null },
                { id: 'plans', label: 'Plans & Pricing', icon: CreditCard, badge: null },
            ],
        },
        {
            groupLabel: 'Security',
            items: [
                { id: 'audit', label: 'Audit Trail', icon: FileText, badge: 'Live', badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' },
            ],
        },
    ];

    const sidebarContent = (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 select-none transition-colors">
            {/* Brand Header */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/80 dark:border-zinc-800/80">
                <div className="flex items-center gap-2.5 min-w-0">
                    <AdminCnLogo className="size-8 shrink-0 text-slate-900 dark:text-white" />
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                                AdminCN
                            </h2>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                                AI
                            </span>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium block mt-0.5 truncate">
                            CardScan Platform
                        </span>
                    </div>
                </div>

                {mobileOpen && (
                    <button
                        type="button"
                        onClick={onCloseMobile}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 lg:hidden"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Navigation Groups */}
            <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
                {navGroups.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 py-1 block">
                            {group.groupLabel}
                        </span>
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = currentTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onTabChange(item.id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                                        isActive
                                            ? 'bg-orange-500 text-white shadow-xs font-semibold'
                                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900'
                                    }`}
                                >
                                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-zinc-400'}`} />
                                    <span className="flex-1 truncate">{item.label}</span>
                                    {item.badge && (
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                            isActive
                                                ? 'bg-white/20 text-white'
                                                : item.badgeClass || 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                                        }`}>
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}

                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 py-1 block">
                        Quick Links
                    </span>
                    <a
                        href="/"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                    >
                        <span className="truncate">Customer App</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                    </a>
                </div>
            </nav>

            {/* Profile Footer */}
            <div className="p-3 border-t border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40">
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:border-slate-200/70 dark:hover:border-zinc-800 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                            <div className="size-8 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center shrink-0">
                                {adminProfile?.name?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <span className="absolute right-0 bottom-0 block size-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {adminProfile?.name || 'Administrator'}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                                {adminProfile?.email || 'admin@businesscardscan.ai'}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onLogout}
                        title="Sign out"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors shrink-0 cursor-pointer"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop persistent sidebar */}
            <aside className={`hidden lg:block shrink-0 min-h-screen transition-all ${isCollapsed ? 'w-0' : 'w-64'}`}>
                <div className={`fixed top-0 left-0 h-screen z-40 transition-all ${isCollapsed ? '-translate-x-full w-64' : 'w-64 translate-x-0'}`}>
                    {sidebarContent}
                </div>
            </aside>

            {/* Mobile Drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
                        onClick={onCloseMobile}
                    />
                    <div className="fixed inset-y-0 left-0 w-72 max-w-[80vw] shadow-2xl z-50">
                        {sidebarContent}
                    </div>
                </div>
            )}
        </>
    );
}
