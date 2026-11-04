import React from 'react';
import { MoonStar, Sun } from 'lucide-react';
import { IconButton } from './ui/button';

export default function ModeToggle({ isDark, onToggle }) {
    return (
        <IconButton
            variant="outline"
            onClick={onToggle}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {isDark ? (
                <Sun className="w-4 h-4 text-amber-500 transition-transform" />
            ) : (
                <MoonStar className="w-4 h-4 text-slate-700 dark:text-zinc-300 transition-transform" />
            )}
            <span className="sr-only">Toggle theme</span>
        </IconButton>
    );
}

