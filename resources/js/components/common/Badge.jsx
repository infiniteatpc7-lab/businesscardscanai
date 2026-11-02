import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export function AccuracyBadge({ score }) {
    return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified</span>
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

    const s = statusMap[status?.toLowerCase()] || statusMap.verified;

    return (
        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${s.bg}`}>
            {s.label}
        </span>
    );
}
