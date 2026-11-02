import React from 'react';
import {
    Building2,
    CalendarRange,
    FileBarChart,
    Target,
    Clock,
    UserCheck,
    CreditCard,
    Settings,
    Sparkles,
    ShieldCheck,
    ArrowRight
} from 'lucide-react';
import { NAVIGATION_ITEMS } from '../layouts/Sidebar';

export default function PlaceholderPage({ pageId, onNavigateToScanner }) {
    const item = NAVIGATION_ITEMS.find((nav) => nav.id === pageId) || {
        label: 'Module',
        icon: Sparkles,
        section: 'Exhibition SaaS',
    };
    const Icon = item.icon;

    const mockStats = {
        companies: [
            { label: 'Registered Enterprises', value: '86' },
            { label: 'Ceramics & Tiles', value: '42' },
            { label: 'Chemicals / Raw Material', value: '28' },
        ],
        exhibitions: [
            { label: 'Active Expo', value: 'Ceramix 2026' },
            { label: 'Upcoming', value: 'Vibrant Gujarat 2027' },
            { label: 'Total Leads Captured', value: '148' },
        ],
        reports: [
            { label: 'Daily Scan Rate', value: '24 cards/day' },
            { label: 'Top Region', value: 'Surat & Morbi' },
            { label: 'Avg OCR Accuracy', value: '95.8%' },
        ],
        leads: [
            { label: 'Hot Leads', value: '38' },
            { label: 'Warm Inquiries', value: '56' },
            { label: 'Pending WhatsApp', value: '14' },
        ],
        followups: [
            { label: 'Today', value: '4 reminders' },
            { label: 'Tomorrow', value: '9 reminders' },
            { label: 'Automated Drips', value: 'Active' },
        ],
        team: [
            { label: 'Active Booth Reps', value: '4 Members' },
            { label: 'Admin', value: 'Saunak K.' },
            { label: 'Concurrent Scanners', value: 'Unlimited' },
        ],
        subscription: [
            { label: 'Current Plan', value: 'Exhibition Pro' },
            { label: 'Quota Remaining', value: '852 / 1,000' },
            { label: 'Storage Status', value: 'Active & Synced' },
        ],
        settings: [
            { label: 'Default Script', value: 'Gujarati / English' },
            { label: 'Auto Transliteration', value: 'Enabled' },
            { label: 'Camera Resolution', value: '1800px Optimized' },
        ],
    };

    const currentStats = mockStats[pageId] || [
        { label: 'Status', value: 'Ready for Phase 2' },
        { label: 'Module', value: item.label },
    ];

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-behance border border-black/[0.04] space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center shadow-sm">
                        <Icon className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-extrabold tracking-tight text-zinc-950">
                                {item.label}
                            </h2>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                                {item.section}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 font-medium mt-0.5">
                            Frontend architecture scaffolded and ready for full SaaS business logic.
                        </p>
                    </div>
                </div>

                {/* Mock KPIs for this module */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                    {currentStats.map((stat, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                            <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                                {stat.label}
                            </span>
                            <span className="text-lg font-extrabold text-zinc-950">{stat.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Context Notice & Quick Action */}
            <div className="bg-white rounded-3xl p-6 shadow-behance border border-black/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-zinc-950">
                            Core Scanner & Contact Database Active
                        </h4>
                        <p className="text-xs text-zinc-500">
                            You can scan cards, extract Gujarati/Hindi text, and manage contacts while this module is being staged.
                        </p>
                    </div>
                </div>

                <button
                    onClick={onNavigateToScanner}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-black text-white text-xs font-bold hover:bg-zinc-800 transition-all shadow-pill active:scale-95 shrink-0"
                >
                    <span>Launch Card Scanner</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

