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
    ChevronRight,
    CheckCircle2
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
        <div className="space-y-3 pb-20">
            {/* Dedicated Exhibition Line-Art Animated Banner Section */}
            <div className="w-full rounded-3xl overflow-hidden shadow-behance border border-black/[0.05] bg-white">
                <video
                    src="/images/animatebanner.mp4"
                    poster="/images/business-exhibition-banner.webp"
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls={false}
                    disablePictureInPicture
                    disableRemotePlayback
                    className="w-full h-auto aspect-[16/7] object-cover block select-none pointer-events-none"
                    style={{ WebkitMediaControls: 'none' }}
                />
            </div>

            {/* Bento Tile 1: Hero Scanner Action with bg.jpg background */}
            <div className="rounded-3xl p-5 sm:p-6 text-white shadow-behance border border-black/10 relative overflow-hidden bg-zinc-950">
                {/* Background Image (Preserved exactly as newly added) */}
                <img
                    src="/bg.jpg"
                    alt="Scanner Background"
                    className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
                />
                {/* Contrast Scrim / Overlay so text & buttons pop clearly */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/45 pointer-events-none" />

                <div className="relative z-10 space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md text-[10px] font-semibold text-emerald-400">
                        <Languages className="w-3 h-3" />
                        <span>Gujarati · Hindi · English Recognition</span>
                    </div>

                    <h2 className="text-xl font-extrabold tracking-tight leading-snug drop-shadow-sm">
                        Ready to scan visiting cards at booth?
                    </h2>

                    <p className="text-xs text-zinc-200 leading-relaxed drop-shadow-sm">
                        Instantly extract business details, phone numbers, and complete postal addresses directly into your directory.
                    </p>

                    <div className="pt-1.5 flex flex-col gap-2">
                        <button
                            onClick={onNavigateToScan}
                            className="w-full py-3 px-5 rounded-2xl bg-white text-zinc-950 text-xs font-extrabold hover:bg-zinc-100 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                        >
                            <ScanLine className="w-4 h-4 text-zinc-950" />
                            <span>Open Camera Scanner</span>
                        </button>

                        <button
                            onClick={onLoadSample}
                            className="w-full py-2 px-4 rounded-xl bg-black/40 hover:bg-black/60 border border-white/20 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Try Sample Gujarati Card (મોરબી ડેપો)</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Bento Row: Metrics (2 Columns) - Compact, balanced */}
            <div className="grid grid-cols-2 gap-2.5">
                {/* Metric 1: Stored Cards */}
                <div
                    onClick={onNavigateToCards}
                    className="bg-white rounded-3xl p-3.5 shadow-behance border border-black/[0.04] space-y-1 cursor-pointer active:scale-95 transition-all"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Stored Cards</span>
                        <div className="w-7 h-7 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                            <CreditCard className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-extrabold text-zinc-950 leading-none py-0.5">
                        {totalCount}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" />
                        <span>All synced</span>
                    </div>
                </div>

                {/* Metric 2: Languages (Renamed from Scripts, clearly displaying Gujarati, Hindi, English) */}
                <div className="bg-white rounded-3xl p-3.5 shadow-behance border border-black/[0.04] space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Languages</span>
                        <div className="w-7 h-7 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center">
                            <Languages className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-sm font-extrabold text-zinc-950 leading-none py-1 truncate">
                        Gujarati · Hindi
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium truncate flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                        <span>English Recognition</span>
                    </div>
                </div>
            </div>

            {/* Bento Tile 3: Recent Cards Section (Max 3 records, refined hierarchy, compact) */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-behance border border-black/[0.04] space-y-3">
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
                    <div className="text-center py-7 rounded-2xl bg-zinc-50 border border-zinc-200/60 p-4 space-y-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center mx-auto text-zinc-400">
                            <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                            <h4 className="text-xs font-bold text-zinc-800">No cards stored yet</h4>
                            <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                                Scan your first business card at the booth or load the sample card.
                            </p>
                        </div>
                        <button
                            onClick={onNavigateToScan}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
                        >
                            <ScanLine className="w-3.5 h-3.5" />
                            <span>Scan First Card</span>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Show a maximum of 3 recent records */}
                        {cards.slice(0, 3).map((card) => {
                            const displayName = card.company || card.company_english || card.name || 'Unnamed Business';
                            const primaryPhone = Array.isArray(card.phone) && card.phone.length > 0 ? card.phone[0] : (typeof card.phone === 'string' ? card.phone : null);

                            return (
                                <div
                                    key={card.id}
                                    onClick={() => onSelectCard(card)}
                                    className="p-3 rounded-2xl bg-zinc-50/80 hover:bg-zinc-100/70 border border-zinc-200/60 active:scale-95 transition-all flex items-center justify-between gap-2.5 cursor-pointer"
                                >
                                    <div className="space-y-1 min-w-0 flex-1">
                                        {/* Company / Main Entity */}
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-gujarati font-extrabold text-xs text-zinc-950 truncate max-w-[210px]">
                                                {displayName}
                                            </h4>
                                            {card.detected_language && (
                                                <span className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-zinc-200/70 text-zinc-600 font-bold shrink-0">
                                                    {card.detected_language}
                                                </span>
                                            )}
                                        </div>

                                        {/* Contact Person & Designation */}
                                        {(card.name || card.designation) && (
                                            <div className="flex items-center gap-1 text-[11px] text-zinc-600 truncate">
                                                <User className="w-3 h-3 text-zinc-400 shrink-0" />
                                                <span className="font-semibold text-zinc-800 truncate font-gujarati">
                                                    {card.name || 'Contact'}
                                                </span>
                                                {card.designation && (
                                                    <span className="text-zinc-400 text-[10px] truncate">
                                                        · {card.designation}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Phone Number */}
                                        {primaryPhone && (
                                            <p className="text-[10px] font-mono text-zinc-700 font-semibold flex items-center gap-1">
                                                <Phone className="w-2.5 h-2.5 text-zinc-400" />
                                                <span className="truncate">{primaryPhone}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="shrink-0 flex items-center text-zinc-400 pl-1">
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Bento Tile 4: Export Contacts - Compact */}
            <div className="bg-white rounded-3xl p-4 shadow-behance border border-black/[0.04] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-800 shrink-0">
                        <FileSpreadsheet className="w-4 h-4 text-zinc-700" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-zinc-950">Export Contacts</h4>
                        <p className="text-[10px] text-zinc-500">Download all cards as CSV / Excel</p>
                    </div>
                </div>

                <button
                    onClick={onExportCSV}
                    disabled={totalCount === 0}
                    className="px-3.5 py-1.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-900 text-xs font-bold transition-all active:scale-95 shrink-0"
                >
                    Export
                </button>
            </div>
        </div>
    );
}
