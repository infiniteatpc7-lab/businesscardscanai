import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Calendar,
    MapPin,
    Check,
    Plus,
    X,
    Sparkles,
    Settings,
    CreditCard,
    Scan
} from 'lucide-react';
import { fetchExhibitions, selectCurrentExhibition } from '../../services/cardApi';
import { useToast } from '../../context/ToastContext';

export default function ExhibitionSelectorModal({
    isOpen,
    onClose,
    currentExhibition,
    onExhibitionChanged,
    userRole = 'member',
    onOpenManage
}) {
    if (!isOpen || typeof document === 'undefined') return null;

    const { showToast } = useToast();
    const [exhibitions, setExhibitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectingId, setSelectingId] = useState(null);
    const [filterTab, setFilterTab] = useState('all'); // 'all', 'active'

    const canManage = userRole === 'owner' || userRole === 'admin';

    const loadExhibitions = async () => {
        setLoading(true);
        try {
            const res = await fetchExhibitions();
            if (res.success && res.exhibitions) {
                setExhibitions(res.exhibitions);
            }
        } catch (err) {
            console.error('Error fetching exhibitions:', err);
            showToast('Unable to load exhibitions', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadExhibitions();
        }
    }, [isOpen]);

    const handleSelect = async (exhibition) => {
        if (exhibition.status === 'archived') {
            showToast('Archived exhibitions cannot be selected', 'warning');
            return;
        }

        if (exhibition.id === currentExhibition?.id) {
            onClose();
            return;
        }

        setSelectingId(exhibition.id);
        try {
            const res = await selectCurrentExhibition(exhibition.id);
            if (res.success && res.exhibition) {
                showToast(`Active show set to "${res.exhibition.name}"`, 'success');
                onExhibitionChanged?.(res.exhibition);
                onClose();
            } else {
                showToast(res.message || 'Failed to switch exhibition', 'error');
            }
        } catch (err) {
            console.error('Select exhibition error:', err);
            showToast('Failed to switch exhibition', 'error');
        } finally {
            setSelectingId(null);
        }
    };

    const filtered = exhibitions.filter((ex) => {
        if (ex.status === 'archived') return false;
        if (filterTab === 'active') return ex.status === 'active';
        return true;
    });

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return { label: 'Live Show', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'upcoming':
                return { label: 'Upcoming', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
            case 'completed':
                return { label: 'Completed', bg: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
            default:
                return { label: status, bg: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            />

            {/* Modal Sheet */}
            <div className="relative bg-white rounded-t-[32px] sm:rounded-3xl p-6 pb-8 w-full max-w-md shadow-2xl space-y-4 z-10 max-h-[90vh] flex flex-col animate-tab-fade">
                {/* Mobile Grabber */}
                <div
                    onClick={onClose}
                    className="w-10 h-1 bg-zinc-300 rounded-full mx-auto sm:hidden mb-2 -mt-1 cursor-pointer"
                />

                {/* Header */}
                <div className="flex items-start justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-sm text-zinc-950">
                                Select Current Exhibition
                            </h3>
                            <p className="text-[11px] text-zinc-500 font-medium">
                                Cards you scan will be tagged to this event
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 shrink-0 transition-colors active:scale-95"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-2xl shrink-0">
                    <button
                        onClick={() => setFilterTab('all')}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                            filterTab === 'all'
                                ? 'bg-white text-zinc-950 shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-800'
                        }`}
                    >
                        All Shows ({exhibitions.filter(e => e.status !== 'archived').length})
                    </button>
                    <button
                        onClick={() => setFilterTab('active')}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                            filterTab === 'active'
                                ? 'bg-white text-zinc-950 shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-800'
                        }`}
                    >
                        Live Active ({exhibitions.filter(e => e.status === 'active').length})
                    </button>
                </div>

                {/* Exhibition List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs font-medium">Loading exhibitions...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-zinc-400 text-xs">
                            No exhibitions found matching this tab.
                        </div>
                    ) : (
                        filtered.map((ex) => {
                            const isCurrent = ex.id === currentExhibition?.id;
                            const isSelecting = selectingId === ex.id;
                            const badge = getStatusBadge(ex.status);

                            return (
                                <button
                                    key={ex.id}
                                    onClick={() => handleSelect(ex)}
                                    disabled={isSelecting}
                                    className={`w-full text-left p-3.5 rounded-2xl border transition-all active:scale-[0.99] flex items-center justify-between gap-3 ${
                                        isCurrent
                                            ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm'
                                            : 'bg-white border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50/60'
                                    }`}
                                >
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-extrabold text-xs text-zinc-950 truncate">
                                                {ex.name}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                                                {badge.label}
                                            </span>
                                        </div>

                                        {(ex.city || ex.venue) && (
                                            <div className="flex items-center gap-1 text-[11px] text-zinc-500 truncate">
                                                <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                                                <span className="truncate">
                                                    {[ex.venue, ex.city].filter(Boolean).join(', ')}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3 text-[10px] text-zinc-400 pt-0.5 font-medium">
                                            <span className="flex items-center gap-1">
                                                <CreditCard className="w-3 h-3" />
                                                {ex.cards_count || 0} cards
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Scan className="w-3 h-3" />
                                                {ex.card_scans_count || 0} scans
                                            </span>
                                        </div>
                                    </div>

                                    <div className="shrink-0 flex items-center justify-center">
                                        {isSelecting ? (
                                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                        ) : isCurrent ? (
                                            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                                                <Check className="w-3.5 h-3.5" />
                                            </div>
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border-2 border-zinc-200"></div>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer / Manage CTA for Owner & Admin */}
                {canManage && (
                    <div className="pt-2 shrink-0 border-t border-zinc-100">
                        <button
                            onClick={() => {
                                onClose();
                                onOpenManage?.();
                            }}
                            className="w-full py-2.5 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Settings className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Manage or Create Exhibitions</span>
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
