import React from 'react';
import { ScanLine, Calendar, ChevronDown } from 'lucide-react';

export default function MobileHeader({
    onNavigateToScan,
    onLoadSample,
    currentExhibition,
    onOpenExhibitionSelector
}) {
    const handleScanNow = onNavigateToScan || onLoadSample;
    return (
        <header className="sticky top-0 z-40 bg-[#F4F4F6]/90 backdrop-blur-xl border-b border-black/[0.05] px-4 py-2">
            <div className="max-w-md mx-auto flex items-center justify-between gap-2">
                {/* Brand */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center text-white shadow-sm">
                        <ScanLine className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h1 className="font-extrabold text-xs tracking-tight text-zinc-950 leading-tight">
                            CardScan AI
                        </h1>
                        <p className="text-[9px] text-zinc-500 font-medium leading-tight">
                            Booth Scanner
                        </p>
                    </div>
                </div>

                {/* Center / Right: Interactive Exhibition Badge */}
                {currentExhibition && (
                    <button
                        onClick={onOpenExhibitionSelector}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-900 transition-all active:scale-95 max-w-[170px] truncate shadow-2xs cursor-pointer"
                        title="Change Active Exhibition"
                    >
                        <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span className="truncate">{currentExhibition.name}</span>
                        <ChevronDown className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                    </button>
                )}

                {/* Right: Scan Now action button */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {handleScanNow && (
                        <button
                            onClick={handleScanNow}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-white border border-zinc-200/80 text-zinc-900 hover:bg-zinc-50 shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
                            title="Scan Now"
                        >
                            <ScanLine className="w-3 h-3 text-orange-600" />
                            <span>Scan Now</span>
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
