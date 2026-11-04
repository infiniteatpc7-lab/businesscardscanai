import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    MessageCircle,
    Mail,
    Copy,
    Check,
    UserPlus,
    Share2,
    Building2
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
    const designation = card.designation || '';
    const shareText = formatCardShareText(card);
    const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && window.isSecureContext;

    // Generate clean initials for avatar
    const initials = (name || 'BC')
        .split(' ')
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const handleCopy = async () => {
        try {
            await copyToClipboard(shareText);
            setCopied(true);
            showToast?.('Contact copied to clipboard', 'success');
            setTimeout(() => {
                setCopied(false);
                onClose?.();
            }, 1200);
        } catch (err) {
            console.error('Copy failed:', err);
            showToast?.('Failed to copy to clipboard', 'error');
        }
    };

    const handleWhatsApp = () => {
        const url = getWhatsAppShareUrl(shareText);
        window.open(url, '_blank');
        onClose?.();
    };

    const handleEmail = () => {
        const subject = `${name}${company ? ` - ${company}` : ''} Contact Details`;
        const url = getEmailShareUrl(subject, shareText);
        window.location.href = url;
        onClose?.();
    };

    const handleNativeShare = async () => {
        if (!navigator.share) return;
        try {
            await navigator.share({
                title: `${name}${company ? ` - ${company}` : ''}`,
                text: shareText,
            });
            onClose?.();
        } catch (err) {
            if (err.name !== 'AbortError') {
                handleCopy();
            }
        }
    };

    const handleDownload = () => {
        downloadVCard(card);
        showToast?.('vCard downloaded for phone contacts');
        onClose?.();
    };

    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Dark Backdrop */}
            <div
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            />

            {/* Native-Style Bottom Sheet */}
            <div className="relative bg-white rounded-t-[32px] sm:rounded-3xl p-5 pb-6 w-full max-w-sm shadow-2xl space-y-5 z-10 animate-tab-fade">
                {/* Mobile Drag Indicator */}
                <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto sm:hidden -mt-1 mb-2" />

                {/* Contact Preview Pill */}
                <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-black text-white font-bold text-xs flex items-center justify-center shrink-0 tracking-wider">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-sm font-extrabold text-zinc-950 truncate font-gujarati leading-tight">
                                {name}
                            </h4>
                            <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                                {designation ? `${designation}${company ? ` · ${company}` : ''}` : (company || 'Business Contact')}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-full bg-zinc-200/70 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors shrink-0"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Circular Share Channel Row */}
                <div>
                    <p className="text-[11px] font-semibold text-zinc-400 mb-3 px-1 text-center">
                        Share contact via
                    </p>

                    <div className="grid grid-cols-4 gap-2">
                        {/* WhatsApp */}
                        <button
                            onClick={handleWhatsApp}
                            className="flex flex-col items-center group active:scale-95 transition-transform"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-[#25D366]/10 text-[#25D366] group-hover:bg-[#25D366]/20 border border-[#25D366]/20 flex items-center justify-center transition-colors">
                                <MessageCircle className="w-6 h-6 fill-[#25D366]/10" />
                            </div>
                            <span className="text-[11px] font-semibold text-zinc-700 mt-1.5 truncate max-w-full">
                                WhatsApp
                            </span>
                        </button>

                        {/* Email */}
                        <button
                            onClick={handleEmail}
                            className="flex flex-col items-center group active:scale-95 transition-transform"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 border border-blue-200/60 flex items-center justify-center transition-colors">
                                <Mail className="w-6 h-6" />
                            </div>
                            <span className="text-[11px] font-semibold text-zinc-700 mt-1.5 truncate max-w-full">
                                Email
                            </span>
                        </button>

                        {/* Copy Details */}
                        <button
                            onClick={handleCopy}
                            className="flex flex-col items-center group active:scale-95 transition-transform"
                        >
                            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all ${
                                copied
                                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                                    : 'bg-zinc-100 text-zinc-800 group-hover:bg-zinc-200 border-zinc-200/80'
                            }`}>
                                {copied ? <Check className="w-6 h-6" /> : <Copy className="w-5 h-5" />}
                            </div>
                            <span className={`text-[11px] font-semibold mt-1.5 truncate max-w-full ${
                                copied ? 'text-emerald-600' : 'text-zinc-700'
                            }`}>
                                {copied ? 'Copied!' : 'Copy'}
                            </span>
                        </button>

                        {/* Save vCard */}
                        <button
                            onClick={handleDownload}
                            className="flex flex-col items-center group active:scale-95 transition-transform"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-800 group-hover:bg-zinc-200 border border-zinc-200/80 flex items-center justify-center transition-colors">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <span className="text-[11px] font-semibold text-zinc-700 mt-1.5 truncate max-w-full">
                                vCard
                            </span>
                        </button>
                    </div>
                </div>

                {/* Native Share Sheet Trigger (if supported) */}
                {hasNativeShare && (
                    <button
                        onClick={handleNativeShare}
                        className="w-full py-2.5 px-3 rounded-2xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/70 text-zinc-700 text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Share2 className="w-3.5 h-3.5 text-zinc-500" />
                        <span>More sharing options</span>
                    </button>
                )}

                {/* Cancel Button */}
                <button
                    onClick={onClose}
                    className="w-full py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-all active:scale-95"
                >
                    Cancel
                </button>
            </div>
        </div>,
        document.body
    );
}
