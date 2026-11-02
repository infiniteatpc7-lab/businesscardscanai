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
    const tabs = [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'cards', label: 'Cards', icon: CreditCard, count: cardsCount },
        { id: 'scan', label: 'Scan', icon: ScanLine },
        { id: 'profile', label: 'Profile', icon: User },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center pb-safe">
            <nav className="w-full max-w-md mx-auto px-4 pb-3 pt-1 pointer-events-auto">
                <div className="bg-white/95 backdrop-blur-xl border border-black/[0.08] rounded-3xl p-1.5 shadow-2xl flex items-center justify-between gap-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 active:scale-95 relative ${
                                    isActive
                                        ? 'text-zinc-950 font-bold bg-zinc-100/90'
                                        : 'text-zinc-400 hover:text-zinc-700 font-medium'
                                }`}
                            >
                                <div className="relative">
                                    <Icon
                                        className={`w-5 h-5 transition-transform duration-200 ${
                                            isActive ? 'stroke-[2.5] scale-105' : 'stroke-[1.8]'
                                        }`}
                                    />
                                    {tab.count > 0 && (
                                        <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-zinc-900 text-white text-[9px] font-mono font-bold flex items-center justify-center leading-none shadow-sm">
                                            {tab.count > 99 ? '99+' : tab.count}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] mt-1 tracking-tight leading-none">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
