import React from 'react';
import {
    User,
    Sparkles,
    CreditCard,
    Settings,
    FileSpreadsheet,
    Languages,
    ShieldCheck,
    Database,
    CheckCircle2
} from 'lucide-react';

export default function MobileProfilePage({
    cardsCount = 0,
    onExportCSV
}) {
    return (
        <div className="space-y-4 pb-24">
            {/* Profile Bento Tile */}
            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-white flex items-center justify-center text-lg font-extrabold shadow-sm">
                        SK
                    </div>
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-base text-zinc-950">Saunak K.</h3>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Booth Lead
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 font-medium">Ceramix India Expo 2026</p>
                        <p className="text-[10px] text-zinc-400 font-mono">Booth #B-104 · Hall 2</p>
                    </div>
                </div>
            </div>

            {/* Plan & Usage Bento Tile */}
            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-3.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-zinc-800" />
                        <h4 className="text-xs font-bold text-zinc-950">Scan Quota & Usage</h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                        Pro Tier
                    </span>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                        <span className="text-zinc-600">Total Cards Stored</span>
                        <span className="font-mono text-zinc-950">{cardsCount} / 1,000</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-black rounded-full"
                            style={{ width: `${Math.min(100, Math.max(5, (cardsCount / 1000) * 100))}%` }}
                        ></div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
                        <span>Directory Storage: Active</span>
                        <span className="text-emerald-600 font-semibold">Ready for Booth Scans</span>
                    </div>
                </div>
            </div>

            {/* Business Preferences Bento Tile */}
            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <Languages className="w-4 h-4 text-zinc-800" />
                    <h4 className="text-xs font-bold text-zinc-950">Scanner Settings</h4>
                </div>

                <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                        <div>
                            <span className="font-bold text-zinc-900 block">Language Support</span>
                            <span className="text-[10px] text-zinc-500">Gujarati, Hindi & English</span>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                        <div>
                            <span className="font-bold text-zinc-900 block">Mobile Optimization</span>
                            <span className="text-[10px] text-zinc-500">Fast Upload & Image Processing</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                        <div>
                            <span className="font-bold text-zinc-900 block">Processing Engine</span>
                            <span className="text-[10px] text-zinc-500">CardScan Neural Processor</span>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-zinc-700">v2.0</span>
                    </div>
                </div>
            </div>

            {/* Data Management Bento Tile */}
            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-3">
                <h4 className="text-xs font-bold text-zinc-950">Data & Export</h4>

                <div className="space-y-2">
                    <button
                        onClick={onExportCSV}
                        className="w-full py-3 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-zinc-700" />
                        <span>Export All Contacts as CSV</span>
                    </button>
                </div>
            </div>

            {/* App Footer */}
            <div className="text-center pt-2 space-y-1">
                <p className="text-[11px] font-bold text-zinc-400">CardScan AI · SaaS v2.0</p>
                <p className="text-[10px] text-zinc-400">Built for high-velocity trade fair booth lead management</p>
            </div>
        </div>
    );
}

