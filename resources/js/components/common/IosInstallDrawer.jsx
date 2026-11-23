import React from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, PlusSquare, Smartphone, MoreVertical, ScanLine } from 'lucide-react';

export default function IosInstallDrawer({ isOpen, onClose, isIOS = false }) {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Backdrop click to close */}
            <div className="fixed inset-0" onClick={onClose} />

            {/* Modal Body */}
            <div className="relative w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-black/[0.06] z-10 space-y-4 animate-in slide-in-from-bottom-5 duration-250">
                {/* Header */}
                <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-950 flex items-center justify-center text-white shadow-md">
                            <ScanLine className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold text-zinc-950 tracking-tight leading-tight">
                                Install CardScan AI
                            </h3>
                            <p className="text-[11px] text-zinc-500 font-medium">
                                Fast 1-tap booth card scanner
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Instructions */}
                <div className="bg-zinc-50 border border-zinc-200/70 rounded-2xl p-4 space-y-3 text-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        {isIOS ? 'iPhone / Safari Quick Setup' : 'Add to Home Screen'}
                    </p>

                    {isIOS ? (
                        <div className="space-y-3 text-zinc-700">
                            <div className="flex items-start gap-2.5">
                                <div className="w-6 h-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shrink-0 mt-0.5 text-blue-600 shadow-2xs font-bold text-xs">
                                    1
                                </div>
                                <div className="flex-1 leading-relaxed">
                                    Tap the <strong className="text-zinc-950">Share</strong> button{' '}
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium text-[11px] align-baseline">
                                        <Share2 className="w-3 h-3 inline mr-1" /> Share
                                    </span>{' '}
                                    in Safari's bottom toolbar.
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5">
                                <div className="w-6 h-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shrink-0 mt-0.5 text-emerald-600 shadow-2xs font-bold text-xs">
                                    2
                                </div>
                                <div className="flex-1 leading-relaxed">
                                    Scroll down and tap{' '}
                                    <strong className="text-zinc-950 inline-flex items-center gap-1">
                                        <PlusSquare className="w-3.5 h-3.5 text-zinc-700 inline" />
                                        Add to Home Screen
                                    </strong>
                                    .
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5">
                                <div className="w-6 h-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shrink-0 mt-0.5 text-orange-600 shadow-2xs font-bold text-xs">
                                    3
                                </div>
                                <div className="flex-1 leading-relaxed">
                                    Tap <strong className="text-zinc-950">Add</strong> in the top-right corner. It will open as an app on your phone!
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 text-zinc-700">
                            <div className="flex items-start gap-2.5">
                                <div className="w-6 h-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shrink-0 mt-0.5 text-blue-600 shadow-2xs font-bold text-xs">
                                    1
                                </div>
                                <div className="flex-1 leading-relaxed">
                                    Tap the browser menu{' '}
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium text-[11px] align-baseline">
                                        <MoreVertical className="w-3 h-3 inline mr-0.5" /> Menu
                                    </span>{' '}
                                    (top or bottom right).
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5">
                                <div className="w-6 h-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shrink-0 mt-0.5 text-emerald-600 shadow-2xs font-bold text-xs">
                                    2
                                </div>
                                <div className="flex-1 leading-relaxed">
                                    Select <strong className="text-zinc-950">Install app</strong> or <strong className="text-zinc-950">Add to Home screen</strong>.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Primary Got It button */}
                <button
                    onClick={onClose}
                    className="w-full py-3 rounded-2xl bg-zinc-950 hover:bg-black text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Got It</span>
                </button>
            </div>
        </div>,
        document.body
    );
}
