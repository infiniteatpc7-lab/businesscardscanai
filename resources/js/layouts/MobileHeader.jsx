import React from 'react';
import {
    ScanLine,
    Sparkles
} from 'lucide-react';

export default function MobileHeader({
    onLoadSample
}) {
    return (
        <header className="sticky top-0 z-40 bg-[#F4F4F6]/90 backdrop-blur-xl border-b border-black/[0.05] px-4 py-3">
            <div className="max-w-md mx-auto flex items-center justify-between">
                {/* Brand */}
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center text-white shadow-sm">
                        <ScanLine className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h1 className="font-extrabold text-sm tracking-tight text-zinc-950">CardScan AI</h1>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-200/80 text-zinc-800">
                                PRO
                            </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-medium">Exhibition Scanner</p>
                    </div>
                </div>

                {/* Right: Badge matching 3rd screenshot & Sample trigger */}
                <div className="flex items-center gap-2">
                    {onLoadSample && (
                        <button
                            onClick={onLoadSample}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white border border-zinc-200/80 text-zinc-800 hover:bg-zinc-50 shadow-sm active:scale-95 transition-all"
                            title="Load Sample Morbi Depo Gujarati Card"
                        >
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>Sample</span>
                        </button>
                    )}

                    {/* Dark capsule Active badge matching Screenshot 3 */}
                    <div className="px-3 py-1 rounded-xl bg-[#0D1913] border border-emerald-900/60 text-[#00E575] text-[11px] font-bold tracking-tight shadow-sm select-none">
                        Active
                    </div>
                </div>
            </div>
        </header>
    );
}
