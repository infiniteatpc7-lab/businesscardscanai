import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({
    activePage,
    onSelectPage,
    children
}) {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[#F4F4F6] text-[#111115] relative overflow-x-hidden selection:bg-black selection:text-white">
            {/* Subtle background dot grid pattern */}
            <div className="absolute inset-0 bg-subtle-grid pointer-events-none opacity-60"></div>

            {/* Sidebar */}
            <Sidebar
                activePage={activePage}
                onSelectPage={onSelectPage}
                mobileOpen={mobileOpen}
                onCloseMobile={() => setMobileOpen(false)}
            />

            {/* Main Area */}
            <div className="lg:pl-72 flex flex-col min-h-screen relative z-10">
                <Header
                    activePage={activePage}
                    onOpenMobileMenu={() => setMobileOpen(true)}
                    onNavigate={onSelectPage}
                />

                <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
