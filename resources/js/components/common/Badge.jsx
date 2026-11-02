import React from 'react';

export function AccuracyBadge({ score }) {
    const val = Number(score) || 90;
    let bg = 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    let dot = 'bg-emerald-500';
    let label = 'High Accuracy';

    if (val < 75) {
        bg = 'bg-rose-500/10 text-rose-700 border-rose-500/20';
        dot = 'bg-rose-500';
        label = 'Needs Review';
    } else if (val < 90) {
        bg = 'bg-amber-500/10 text-amber-700 border-amber-500/20';
        dot = 'bg-amber-500';
        label = 'Medium Accuracy';
    }

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${bg}`}>
            <span className={`w-2 h-2 rounded-full ${dot} animate-pulse`}></span>
            <span>{val}% ACCURACY</span>
        </div>
    );
}

export function StatusBadge({ status }) {
    const statusMap = {
        hot: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Hot Lead' },
        warm: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Warm' },
        cold: { bg: 'bg-zinc-100 text-zinc-600 border-zinc-200', label: 'Cold' },
        contacted: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Contacted' },
        verified: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Verified' },
    };

    const s = statusMap[status?.toLowerCase()] || statusMap.warm;

    return (
        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${s.bg}`}>
            {s.label}
        </span>
    );
}
