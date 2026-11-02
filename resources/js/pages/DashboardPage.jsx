import React from 'react';
import {
    ScanLine,
    Users,
    Target,
    Clock,
    Sparkles,
    ArrowUpRight,
    TrendingUp,
    Building2,
    MapPin,
    Phone,
    Calendar,
    ChevronRight,
    CheckCircle2,
    Plus
} from 'lucide-react';
import { AccuracyBadge, StatusBadge } from '../components/common/Badge';

export default function DashboardPage({
    cards,
    onNavigateToScanner,
    onNavigateToContacts
}) {
    const totalCards = cards.length;
    const hotLeads = Math.min(totalCards, 8);
    const followUpsDue = 4;
    const avgAccuracy = totalCards > 0
        ? Math.round(cards.reduce((acc, c) => acc + (c.accuracy_score || 95), 0) / totalCards)
        : 95;

    return (
        <div className="space-y-8">
            {/* Top SaaS Welcome & Quick Scan Action Banner */}
            <div className="relative rounded-3xl bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 p-6 sm:p-8 text-white shadow-behance-lg overflow-hidden">
                {/* Background glowing orb accent */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-semibold text-emerald-400">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Live Exhibition Lead Capture Active</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                            Exhibition Lead Command Center
                        </h2>
                        <p className="text-xs sm:text-sm text-zinc-300 font-normal leading-relaxed">
                            Connected to Ceramix Expo 2026. Scan visiting cards in Gujarati, Hindi or English to instantly generate CRM contacts and follow-ups.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={onNavigateToScanner}
                            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-zinc-950 text-xs font-extrabold hover:bg-zinc-100 transition-all shadow-pill active:scale-95"
                        >
                            <ScanLine className="w-4 h-4 text-zinc-950" />
                            <span>Scan New Card</span>
                        </button>
                        <button
                            onClick={onNavigateToContacts}
                            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-all active:scale-95"
                        >
                            <Users className="w-4 h-4" />
                            <span>All Contacts ({totalCards})</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Stat Cards (Behance diffused shadow) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stat 1 */}
                <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Scanned</span>
                        <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                            <ScanLine className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
                            {totalCards > 0 ? totalCards : 148}
                        </span>
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
                            <TrendingUp className="w-3 h-3" />
                            <span>+24 today</span>
                        </span>
                    </div>
                    <p className="text-[11px] text-zinc-500">Across 3 expo booths</p>
                </div>

                {/* Stat 2 */}
                <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Qualified Leads</span>
                        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
                            <Target className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
                            94
                        </span>
                        <span className="text-xs font-semibold text-rose-600">63% conversion</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">High purchase intent</p>
                </div>

                {/* Stat 3 */}
                <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">OCR Confidence</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                            <Sparkles className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
                            {avgAccuracy}%
                        </span>
                        <span className="text-xs font-semibold text-emerald-600">Multimodal</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">Gujarati & Hindi calligraphy</p>
                </div>

                {/* Stat 4 */}
                <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Pending Follow-ups</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
                            {followUpsDue}
                        </span>
                        <span className="text-xs font-semibold text-amber-700">Due today</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">Auto WhatsApp / Email</p>
                </div>
            </div>

            {/* Middle Grid: Recent Scanned Cards & Lead Funnel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Recent Cards List (8 cols) */}
                <div className="lg:col-span-8 bg-white rounded-3xl p-6 shadow-behance border border-black/[0.04] space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-extrabold tracking-tight text-zinc-950">
                                Recently Scanned Business Cards
                            </h3>
                            <p className="text-xs text-zinc-500">Real-time sync from mobile scanner</p>
                        </div>
                        <button
                            onClick={onNavigateToContacts}
                            className="text-xs font-bold text-zinc-900 hover:text-black flex items-center gap-1 transition-colors"
                        >
                            <span>View All</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {cards.length === 0 ? (
                        <div className="text-center py-12 rounded-2xl bg-zinc-50 border border-zinc-200/60 p-6 space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto text-zinc-400">
                                <ScanLine className="w-6 h-6" />
                            </div>
                            <h4 className="text-sm font-bold text-zinc-900">No cards scanned yet</h4>
                            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                                Scan your first visiting card or try the Morbi Depo sample card to see extracted contacts here.
                            </p>
                            <button
                                onClick={onNavigateToScanner}
                                className="px-4 py-2 rounded-full bg-black text-white text-xs font-bold shadow-pill active:scale-95"
                            >
                                Open Scanner
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cards.slice(0, 5).map((card) => (
                                <div
                                    key={card.id}
                                    className="p-4 rounded-2xl bg-zinc-50/70 hover:bg-zinc-50 border border-zinc-200/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-gujarati font-bold text-sm text-zinc-950">
                                                {card.company || card.name || 'Unnamed Business'}
                                            </h4>
                                            {card.company_english && card.company && (
                                                <span className="text-xs text-zinc-500 font-medium">
                                                    ({card.company_english})
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                                            {card.name && (
                                                <span className="font-medium text-zinc-900">{card.name}</span>
                                            )}
                                            {Array.isArray(card.phone) && card.phone.length > 0 && (
                                                <span className="font-mono text-zinc-700 flex items-center gap-1">
                                                    <Phone className="w-3 h-3 text-zinc-400" />
                                                    {card.phone[0]}
                                                </span>
                                            )}
                                            {card.address && (
                                                <span className="truncate max-w-[240px] text-zinc-500 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                                                    {card.address}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                                        <AccuracyBadge score={card.accuracy_score} />
                                        <StatusBadge status="verified" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Column: Exhibition Pipeline & Top Industries (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Pipeline Progress */}
                    <div className="bg-white rounded-3xl p-6 shadow-behance border border-black/[0.04] space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-extrabold text-zinc-950">Exhibition Funnel</h3>
                            <span className="text-[11px] font-bold text-zinc-400">Ceramix 2026</span>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <div className="flex justify-between font-semibold mb-1">
                                    <span className="text-zinc-600">Scanned & Verified</span>
                                    <span className="font-mono text-zinc-950">148 (100%)</span>
                                </div>
                                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-black rounded-full" style={{ width: '100%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between font-semibold mb-1">
                                    <span className="text-zinc-600">Catalogue / WhatsApp Sent</span>
                                    <span className="font-mono text-zinc-950">112 (75%)</span>
                                </div>
                                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '75%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between font-semibold mb-1">
                                    <span className="text-zinc-600">Sample Requested</span>
                                    <span className="font-mono text-zinc-950">46 (31%)</span>
                                </div>
                                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '31%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between font-semibold mb-1">
                                    <span className="text-zinc-600">Deals Closed</span>
                                    <span className="font-mono text-zinc-950">18 (12%)</span>
                                </div>
                                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 rounded-full" style={{ width: '12%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Regional Languages Breakdown */}
                    <div className="bg-white rounded-3xl p-6 shadow-behance border border-black/[0.04] space-y-3.5">
                        <h3 className="text-sm font-extrabold text-zinc-950">Script Distribution</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/60">
                                <span className="font-gujarati font-bold text-zinc-900">ગુજરાતી (Gujarati)</span>
                                <span className="font-mono font-bold text-zinc-950">58%</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/60">
                                <span className="font-medium text-zinc-900">English</span>
                                <span className="font-mono font-bold text-zinc-950">32%</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/60">
                                <span className="font-hindi font-bold text-zinc-900">हिंदी (Hindi / Mixed)</span>
                                <span className="font-mono font-bold text-zinc-950">10%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
