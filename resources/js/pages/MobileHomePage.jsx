import React from 'react';
import {
    ScanLine,
    CreditCard,
    Sparkles,
    ArrowRight,
    TrendingUp,
    Phone,
    MapPin,
    Building2,
    Calendar,
    FileSpreadsheet,
    Languages,
    ExternalLink
} from 'lucide-react';
import { AccuracyBadge } from '../components/common/Badge';

export default function MobileHomePage({
    cards,
    onNavigateToScan,
    onNavigateToCards,
    onSelectCard,
    onLoadSample,
    onExportCSV
}) {
    const totalCount = cards.length;
    const avgAccuracy = totalCount > 0
        ? Math.round(cards.reduce((acc, c) => acc + (c.accuracy_score || 95), 0) / totalCount)
        : 95;

    return (
        <div className="space-y-4 pb-24">
            {/* Bento Tile 1: Hero Scanner Action */}
            <div className="bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 rounded-3xl p-6 text-white shadow-behance-lg relative overflow-hidden">
                {/* Glow accent */}
                <div className="absolute top-0 right-0 -mr-12 -mt-12 w-44 h-44 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none"></div>

                <div className="relative z-10 space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-semibold text-emerald-400">
                        <Languages className="w-3 h-3" />
                        <span>Gujarati · Hindi · English Vision OCR</span>
                    </div>

                    <h2 className="text-xl font-extrabold tracking-tight leading-snug">
                        Ready to scan visiting cards at booth?
                    </h2>

                    <p className="text-xs text-zinc-300 leading-relaxed">
                        Multimodal Gemini AI decodes complex calligraphy, extracts 10-digit mobile numbers, and saves to your contacts.
                    </p>

                    <div className="pt-2 flex flex-col gap-2">
                        <button
                            onClick={onNavigateToScan}
                            className="w-full py-3.5 px-5 rounded-2xl bg-white text-zinc-950 text-xs font-extrabold hover:bg-zinc-100 transition-all shadow-pill active:scale-95 flex items-center justify-center gap-2"
                        >
                            <ScanLine className="w-4 h-4 text-zinc-950" />
                            <span>Open Camera Scanner</span>
                        </button>

                        <button
                            onClick={onLoadSample}
                            className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-semibold backdrop-blur-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Try Sample Gujarati Card (મોરબી ડેપો)</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Bento Row: Today's Metrics (2 Columns) */}
            <div className="grid grid-cols-2 gap-3">
                {/* Metric 1 */}
                <div
                    onClick={onNavigateToCards}
                    className="bg-white rounded-3xl p-4 shadow-behance border border-black/[0.04] space-y-1.5 cursor-pointer active:scale-95 transition-all"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Stored Cards</span>
                        <div className="w-7 h-7 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                            <CreditCard className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-extrabold text-zinc-950">
                        {totalCount}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" />
                        <span>All synced</span>
                    </div>
                </div>

                {/* Metric 2 */}
                <div className="bg-white rounded-3xl p-4 shadow-behance border border-black/[0.04] space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">OCR Precision</span>
                        <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-extrabold text-zinc-950">
                        {avgAccuracy}%
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium">
                        Regional text verified
                    </div>
                </div>
            </div>

            {/* Bento Tile 3: Recent Cards Section */}
            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-3.5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-extrabold text-zinc-950">Recent Business Cards</h3>
                        <p className="text-[11px] text-zinc-500">Latest trade fair booth scans</p>
                    </div>
                    <button
                        onClick={onNavigateToCards}
                        className="text-xs font-bold text-zinc-900 hover:text-black flex items-center gap-0.5"
                    >
                        <span>View All ({totalCount})</span>
                        <ArrowRight className="w-3 h-3" />
                    </button>
                </div>

                {cards.length === 0 ? (
                    <div className="text-center py-8 rounded-2xl bg-zinc-50 border border-zinc-200/60 p-4 space-y-2">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mx-auto text-zinc-400">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <h4 className="text-xs font-bold text-zinc-800">No cards stored yet</h4>
                        <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                            Tap the Scan button below or load the sample card to start building your directory.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {cards.slice(0, 4).map((card) => (
                            <div
                                key={card.id}
                                onClick={() => onSelectCard(card)}
                                className="p-3.5 rounded-2xl bg-zinc-50/80 hover:bg-zinc-50 border border-zinc-200/60 active:scale-95 transition-all flex items-center justify-between gap-2.5 cursor-pointer"
                            >
                                <div className="space-y-0.5 min-w-0">
                                    <h4 className="font-gujarati font-bold text-xs text-zinc-950 truncate">
                                        {card.company || card.name || 'Unnamed Business'}
                                    </h4>
                                    {card.company_english && card.company && (
                                        <p className="text-[10px] text-zinc-500 truncate">
                                            {card.company_english}
                                        </p>
                                    )}
                                    {Array.isArray(card.phone) && card.phone.length > 0 && (
                                        <p className="text-[10px] font-mono text-zinc-700 font-semibold flex items-center gap-1">
                                            <Phone className="w-2.5 h-2.5 text-zinc-400" />
                                            <span>{card.phone[0]}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="shrink-0 flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                                        {card.accuracy_score || 95}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bento Tile 4: Export & Utilities */}
            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-800 shrink-0">
                        <FileSpreadsheet className="w-5 h-5 text-zinc-700" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-zinc-950">Export Contacts</h4>
                        <p className="text-[10px] text-zinc-500">Download all cards as CSV / Excel</p>
                    </div>
                </div>

                <button
                    onClick={onExportCSV}
                    className="px-3.5 py-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-95 shrink-0"
                >
                    Export
                </button>
            </div>
        </div>
    );
}
