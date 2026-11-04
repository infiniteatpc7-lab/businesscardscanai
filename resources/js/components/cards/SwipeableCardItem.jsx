import React, { useState, useRef } from 'react';
import {
    Trash2,
    MessageCircle,
    Phone,
    MapPin,
    User,
    UserPlus,
    Share2
} from 'lucide-react';
import {
    downloadVCard,
    openWhatsApp,
    isLandlineNumber,
    initiatePhoneCall,
    formatCardShareText,
    copyToClipboard,
    getWhatsAppShareUrl
} from '../../services/vcfHelper';

export default function SwipeableCardItem({
    card,
    onSelectCard,
    onDeleteCard,
    onUndoDelete,
    showToast,
    isOwnerOrAdmin = false,
    onFilterByMember,
    onShareCard,
}) {
    const [offsetX, setOffsetX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const isHorizontalRef = useRef(null);
    const itemRef = useRef(null);
    const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
    const hasMovedRef = useRef(false);
    const lastTapTimeRef = useRef(0);

    const primaryPhone = Array.isArray(card.phone) && card.phone.length > 0
        ? card.phone[0]
        : (typeof card.phone === 'string' && card.phone.length > 0 ? card.phone : null);

    const isLandline = isLandlineNumber(primaryPhone);

    // Primary original scanner attribution (displays only the first person who scanned it)
    const primaryScanner = Array.isArray(card.scanners) && card.scanners.length > 0
        ? card.scanners[0]
        : (card.user ? { id: card.user.id, name: card.user.name } : null);

    const formattedDateTime = (() => {
        const d = new Date(card.created_at || Date.now());
        const datePart = d.toLocaleDateString();
        const timePart = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${datePart} · ${timePart}`;
    })();

    const handleShareCard = async (e) => {
        e.stopPropagation();
        if (onShareCard) {
            onShareCard(card);
            return;
        }

        const shareText = formatCardShareText(card);

        if (typeof navigator !== 'undefined' && navigator.share && window.isSecureContext) {
            try {
                await navigator.share({
                    title: card.name || card.company || 'Business Contact',
                    text: shareText,
                });
                showToast?.('Card shared successfully');
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
            }
        }

        try {
            await copyToClipboard(shareText);
            showToast?.('Contact copied to clipboard');
        } catch (err) {
            window.open(getWhatsAppShareUrl(shareText), '_blank');
        }
    };

    // Thresholds
    const ACTION_THRESHOLD = 90; // Reveals action

    const handleTouchStart = (e) => {
        const touch = e.touches[0];
        startXRef.current = touch.clientX;
        startYRef.current = touch.clientY;
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        hasMovedRef.current = false;
        isHorizontalRef.current = null;
        setIsSwiping(true);
    };

    const handleTouchMove = (e) => {
        if (!isSwiping) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - startXRef.current;
        const deltaY = touch.clientY - startYRef.current;

        if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
            hasMovedRef.current = true;
        }

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

        // Direct mobile tap detection (fast release with minimal movement)
        if (!hasMovedRef.current && (Date.now() - touchStartRef.current.time < 350)) {
            lastTapTimeRef.current = Date.now();
            onSelectCard(card);
            setOffsetX(0);
            isHorizontalRef.current = null;
            return;
        }

        // Haptic feedback if supported
        const triggerHaptic = () => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(15);
            }
        };

        // Swipe Left (Destructive: Delete)
        if (offsetX < -ACTION_THRESHOLD) {
            triggerHaptic();
            executeDelete();
        }
        // Swipe Right (Smart: WhatsApp for Mobile, Call for Landline, vCard for other)
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

    // Execute Right Swipe Action (WhatsApp or Phone Call or Save to Phone)
    const executeRightAction = () => {
        if (!primaryPhone) {
            downloadVCard(card);
            showToast?.('vCard downloaded for phone contacts');
            return;
        }

        if (isLandline) {
            initiatePhoneCall(primaryPhone);
            showToast?.(`Calling ${card.name || card.company || 'Contact'}...`);
        } else {
            openWhatsApp(primaryPhone, card);
            showToast?.(`Opening WhatsApp for ${card.name || card.company || 'Contact'}`);
        }
    };

    // Background icon scale calculations
    const leftSwipeProgress = Math.min(1, Math.max(0, -offsetX / ACTION_THRESHOLD));
    const rightSwipeProgress = Math.min(1, Math.max(0, offsetX / ACTION_THRESHOLD));

    // Right action surface styling
    const rightActionBg = isLandline ? 'bg-[#1A73E8]' : 'bg-[#0F9D58]';

    return (
        <div
            ref={itemRef}
            className={`relative overflow-hidden rounded-3xl transition-all duration-200 ${
                isDeleting ? 'max-h-0 opacity-0 mb-0 scale-95 py-0' : 'max-h-[300px] mb-3'
            }`}
        >
            {/* Background Actions Layer (Gmail-like clean colored reveal surfaces) */}
            <div className="absolute inset-0 rounded-3xl flex items-center justify-between pointer-events-none overflow-hidden">
                {/* Right Swipe Revealed (Emerald Green for WhatsApp OR Blue for Landline Call) */}
                <div
                    className={`h-full flex items-center gap-2 pl-6 transition-colors duration-150 ${
                        offsetX > 0 ? `${rightActionBg} text-white w-full` : 'bg-transparent text-transparent'
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
                            isLandline ? (
                                <>
                                    <Phone className="w-5 h-5 fill-white stroke-[#1A73E8]" />
                                    <span>Call Office</span>
                                </>
                            ) : (
                                <>
                                    <MessageCircle className="w-5 h-5 fill-white stroke-[#0F9D58]" />
                                    <span>WhatsApp</span>
                                </>
                            )
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
                    // Prevent duplicate if already handled by touchEnd within last 450ms
                    if (Date.now() - lastTapTimeRef.current < 450) return;
                    if (Math.abs(offsetX) < 15) {
                        onSelectCard(card);
                    }
                }}
                className="bg-white rounded-3xl p-4 shadow-behance border border-black/[0.04] space-y-3 cursor-pointer relative z-10 select-none will-change-transform"
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                {/* Card Top: Company & Language / Scanner Attribution */}
                <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                        <h3 className="font-gujarati font-extrabold text-sm text-zinc-950 truncate">
                            {card.company || card.company_english || card.name || 'Unnamed Business'}
                        </h3>
                        {card.company_english && card.company !== card.company_english && (
                            <p className="text-[11px] text-zinc-600 truncate">{card.company_english}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {isOwnerOrAdmin && primaryScanner && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFilterByMember?.(primaryScanner.id);
                                }}
                                className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60 font-semibold transition-all active:scale-95"
                                title={`Original scanner: ${primaryScanner.name}. Tap to filter.`}
                            >
                                {primaryScanner.name}
                            </button>
                        )}
                        {card.detected_language && (
                            <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-semibold shrink-0">
                                {card.detected_language}
                            </span>
                        )}
                    </div>
                </div>

                {/* Contact Person & Role */}
                {(card.name || card.designation) && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-700">
                        <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="font-bold text-zinc-900 truncate font-gujarati">{card.name || 'Contact'}</span>
                        {card.designation && (
                            <>
                                <span className="text-zinc-300">·</span>
                                <span className="text-zinc-500 truncate text-[11px]">{card.designation}</span>
                            </>
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

                {/* Bottom Bar: Date/Time & 1-Tap Quick Actions */}
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-zinc-400 font-mono tracking-tight shrink-0">
                        {formattedDateTime}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Phone Call (Highlighted if landline) */}
                        {primaryPhone && (
                            <a
                                href={`tel:${primaryPhone}`}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                                    isLandline
                                        ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60'
                                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                                }`}
                                title={isLandline ? 'Call Landline/Office' : 'Call'}
                            >
                                <Phone className="w-3.5 h-3.5" />
                            </a>
                        )}

                        {/* WhatsApp (Only shown/highlighted if mobile) */}
                        {primaryPhone && !isLandline && (
                            <button
                                onClick={() => openWhatsApp(primaryPhone, card)}
                                className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 flex items-center justify-center transition-all active:scale-95"
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

                        {/* Share Card (WhatsApp, Mail, Messages & all sharing apps) */}
                        <button
                            onClick={handleShareCard}
                            className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center transition-all active:scale-95"
                            title="Share Contact"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
