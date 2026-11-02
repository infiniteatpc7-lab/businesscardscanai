import React, { useState, useRef, useEffect } from 'react';
import {
    Trash2,
    MessageCircle,
    Phone,
    MapPin,
    User,
    UserPlus
} from 'lucide-react';
import { downloadVCard, openWhatsApp } from '../../services/vcfHelper';

export default function SwipeableCardItem({
    card,
    onSelectCard,
    onDeleteCard,
    onUndoDelete,
    showToast
}) {
    const [offsetX, setOffsetX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const isHorizontalRef = useRef(null);
    const itemRef = useRef(null);

    const primaryPhone = Array.isArray(card.phone) && card.phone.length > 0 ? card.phone[0] : null;

    // Thresholds
    const ACTION_THRESHOLD = 90; // Reveals action
    const FULL_SWIPE_THRESHOLD = 160; // Triggers automatic swipe action

    const handleTouchStart = (e) => {
        const touch = e.touches[0];
        startXRef.current = touch.clientX;
        startYRef.current = touch.clientY;
        isHorizontalRef.current = null;
        setIsSwiping(true);
    };

    const handleTouchMove = (e) => {
        if (!isSwiping) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - startXRef.current;
        const deltaY = touch.clientY - startYRef.current;

        // Determine if scroll is horizontal or vertical on first movement
        if (isHorizontalRef.current === null) {
            if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
                isHorizontalRef.current = Math.abs(deltaX) > Math.abs(deltaY);
            }
        }

        // If user is scrolling vertically, let browser scroll naturally
        if (isHorizontalRef.current === false) {
            return;
        }

        // Apply resistance as user pulls further
        const maxPull = 180;
        let clampedX = deltaX;
        if (deltaX > maxPull) {
            clampedX = maxPull + (deltaX - maxPull) * 0.2;
        } else if (deltaX < -maxPull) {
            clampedX = -maxPull + (deltaX + maxPull) * 0.2;
        }

        setOffsetX(clampedX);
    };

    const handleTouchEnd = () => {
        if (!isSwiping) return;
        setIsSwiping(false);

        // Haptic feedback if supported
        const triggerHaptic = () => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(15);
            }
        };

        // Swipe Left (Destructive: Delete)
        if (offsetX < -ACTION_THRESHOLD) {
            triggerHaptic();
            // Trigger delete with smooth collapse
            executeDelete();
        }
        // Swipe Right (Quick WhatsApp / Contact)
        else if (offsetX > ACTION_THRESHOLD) {
            triggerHaptic();
            executeRightAction();
            setOffsetX(0);
        } else {
            // Spring back
            setOffsetX(0);
        }

        isHorizontalRef.current = null;
    };

    // Execute Delete with smooth height collapse
    const executeDelete = () => {
        setIsDeleting(true);
        setTimeout(() => {
            onDeleteCard(card.id, card);
        }, 220);
    };

    // Execute Right Swipe Action (WhatsApp or Save to Phone)
    const executeRightAction = () => {
        if (primaryPhone) {
            openWhatsApp(primaryPhone, card);
            showToast?.(`Opening WhatsApp for ${card.name || card.company || 'Contact'}`);
        } else {
            downloadVCard(card);
            showToast?.('vCard downloaded for phone contacts');
        }
    };

    // Background icon scale calculations
    const leftSwipeProgress = Math.min(1, Math.max(0, -offsetX / ACTION_THRESHOLD));
    const rightSwipeProgress = Math.min(1, Math.max(0, offsetX / ACTION_THRESHOLD));

    return (
        <div
            ref={itemRef}
            className={`relative overflow-hidden rounded-3xl transition-all duration-200 ${
                isDeleting ? 'max-h-0 opacity-0 mb-0 scale-95 py-0' : 'max-h-[300px] mb-3'
            }`}
        >
            {/* Background Actions Layer (Gmail-like clean colored reveal surfaces) */}
            <div className="absolute inset-0 rounded-3xl flex items-center justify-between pointer-events-none overflow-hidden">
                {/* Right Swipe Revealed (Gmail Emerald Green: WhatsApp / Contact) */}
                <div
                    className={`h-full flex items-center gap-2 pl-6 transition-colors duration-150 ${
                        offsetX > 0 ? 'bg-[#0F9D58] text-white w-full' : 'bg-transparent text-transparent'
                    }`}
                >
                    <div
                        className="flex items-center gap-2 font-bold text-xs transition-transform duration-150"
                        style={{
                            transform: `scale(${0.7 + rightSwipeProgress * 0.4})`,
                            opacity: rightSwipeProgress,
                        }}
                    >
                        {primaryPhone ? (
                            <>
                                <MessageCircle className="w-5 h-5 fill-white stroke-[#0F9D58]" />
                                <span>WhatsApp</span>
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-5 h-5" />
                                <span>Save vCard</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Left Swipe Revealed (Gmail Rose Red: Delete) */}
                <div
                    className={`h-full flex items-center justify-end gap-2 pr-6 transition-colors duration-150 ${
                        offsetX < 0 ? 'bg-[#D93025] text-white w-full' : 'bg-transparent text-transparent'
                    }`}
                >
                    <div
                        className="flex items-center gap-2 font-bold text-xs transition-transform duration-150"
                        style={{
                            transform: `scale(${0.7 + leftSwipeProgress * 0.4})`,
                            opacity: leftSwipeProgress,
                        }}
                    >
                        <span>Delete</span>
                        <Trash2 className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Foreground Card Surface */}
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={() => {
                    // Only trigger select if user didn't swipe
                    if (Math.abs(offsetX) < 5) {
                        onSelectCard(card);
                    }
                }}
                className="bg-white rounded-3xl p-4 shadow-behance border border-black/[0.04] space-y-3 cursor-pointer relative z-10 select-none will-change-transform"
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                {/* Card Top: Company & Language */}
                <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                        <h3 className="font-gujarati font-extrabold text-sm text-zinc-950 truncate">
                            {card.company || card.name || 'Unnamed Business'}
                        </h3>
                        {card.company_english && card.company && (
                            <p className="text-[11px] font-medium text-zinc-500 truncate">
                                {card.company_english}
                            </p>
                        )}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">
                        {card.detected_language || 'Card'}
                    </span>
                </div>

                {/* Person / Designation */}
                {(card.name || card.designation) && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-700 font-semibold">
                        <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{card.name || 'Contact'}</span>
                        {card.designation && (
                            <span className="text-zinc-400 font-normal truncate">· {card.designation}</span>
                        )}
                    </div>
                )}

                {/* Address Snippet */}
                {card.address && (
                    <div className="flex items-start gap-1.5 text-[11px] text-zinc-600 line-clamp-1">
                        <MapPin className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
                        <span className="font-gujarati truncate">{card.address}</span>
                    </div>
                )}

                {/* Bottom Bar: Date & 1-Tap Quick Actions */}
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 font-mono">
                        {new Date(card.created_at || Date.now()).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Phone Call */}
                        {primaryPhone && (
                            <a
                                href={`tel:${primaryPhone}`}
                                className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center transition-all active:scale-95"
                                title="Call"
                            >
                                <Phone className="w-3.5 h-3.5" />
                            </a>
                        )}

                        {/* WhatsApp */}
                        {primaryPhone && (
                            <button
                                onClick={() => openWhatsApp(primaryPhone, card)}
                                className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition-all active:scale-95"
                                title="Chat on WhatsApp"
                            >
                                <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {/* Save to Phone (vCard) */}
                        <button
                            onClick={() => {
                                downloadVCard(card);
                                showToast?.('vCard downloaded for phone contacts');
                            }}
                            className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center transition-all active:scale-95"
                            title="Save to Phone Contacts"
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
