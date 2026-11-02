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
                        className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-2xl transition-all active:scale-95 ${
                            activeTab === 'home'
                                ? 'text-zinc-950 font-bold'
                                : 'text-zinc-400 hover:text-zinc-700 font-medium'
                        }`}
                    >
                        <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                        <span className="text-[10px] mt-1 tracking-tight">Home</span>
                    </button>

                    {/* Tab 2: Cards */}
                    <button
                        onClick={() => onTabChange('cards')}
                        className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-2xl transition-all active:scale-95 relative ${
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

                    {/* Tab 3: Scan (Uniform style, no harsh black button or focus type) */}
                    <button
                        onClick={() => onTabChange('scan')}
                        className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-2xl transition-all active:scale-95 ${
                            activeTab === 'scan'
                                ? 'text-zinc-950 font-bold'
                                : 'text-zinc-400 hover:text-zinc-700 font-medium'
                        }`}
                    >
                        <ScanLine className={`w-5 h-5 ${activeTab === 'scan' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                        <span className="text-[10px] mt-1 tracking-tight">Scan</span>
                    </button>

                    {/* Tab 4: Profile */}
                    <button
                        onClick={() => onTabChange('profile')}
                        className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-2xl transition-all active:scale-95 ${
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
