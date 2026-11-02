import React from 'react';
import {
    ScanLine,
    CreditCard,
    Sparkles,
    ArrowRight,
    TrendingUp,
    Phone,
    FileSpreadsheet,
    Languages,
    User,
    ChevronRight
} from 'lucide-react';

export default function MobileHomePage({
    cards,
    onNavigateToScan,
    onNavigateToCards,
    onSelectCard,
    onLoadSample,
    onExportCSV
}) {
    const totalCount = cards.length;

    return (
        <div className="space-y-4 pb-24">
            {/* Bento Tile 1: Hero Scanner Action (Solid premium dark, no gratuitous glow or blur) */}
            <div className="bg-zinc-950 rounded-3xl p-6 text-white shadow-behance border border-zinc-800 relative overflow-hidden">
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-emerald-400">
                        <Languages className="w-3 h-3" />
                        <span>Gujarati · Hindi · English Recognition</span>
                    </div>

                    <h2 className="text-xl font-extrabold tracking-tight leading-snug">
                        Ready to scan visiting cards at booth?
                    </h2>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                        Instantly extract business details, 10-digit mobile numbers, and complete postal addresses directly into your directory.
                    </p>

                    <div className="pt-2 flex flex-col gap-2">
                        <button
                            onClick={onNavigateToScan}
                            className="w-full py-3.5 px-5 rounded-2xl bg-white text-zinc-950 text-xs font-extrabold hover:bg-zinc-100 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                        >
                            <ScanLine className="w-4 h-4 text-zinc-950" />
                            <span>Open Camera Scanner</span>
                        </button>

                        <button
                            onClick={onLoadSample}
                            className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Try Sample Gujarati Card (મોરબી ડેપો)</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Bento Row: Metrics (2 Columns) */}
            <div className="grid grid-cols-2 gap-3">
                {/* Metric 1: Stored Cards */}
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

                {/* Metric 2: Script Support */}
                <div className="bg-white rounded-3xl p-4 shadow-behance border border-black/[0.04] space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Scripts</span>
                        <div className="w-7 h-7 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center">
                            <Languages className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-extrabold text-zinc-950">
                        Multi
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium">
                        Gujarati · Hindi · EN
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
                    {totalCount > 0 && (
                        <button
                            onClick={onNavigateToCards}
                            className="text-xs font-bold text-zinc-900 hover:text-black flex items-center gap-0.5"
                        >
                            <span>View All ({totalCount})</span>
                            <ArrowRight className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {cards.length === 0 ? (
                    <div className="text-center py-8 rounded-2xl bg-zinc-50 border border-zinc-200/60 p-4 space-y-3">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mx-auto text-zinc-400">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-xs font-bold text-zinc-800">No cards stored yet</h4>
                            <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                                Scan your first business card at the booth or load the sample card.
                            </p>
                        </div>
                        <button
                            onClick={onNavigateToScan}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
                        >
                            <ScanLine className="w-3.5 h-3.5" />
                            <span>Scan First Card</span>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {cards.slice(0, 4).map((card) => (
                            <div
                                key={card.id}
                                onClick={() => onSelectCard(card)}
                                className="p-3.5 rounded-2xl bg-zinc-50/80 hover:bg-zinc-100/70 border border-zinc-200/60 active:scale-95 transition-all flex items-center justify-between gap-2.5 cursor-pointer"
                            >
                                <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-gujarati font-extrabold text-xs text-zinc-950 truncate">
                                            {card.company || card.company_english || card.name || 'Unnamed Business'}
                                        </h4>
                                        {card.detected_language && (
                                            <span className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-zinc-200/60 text-zinc-600 font-bold shrink-0">
                                                {card.detected_language}
                                            </span>
                                        )}
                                    </div>

                                    {(card.name || card.designation) && (
                                        <div className="flex items-center gap-1 text-[11px] text-zinc-600 truncate">
                                            <User className="w-3 h-3 text-zinc-400 shrink-0" />
                                            <span className="font-medium truncate font-gujarati">{card.name}</span>
                                            {card.designation && (
                                                <span className="text-zinc-400 text-[10px]">({card.designation})</span>
                                            )}
                                        </div>
                                    )}

                                    {Array.isArray(card.phone) && card.phone.length > 0 && (
                                        <p className="text-[10px] font-mono text-zinc-700 font-semibold flex items-center gap-1">
                                            <Phone className="w-2.5 h-2.5 text-zinc-400" />
                                            <span>{card.phone[0]}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="shrink-0 flex items-center text-zinc-400 pl-1">
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bento Tile 4: Export Contacts */}
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
                    disabled={totalCount === 0}
                    className="px-3.5 py-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-900 text-xs font-bold transition-all active:scale-95 shrink-0"
                >
                    Export
                </button>
            </div>
        </div>
    );
}
