import React from 'react';
import {
    Home,
    CreditCard,
    ScanLine,
    User
} from 'lucide-react';

export default function MobileBottomNav({
    activeTab,
    onTabChange,
    cardsCount = 0
}) {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center pb-safe">
            <nav className="w-full max-w-md mx-auto px-4 pb-3 pt-1 pointer-events-auto">
                <div className="bg-white/95 backdrop-blur-xl border border-black/[0.08] rounded-3xl p-1.5 shadow-2xl flex items-center justify-between">
                    {/* Tab 1: Home */}
                    <button
                        onClick={() => onTabChange('home')}
                        className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all active:scale-95 ${
                            activeTab === 'home'
                                ? 'text-zinc-950 font-bold'
                                : 'text-zinc-400 hover:text-zinc-700 font-medium'
                        }`}
                    >
                        <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                        <span className="text-[10px] mt-1 tracking-tight">Home</span>
                    </button>

                    {/* Tab 2: All Cards */}
                    <button
                        onClick={() => onTabChange('cards')}
                        className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all active:scale-95 relative ${
                            activeTab === 'cards'
                                ? 'text-zinc-950 font-bold'
                                : 'text-zinc-400 hover:text-zinc-700 font-medium'
                        }`}
                    >
                        <CreditCard className={`w-5 h-5 ${activeTab === 'cards' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                        <span className="text-[10px] mt-1 tracking-tight">Cards</span>
                        {cardsCount > 0 && (
                            <span className="absolute top-1.5 right-4 w-4 h-4 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 text-[9px] font-mono font-bold flex items-center justify-center">
                                {cardsCount > 99 ? '99+' : cardsCount}
                            </span>
                        )}
                    </button>

                    {/* Center: Prominent Elevated Scan Button */}
                    <div className="px-2">
                        <button
                            onClick={() => onTabChange('scan')}
                            className="w-14 h-14 rounded-2xl bg-zinc-950 hover:bg-black text-white flex flex-col items-center justify-center shadow-pill active:scale-90 transition-all border border-zinc-800 relative group -mt-4 ring-4 ring-[#F4F4F6]"
                            title="Scan Business Card"
                        >
                            <ScanLine className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold text-zinc-300 mt-0.5">SCAN</span>
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse"></span>
                        </button>
                    </div>

                    {/* Tab 4: Profile / Settings */}
                    <button
                        onClick={() => onTabChange('profile')}
                        className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all active:scale-95 ${
                            activeTab === 'profile'
                                ? 'text-zinc-950 font-bold'
                                : 'text-zinc-400 hover:text-zinc-700 font-medium'
                        }`}
                    >
                        <User className={`w-5 h-5 ${activeTab === 'profile' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                        <span className="text-[10px] mt-1 tracking-tight">Profile</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}
