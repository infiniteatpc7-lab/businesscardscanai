import React from 'react';
import { ScanLine } from 'lucide-react';

export default function MobileHeader() {
    return (
        <header className="sticky top-0 z-40 bg-[#F4F4F6]/90 backdrop-blur-xl border-b border-black/[0.05] px-4 py-2.5">
            <div className="max-w-md mx-auto flex items-center justify-between">
                {/* Brand */}
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center text-white shadow-sm">
                        <ScanLine className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h1 className="font-extrabold text-sm tracking-tight text-zinc-950 leading-tight">
                            CardScan AI
                        </h1>
                        <p className="text-[10px] text-zinc-500 font-medium leading-tight">
                            Exhibition Scanner
                        </p>
                    </div>
                </div>
            </div>
        </header>
    );
}
