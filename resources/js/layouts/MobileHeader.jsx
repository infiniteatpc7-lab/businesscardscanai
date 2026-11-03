import React from 'react';
import { ScanLine, Sparkles, Calendar, ChevronDown } from 'lucide-react';

export default function MobileHeader({
    onLoadSample,
    currentExhibition,
    onOpenExhibitionSelector
}) {
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
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-900 transition-all active:scale-95 max-w-[170px] truncate shadow-2xs"
                        title="Change Active Exhibition"
                    >
                        <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span className="truncate">{currentExhibition.name}</span>
                        <ChevronDown className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                    </button>
                )}

                {/* Right: Sample trigger button */}
                {onLoadSample && (
                    <button
                        onClick={onLoadSample}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white border border-zinc-200/80 text-zinc-800 hover:bg-zinc-50 shadow-sm active:scale-95 transition-all shrink-0"
                        title="Load Sample Gujarati Card (મોરબી ડેપો)"
                    >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Sample</span>
                    </button>
                )}
            </div>
        </header>
    );
}
