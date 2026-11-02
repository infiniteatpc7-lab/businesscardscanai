import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function JsonViewer({ data, onCopy }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!data) return;
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopied(true);
        if (onCopy) onCopy();
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative">
            <div className="absolute top-3 right-3 z-10">
                <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
            </div>
            <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono overflow-x-auto max-h-[420px] leading-relaxed border border-zinc-800">
                {JSON.stringify(data, null, 2)}
            </pre>
        </div>
    );
}

