import React from 'react';
import { createPortal } from 'react-dom';
import {
    AlertTriangle,
    X,
    Building2,
    Phone,
    User,
    ExternalLink,
    CopyCheck
} from 'lucide-react';

export default function DuplicateWarningModal({
    isOpen,
    duplicateData,
    onClose,
    onForceSave,
    onViewExisting,
    isSaving = false
}) {
    if (!isOpen || !duplicateData || typeof document === 'undefined') return null;

    const { existingCards = [], matchReason = 'phone', message } = duplicateData;

    const getReasonBadge = (reason) => {
        switch (reason) {
            case 'phone':
                return { label: 'Phone Number Match', desc: 'A contact with this phone number is already registered in your directory.' };
            case 'email':
                return { label: 'Email Match', desc: 'A contact with this email address is already saved in your directory.' };
            case 'name_company':
                return { label: 'Name & Company Match', desc: 'A card with this contact person and company already exists in your directory.' };
            default:
                return { label: 'Contact Match', desc: 'A matching card already exists in your directory.' };
        }
    };

    const reasonInfo = getReasonBadge(matchReason);

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Dark Backdrop */}
            <div
                onClick={() => !isSaving && onClose()}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            />

            {/* Modal Container */}
            <div className="relative bg-white rounded-t-[32px] sm:rounded-3xl p-6 pb-8 w-full max-w-md shadow-2xl space-y-4 z-10 max-h-[90vh] overflow-y-auto animate-tab-fade">
                {/* Mobile Grabber */}
                <div
                    onClick={() => !isSaving && onClose()}
                    className="w-10 h-1 bg-zinc-300 rounded-full mx-auto sm:hidden mb-2 -mt-1 cursor-pointer"
                />

                {/* Header with Alert Pill */}
                <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-sm text-zinc-950">
                                Duplicate Contact Detected
                            </h3>
                            <p className="text-[11px] text-zinc-500 font-medium">
                                {reasonInfo.label}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 shrink-0 transition-colors active:scale-95 disabled:opacity-40"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Context Description */}
                <p className="text-xs text-zinc-700 leading-relaxed bg-amber-50/70 border border-amber-200/70 p-3 rounded-2xl">
                    {message || reasonInfo.desc}
                </p>

                {/* Existing Card(s) Preview */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                        <span>Already Saved in Directory</span>
                        {existingCards.length > 1 && (
                            <span>{existingCards.length} matching cards</span>
                        )}
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {existingCards.map((card) => {
                            const phones = Array.isArray(card.phone) ? card.phone : (card.phone ? [card.phone] : []);
                            return (
                                <div
                                    key={card.id}
                                    className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h4 className="font-gujarati font-extrabold text-xs text-zinc-950 truncate">
                                                {card.company || card.name || 'Saved Contact'}
                                            </h4>
                                            {card.name && card.company && (
                                                <div className="flex items-center gap-1 text-[11px] text-zinc-600 truncate">
                                                    <User className="w-3 h-3 text-zinc-400 shrink-0" />
                                                    <span className="truncate font-gujarati">{card.name}</span>
                                                </div>
                                            )}
                                        </div>

                                        {onViewExisting && (
                                            <button
                                                onClick={() => onViewExisting(card)}
                                                className="px-2.5 py-1 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-800 text-[10px] font-bold flex items-center gap-1 shrink-0 shadow-sm active:scale-95 transition-all"
                                            >
                                                <span>View Card</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>

                                    {phones.length > 0 && (
                                        <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-700 font-semibold">
                                            <Phone className="w-2.5 h-2.5 text-zinc-400" />
                                            <span className="truncate">{phones.join(', ')}</span>
                                        </div>
                                    )}

                                    {card.email && (
                                        <p className="text-[10px] font-mono text-zinc-500 truncate">
                                            {card.email}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 space-y-2">
                    {/* Primary Override Button */}
                    <button
                        onClick={onForceSave}
                        disabled={isSaving}
                        className="w-full py-3 px-4 rounded-2xl bg-black hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <CopyCheck className="w-4 h-4 text-emerald-400" />
                        )}
                        <span>{isSaving ? 'Saving New Card...' : 'Save as New Card Anyway'}</span>
                    </button>

                    {/* Secondary Cancel / Dismiss Button */}
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="w-full py-2.5 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-all active:scale-95"
                    >
                        Keep Existing & Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

