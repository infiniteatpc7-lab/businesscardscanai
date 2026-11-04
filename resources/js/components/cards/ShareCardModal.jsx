import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    MessageCircle,
    Mail,
    Copy,
    Check,
    Download,
    Share2,
    ExternalLink
} from 'lucide-react';
import {
    formatCardShareText,
    getWhatsAppShareUrl,
    getEmailShareUrl,
    copyToClipboard,
    downloadVCard
} from '../../services/vcfHelper';

export default function ShareCardModal({ card, onClose, showToast }) {
    const [copied, setCopied] = useState(false);

    if (!card || typeof document === 'undefined') return null;

    const name = card.name || card.name_english || card.company || 'Business Contact';
    const company = card.company || card.company_english || '';
    const shareText = formatCardShareText(card);
    const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && window.isSecureContext;

    const handleCopy = async () => {
        try {
            await copyToClipboard(shareText);
            setCopied(true);
            showToast?.('Contact copied to clipboard!', 'success');
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            console.error('Copy failed:', err);
            showToast?.('Failed to copy to clipboard', 'error');
        }
    };

    const handleWhatsApp = () => {
        const url = getWhatsAppShareUrl(shareText);
        window.open(url, '_blank');
        showToast?.('Opening WhatsApp...');
        onClose?.();
    };

    const handleEmail = () => {
        const subject = `${name}${company ? ` - ${company}` : ''} Contact Details`;
        const url = getEmailShareUrl(subject, shareText);
        window.location.href = url;
        showToast?.('Opening Email...');
        onClose?.();
    };

    const handleNativeShare = async () => {
        if (!navigator.share) return;
        try {
            await navigator.share({
                title: `${name}${company ? ` - ${company}` : ''}`,
                text: shareText,
            });
            showToast?.('Card shared successfully');
            onClose?.();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Share error:', err);
                handleCopy();
            }
        }
    };

    const handleDownload = () => {
        downloadVCard(card);
        showToast?.('vCard downloaded for phonebook');
    };

    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            />

            {/* Modal Container */}
            <div className="relative bg-white rounded-t-[32px] sm:rounded-3xl p-5 pb-7 w-full max-w-sm shadow-2xl space-y-4 z-10 max-h-[90vh] overflow-y-auto animate-tab-fade">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share Contact Card</span>
                        </div>
                        <h3 className="text-base font-extrabold text-zinc-950 truncate mt-0.5 font-gujarati">
                            {name}
                        </h3>
                        {company && (
                            <p className="text-xs text-zinc-500 truncate">{company}</p>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Primary Sharing Channels Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                    {/* WhatsApp */}
                    <button
                        onClick={handleWhatsApp}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 text-emerald-800 transition-all active:scale-95 text-left"
                    >
                        <div className="w-10 h-10 rounded-xl bg-[#0F9D58] text-white flex items-center justify-center shrink-0 shadow-sm">
                            <MessageCircle className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold leading-tight">WhatsApp</p>
                            <p className="text-[10px] text-emerald-600 truncate mt-0.5">Send message</p>
                        </div>
                    </button>

                    {/* Email */}
                    <button
                        onClick={handleEmail}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200/60 text-blue-800 transition-all active:scale-95 text-left"
                    >
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold leading-tight">Email</p>
                            <p className="text-[10px] text-blue-600 truncate mt-0.5">Send via mail</p>
                        </div>
                    </button>

                    {/* Copy to Clipboard */}
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/80 text-zinc-900 transition-all active:scale-95 text-left"
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors ${
                            copied ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-white'
                        }`}>
                            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold leading-tight">{copied ? 'Copied!' : 'Copy Text'}</p>
                            <p className="text-[10px] text-zinc-500 truncate mt-0.5">To clipboard</p>
                        </div>
                    </button>

                    {/* Download vCard */}
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200/60 text-amber-900 transition-all active:scale-95 text-left"
                    >
                        <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Download className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold leading-tight">Save vCard</p>
                            <p className="text-[10px] text-amber-700 truncate mt-0.5">.vcf Contact</p>
                        </div>
                    </button>
                </div>

                {/* More Apps Button (if Native Web Share is available) */}
                {hasNativeShare && (
                    <button
                        onClick={handleNativeShare}
                        className="w-full py-2.5 px-3 rounded-2xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Share2 className="w-4 h-4" />
                        <span>More Apps & System Share Sheet</span>
                    </button>
                )}

                {/* Card Text Preview */}
                <div className="pt-2">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Preview Shared Content
                    </p>
                    <div className="bg-zinc-50 border border-zinc-200/70 rounded-2xl p-3 text-[11px] text-zinc-700 font-mono whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto select-all">
                        {shareText}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
