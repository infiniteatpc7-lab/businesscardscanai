import React from 'react';
import {
    Menu,
    ScanLine,
    Calendar,
    Sparkles,
    Bell,
    User,
    Languages
} from 'lucide-react';
import { NAVIGATION_ITEMS } from './Sidebar';

export default function Header({
    activePage,
    onOpenMobileMenu,
    onNavigate
}) {
    const currentItem = NAVIGATION_ITEMS.find((item) => item.id === activePage) || NAVIGATION_ITEMS[0];

    return (
        <header className="sticky top-0 z-30 bg-[#F4F4F6]/85 backdrop-blur-xl border-b border-black/[0.05] px-4 sm:px-8 py-3.5 transition-all">
            <div className="flex items-center justify-between">
                {/* Left: Mobile Toggle & Page Title */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onOpenMobileMenu}
                        className="lg:hidden w-9 h-9 rounded-2xl bg-white border border-zinc-200/80 flex items-center justify-center text-zinc-700 shadow-sm active:scale-95"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="font-extrabold text-lg tracking-tight text-zinc-950">
                                {currentItem.label}
                            </h2>
                            {currentItem.badge && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-800">
                                    {currentItem.badge}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-zinc-500 font-normal hidden sm:block">
                            Business Card Scanner & Exhibition Lead Hub
                        </p>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2.5">
                    {/* Language Badge */}
                    <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-zinc-200/70 text-[11px] font-semibold text-zinc-700 shadow-sm">
                        <Languages className="w-3.5 h-3.5 text-zinc-900" />
                        <span>Gujarati · Hindi · English</span>
                    </div>

                    {/* Exhibition status */}
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-zinc-200/70 text-xs font-semibold text-zinc-700 shadow-sm">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="truncate max-w-[140px]">Ceramix Expo</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    </div>

                    {/* Quick Scan CTA (if not on scanner page) */}
                    {activePage !== 'scanner' && (
                        <button
                            onClick={() => onNavigate('scanner')}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-black text-white hover:bg-zinc-800 transition-all shadow-pill active:scale-95"
                        >
                            <ScanLine className="w-3.5 h-3.5" />
                            <span>Scan Card</span>
                        </button>
                    )}

                    {/* Notifications */}
                    <button className="w-9 h-9 rounded-full bg-white border border-zinc-200/80 flex items-center justify-center text-zinc-700 hover:text-black transition-colors relative shadow-sm">
                        <Bell className="w-4 h-4" />
                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500"></span>
                    </button>

                    {/* User profile capsule */}
                    <div className="flex items-center gap-2 pl-1">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-zinc-900 to-zinc-700 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                            SK
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}

