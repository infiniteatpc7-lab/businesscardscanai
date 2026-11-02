import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Search,
    Phone,
    MapPin,
    User,
    Trash2,
    FileSpreadsheet,
    MessageCircle,
    UserPlus,
    X,
    ChevronRight,
    Languages
} from 'lucide-react';
import SwipeableCardItem from '../components/cards/SwipeableCardItem';
import { downloadVCard, openWhatsApp, isLandlineNumber } from '../services/vcfHelper';
import { deleteCard, saveCard } from '../services/cardApi';
import { useToast } from '../context/ToastContext';

export default function MobileCardsPage({
    cards,
    onRefresh,
    onNavigateToScan,
    onExportCSV,
    initialSelectedCard = null,
    onClearSelectedCard
}) {
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterScript, setFilterScript] = useState('all'); // 'all' | 'gujarati' | 'english'
    const [selectedCard, setSelectedCard] = useState(initialSelectedCard);

    useEffect(() => {
        if (initialSelectedCard) {
            setSelectedCard(initialSelectedCard);
            onClearSelectedCard?.();
        }
    }, [initialSelectedCard]);

    // Filter cards
    const filteredCards = cards.filter((card) => {
        const q = searchTerm.toLowerCase();
        const matchesQuery =
            !q ||
            (card.company && card.company.toLowerCase().includes(q)) ||
            (card.company_english && card.company_english.toLowerCase().includes(q)) ||
            (card.name && card.name.toLowerCase().includes(q)) ||
            (card.address && card.address.toLowerCase().includes(q)) ||
            (Array.isArray(card.phone) && card.phone.some((p) => p.includes(q)));

        if (!matchesQuery) return false;

        if (filterScript === 'gujarati') {
            return (
                card.detected_language?.toLowerCase().includes('gujarati') ||
                (card.company && /[\u0A80-\u0AFF]/.test(card.company))
            );
        } else if (filterScript === 'english') {
            return (
                card.detected_language?.toLowerCase().includes('english') &&
                !/[\u0A80-\u0AFF]/.test(card.company || '')
            );
        }

        return true;
    });

    // Delete with smooth swipe & 5-Second Undo Action
    const handleDelete = async (id, cardToDelete = null) => {
        const targetCard = cardToDelete || cards.find((c) => c.id === id);
        try {
            const res = await deleteCard(id);
            if (res.success) {
                if (selectedCard?.id === id) setSelectedCard(null);
                onRefresh();

                // 5-Second Undo Action Toast (Gmail pattern)
                if (targetCard) {
                    showToast(
                        `Deleted "${targetCard.company || targetCard.name || 'Card'}"`,
                        'info',
                        5000,
                        {
                            label: 'UNDO',
                            onClick: async () => {
                                const restorePayload = {
                                    company: targetCard.company || '',
                                    company_english: targetCard.company_english || '',
                                    name: targetCard.name || '',
                                    name_english: targetCard.name_english || '',
                                    designation: targetCard.designation || '',
                                    department: targetCard.department || '',
                                    phone: Array.isArray(targetCard.phone) ? targetCard.phone : (targetCard.phone ? [targetCard.phone] : []),
                                    email: targetCard.email || '',
                                    website: targetCard.website || '',
                                    address: targetCard.address || '',
                                    address_english: targetCard.address_english || '',
                                    tagline_services: targetCard.tagline_services || '',
                                    tax_id: targetCard.tax_id || '',
                                    social_profiles: Array.isArray(targetCard.social_profiles) ? targetCard.social_profiles : [],
                                    accuracy_score: targetCard.accuracy_score || 90,
                                    accuracy_reason: targetCard.accuracy_reason || '',
                                    detected_language: targetCard.detected_language || 'Gujarati',
                                    image_path: targetCard.image_path || null,
                                    raw_data: targetCard.raw_data || null,
                                };
                                const restored = await saveCard(restorePayload);
                                if (restored.success) {
                                    showToast('Card restored successfully!');
                                    onRefresh();
                                }
                            },
                        }
                    );
                }
            }
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Failed to delete card', 'error');
        }
    };

    return (
        <div className="space-y-4 pb-24">
            {/* Search Bar & Header */}
            <div className="bg-white rounded-3xl p-4 shadow-behance border border-black/[0.04] space-y-3">
                <div className="relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search company, phone, name, city..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200/80 pl-10 pr-4 py-2.5 rounded-2xl text-xs font-medium focus:outline-none focus:border-black transition-colors"
                    />
                </div>

                {/* Filter Chips */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px] font-semibold">
                        <button
                            onClick={() => setFilterScript('all')}
                            className={`px-3 py-1 rounded-xl transition-all ${
                                filterScript === 'all'
                                    ? 'bg-black text-white shadow-sm'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                            All ({cards.length})
                        </button>
                        <button
                            onClick={() => setFilterScript('gujarati')}
                            className={`px-3 py-1 rounded-xl font-gujarati transition-all ${
                                filterScript === 'gujarati'
                                    ? 'bg-black text-white shadow-sm'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                            ગુજરાતી
                        </button>
                        <button
                            onClick={() => setFilterScript('english')}
                            className={`px-3 py-1 rounded-xl transition-all ${
                                filterScript === 'english'
                                    ? 'bg-black text-white shadow-sm'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                            English
                        </button>
                    </div>

                    <button
                        onClick={onExportCSV}
                        className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 active:scale-95"
                        title="Export CSV"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Swipe hint */}
            {filteredCards.length > 0 && (
                <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-400 font-medium px-2">
                    <span>Swipe left to delete</span>
                    <span>•</span>
                    <span>Swipe right for WhatsApp</span>
                </div>
            )}

            {/* Cards List (with Gmail-style Swipeable Items) */}
            {filteredCards.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center shadow-behance border border-black/[0.04] space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                        <Search className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-950">No matching business cards</h3>
                    <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                        {searchTerm ? `No results found for "${searchTerm}"` : 'No cards captured yet.'}
                    </p>
                    <button
                        onClick={onNavigateToScan}
                        className="px-4 py-2 rounded-full bg-black text-white text-xs font-bold active:scale-95 shadow-pill"
                    >
                        Scan a Card
                    </button>
                </div>
            ) : (
                <div className="space-y-1">
                    {filteredCards.map((card) => (
                        <SwipeableCardItem
                            key={card.id}
                            card={card}
                            onSelectCard={(c) => setSelectedCard(c)}
                            onDeleteCard={handleDelete}
                            showToast={showToast}
                        />
                    ))}
                </div>
            )}

            {/* Card Inspection Modal - Rendered via Portal at document.body with z-[100] to sit cleanly on top of bottom navigation and header */}
            {selectedCard && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    {/* Dark Backdrop */}
                    <div
                        onClick={() => setSelectedCard(null)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />

                    {/* Bottom Sheet Modal Container */}
                    <div className="relative bg-white rounded-t-[32px] sm:rounded-3xl p-6 pb-8 w-full max-w-md shadow-2xl space-y-4 z-10 max-h-[88vh] overflow-y-auto animate-tab-fade">
                        {/* Mobile grabber bar */}
                        <div
                            onClick={() => setSelectedCard(null)}
                            className="w-10 h-1 bg-zinc-300 rounded-full mx-auto sm:hidden mb-2 -mt-1 cursor-pointer"
                        />

                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 pt-1">
                            <div className="space-y-0.5 min-w-0">
                                <h3 className="font-gujarati font-extrabold text-lg text-zinc-950 truncate">
                                    {selectedCard.company || selectedCard.name || 'Business Card'}
                                </h3>
                                {selectedCard.company_english && (
                                    <p className="text-xs font-semibold text-zinc-500 truncate">
                                        {selectedCard.company_english}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedCard(null)}
                                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 shrink-0 transition-colors active:scale-95"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Card Image Preview if available */}
                        {selectedCard.image_path && (
                            <div className="rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 shadow-inner">
                                <img
                                    src={selectedCard.image_path}
                                    alt="Scanned Card"
                                    className="w-full max-h-48 object-contain mx-auto"
                                />
                            </div>
                        )}

                        {/* Language Tag */}
                        {selectedCard.detected_language && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold text-zinc-500 px-2.5 py-0.5 rounded-full bg-zinc-100">
                                    {selectedCard.detected_language}
                                </span>
                            </div>
                        )}

                        {/* Details Fields */}
                        <div className="space-y-2 text-xs">
                            {selectedCard.name && (
                                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Person</span>
                                    <span className="font-bold text-zinc-950 font-gujarati text-sm">{selectedCard.name}</span>
                                    {selectedCard.designation && (
                                        <span className="text-zinc-500 ml-1.5 text-xs">({selectedCard.designation})</span>
                                    )}
                                </div>
                            )}

                            {Array.isArray(selectedCard.phone) && selectedCard.phone.length > 0 && (
                                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60 space-y-1.5">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Phone Numbers</span>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCard.phone.map((ph, idx) => (
                                            <a
                                                key={idx}
                                                href={`tel:${ph}`}
                                                className="font-mono font-bold text-xs text-zinc-950 bg-white px-2.5 py-1 rounded-xl border border-zinc-200 hover:bg-zinc-100 flex items-center gap-1 active:scale-95 transition-all"
                                            >
                                                <Phone className="w-3 h-3 text-zinc-400" />
                                                <span>{ph}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedCard.address && (
                                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60 space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Postal Address</span>
                                    <p className="font-gujarati text-zinc-900 text-xs leading-relaxed">{selectedCard.address}</p>
                                    {selectedCard.address_english && selectedCard.address_english !== selectedCard.address && (
                                        <p className="text-zinc-500 text-[11px]">{selectedCard.address_english}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 1-Tap Action Pills */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                                onClick={() => {
                                    downloadVCard(selectedCard);
                                    showToast('vCard downloaded for phone contacts');
                                }}
                                className="py-3 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span>Save to Contacts</span>
                            </button>

                            {Array.isArray(selectedCard.phone) && selectedCard.phone[0] && (
                                isLandlineNumber(selectedCard.phone[0]) ? (
                                    <a
                                        href={`tel:${selectedCard.phone[0]}`}
                                        className="py-3 px-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                        <Phone className="w-4 h-4" />
                                        <span>Call Office</span>
                                    </a>
                                ) : (
                                    <button
                                        onClick={() => openWhatsApp(selectedCard.phone[0], selectedCard)}
                                        className="py-3 px-3 rounded-2xl bg-[#0F9D58] hover:bg-[#0b8043] text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        <span>WhatsApp</span>
                                    </button>
                                )
                            )}
                        </div>

                        {/* Delete Action & Close in Modal */}
                        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                            <button
                                onClick={() => handleDelete(selectedCard.id, selectedCard)}
                                className="text-rose-600 font-semibold hover:underline flex items-center gap-1 py-1 px-2 -ml-2 rounded-lg hover:bg-rose-50"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Card</span>
                            </button>

                            <button
                                onClick={() => setSelectedCard(null)}
                                className="px-5 py-2 rounded-xl bg-black text-white text-xs font-bold active:scale-95 transition-all"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
