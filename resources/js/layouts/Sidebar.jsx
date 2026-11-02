import React from 'react';
import {
    LayoutDashboard,
    ScanLine,
    Users,
    Building2,
    CalendarRange,
    FileBarChart,
    Target,
    Clock,
    UserCheck,
    CreditCard,
    Settings,
    Sparkles,
    ChevronRight,
    Layers,
    X
} from 'lucide-react';

export const NAVIGATION_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Core' },
    { id: 'scanner', label: 'Scan Business Card', icon: ScanLine, section: 'Core', badge: 'AI Live', badgeColor: 'bg-emerald-500 text-white' },
    { id: 'contacts', label: 'All Contacts', icon: Users, section: 'Core' },
    { id: 'companies', label: 'Companies', icon: Building2, section: 'Core' },
    { id: 'exhibitions', label: 'Exhibitions & Events', icon: CalendarRange, section: 'Exhibition SaaS', badge: 'Active' },
    { id: 'reports', label: 'Event Reports', icon: FileBarChart, section: 'Exhibition SaaS' },
    { id: 'leads', label: 'Leads & Pipeline', icon: Target, section: 'Exhibition SaaS' },
    { id: 'followups', label: 'Follow-ups', icon: Clock, section: 'Exhibition SaaS', count: 4 },
    { id: 'team', label: 'Team Members', icon: UserCheck, section: 'Management' },
    { id: 'subscription', label: 'Subscription & Usage', icon: CreditCard, section: 'Management' },
    { id: 'settings', label: 'Settings', icon: Settings, section: 'Management' },
];

export default function Sidebar({
    activePage,
    onSelectPage,
    mobileOpen,
    onCloseMobile
}) {
    // Group navigation items by section
    const sections = ['Core', 'Exhibition SaaS', 'Management'];

    return (
        <>
            {/* Mobile Backdrop */}
            {mobileOpen && (
                <div
                    onClick={onCloseMobile}
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                />
            )}

            <aside
                className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-black/[0.06] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
                    mobileOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {/* Brand Header */}
                <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center text-white shadow-sm">
                            <ScanLine className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="font-extrabold text-base tracking-tight text-zinc-950">CardScan AI</h1>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800">
                                    SaaS
                                </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 font-medium">Exhibition & Lead Engine</p>
                        </div>
                    </div>
                    {/* Close button for mobile */}
                    <button
                        onClick={onCloseMobile}
                        className="lg:hidden w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-500"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Tenant / Exhibition Selector Widget */}
                <div className="p-4 mx-3 my-2 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-bold uppercase tracking-wider mb-1">
                        <span>Active Exhibition</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-xs font-bold text-zinc-900 truncate max-w-[170px]">
                                Ceramix India Expo 2026
                            </h4>
                            <p className="text-[10px] text-zinc-500">Booth #B-104 · Hall 2</p>
                        </div>
                        <Layers className="w-4 h-4 text-zinc-400 shrink-0" />
                    </div>
                </div>

                {/* Navigation Sections */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
                    {sections.map((sec) => (
                        <div key={sec} className="space-y-1">
                            <h3 className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                                {sec}
                            </h3>
                            <div className="space-y-0.5">
                                {NAVIGATION_ITEMS.filter((item) => item.section === sec).map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activePage === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                onSelectPage(item.id);
                                                if (onCloseMobile) onCloseMobile();
                                            }}
                                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all group active:scale-[0.98] ${
                                                isActive
                                                    ? 'bg-black text-white shadow-pill'
                                                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Icon
                                                    className={`w-4 h-4 transition-colors ${
                                                        isActive
                                                            ? 'text-white'
                                                            : 'text-zinc-400 group-hover:text-zinc-800'
                                                    }`}
                                                />
                                                <span>{item.label}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                {item.badge && (
                                                    <span
                                                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                                            isActive
                                                                ? 'bg-zinc-800 text-zinc-100'
                                                                : item.badgeColor || 'bg-zinc-100 text-zinc-600'
                                                        }`}
                                                    >
                                                        {item.badge}
                                                    </span>
                                                )}
                                                {item.count !== undefined && (
                                                    <span
                                                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                                                            isActive
                                                                ? 'bg-zinc-800 text-amber-300'
                                                                : 'bg-amber-100 text-amber-800'
                                                        }`}
                                                    >
                                                        {item.count}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quota / Storage Footer */}
                <div className="p-4 border-t border-zinc-100 bg-white">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-600 mb-1.5">
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>Scan Quota (Pro)</span>
                        </span>
                        <span className="font-mono text-zinc-900 font-bold">148 / 1,000</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-black rounded-full" style={{ width: '14.8%' }}></div>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-2">Team plan · Renews in 24 days</p>
                </div>
            </aside>
        </>
    );
}

