import React from 'react';
import { MoonStar, Sun } from 'lucide-react';

export default function ModeToggle({ isDark, onToggle }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="size-9 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer relative"
        >
            {isDark ? (
                <Sun className="w-4 h-4 text-amber-500 transition-transform" />
            ) : (
                <MoonStar className="w-4 h-4 text-slate-700 transition-transform" />
            )}
            <span className="sr-only">Toggle theme</span>
        </button>
    );
}

