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
    Mail,
    Globe,
    ChevronRight,
    Languages,
    ExternalLink,
    Pencil,
    Save,
    RotateCcw,
    Download,
    Users,
    Share2
} from 'lucide-react';
import SwipeableCardItem from '../components/cards/SwipeableCardItem';
import CardFormEditor from '../components/scanner/CardFormEditor';
import { downloadVCard, openWhatsApp, isLandlineNumber, initiatePhoneCall } from '../services/vcfHelper';
import { deleteCard, saveCard, updateCard, getCardImageUrl, fetchCardImageBlob, fetchWorkspaceMembers } from '../services/cardApi';
import { useToast } from '../context/ToastContext';
import { Calendar, Building2, Layers } from 'lucide-react';

export default function MobileCardsPage({
    cards,
    onRefresh,
    onNavigateToScan,
    onExportCSV,
    initialSelectedCard = null,
    onClearSelectedCard,
    exhibitions = [],
    currentExhibition = null,
    workspaceRole = 'member',
    workspaceId = null
}) {
    const { showToast } = useToast();
    const isOwnerOrAdmin = workspaceRole === 'owner' || workspaceRole === 'admin';

    const [searchTerm, setSearchTerm] = useState('');
    const [filterScript, setFilterScript] = useState('all'); // 'all' | 'gujarati' | 'english'
    const [selectedExhibitionFilter, setSelectedExhibitionFilter] = useState('all');
    const [selectedMemberFilter, setSelectedMemberFilter] = useState('all');
    const [workspaceMembers, setWorkspaceMembers] = useState([]);
    const [selectedCard, setSelectedCard] = useState(initialSelectedCard);
    const [cardImageBlobUrl, setCardImageBlobUrl] = useState(null);
    const [backImageBlobUrl, setBackImageBlobUrl] = useState(null);
    const [activeImageTab, setActiveImageTab] = useState('front'); // 'front' | 'back'

    // Edit mode states
    const [isEditing, setIsEditing] = useState(false);
    const [editFormData, setEditFormData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (initialSelectedCard) {
            setSelectedCard(initialSelectedCard);
            setIsEditing(false);
            setEditFormData(null);
            onClearSelectedCard?.();
        }
    }, [initialSelectedCard]);

    useEffect(() => {
        if (isOwnerOrAdmin && workspaceId) {
            fetchWorkspaceMembers(workspaceId).then((res) => {
                if (res && res.success && Array.isArray(res.members)) {
                    setWorkspaceMembers(res.members);
                }
            }).catch((err) => {
                console.error('Failed to load workspace members for filter:', err);
            });
        }
    }, [isOwnerOrAdmin, workspaceId]);

    const startEditing = () => {
        if (!selectedCard) return;
        setEditFormData({
            company: selectedCard.company || '',
            company_english: selectedCard.company_english || '',
            name: selectedCard.name || '',
            name_english: selectedCard.name_english || '',
            designation: selectedCard.designation || '',
            department: selectedCard.department || '',
            phone: Array.isArray(selectedCard.phone) ? [...selectedCard.phone] : (selectedCard.phone ? [selectedCard.phone] : []),
            email: selectedCard.email || '',
            website: selectedCard.website || '',
            address: selectedCard.address || '',
            address_english: selectedCard.address_english || '',
            tagline_services: selectedCard.tagline_services || '',
            tax_id: selectedCard.tax_id || '',
            social_profiles: Array.isArray(selectedCard.social_profiles) ? [...selectedCard.social_profiles] : [],
        });
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditFormData(null);
    };

    const handleEditFieldChange = (field, value) => {
        setEditFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const saveEditChanges = async () => {
        if (!selectedCard || !editFormData) return;
        setIsSaving(true);
        try {
            const res = await updateCard(selectedCard.id, editFormData);
            if (res.success && res.card) {
                setSelectedCard(res.card);
                setIsEditing(false);
                setEditFormData(null);
                showToast('Card updated successfully!', 'success');
                onRefresh?.();
            } else {
                showToast(res.message || 'Failed to update card', 'error');
            }
        } catch (err) {
            console.error('Update card error:', err);
            showToast('Network error while updating card', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadImage = async (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!selectedCard) return;

        try {
            let activeUrl = activeImageTab === 'back'
                ? (backImageBlobUrl || selectedCard.back_image_path)
                : (cardImageBlobUrl || getCardImageUrl(selectedCard) || selectedCard.image_path);

            let downloadUrl = activeUrl;
            let shouldRevoke = false;

            // If not a local blob: or data: URL, fetch the image as an authenticated blob
            if (!downloadUrl || (!downloadUrl.startsWith('blob:') && !downloadUrl.startsWith('data:'))) {
                const fetchedBlob = await fetchCardImageBlob(selectedCard.id, activeImageTab);
                if (fetchedBlob) {
                    downloadUrl = fetchedBlob;
                    shouldRevoke = true;
                }
            }

            if (!downloadUrl) {
                showToast('Image file is not accessible for download.', 'warning');
                return;
            }

            // Create clean file name based on company or contact person
            const cleanName = (selectedCard.company || selectedCard.name || 'business_card')
                .trim()
                .replace(/[^a-zA-Z0-9_\u0A80-\u0AFF]/g, '_')
                .substring(0, 35);
            const sideSuffix = activeImageTab === 'back' ? '_back' : '_front';
            const fileName = `${cleanName}${sideSuffix}.jpg`;

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (shouldRevoke) {
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 3000);
            }

            showToast(`Card image downloaded (${fileName})`, 'success');
        } catch (err) {
            console.error('Image download error:', err);
            showToast('Failed to download card image', 'error');
        }
    };

    const handleShareCard = async (targetCard) => {
        if (!targetCard) return;
        const name = targetCard.name || targetCard.company || 'Business Contact';
        const company = targetCard.company || targetCard.company_english || '';
        const phone = Array.isArray(targetCard.phone) && targetCard.phone[0] ? targetCard.phone[0] : (typeof targetCard.phone === 'string' ? targetCard.phone : '');
        const email = targetCard.email || '';
        const address = targetCard.address || '';
        const website = targetCard.website || '';

        const lines = [
            name,
            company && company !== name ? `Company: ${company}` : '',
            targetCard.designation ? `Designation: ${targetCard.designation}` : '',
            phone ? `Phone: ${phone}` : '',
            email ? `Email: ${email}` : '',
            website ? `Website: ${website}` : '',
            address ? `Address: ${address}` : '',
        ].filter(Boolean);

        const shareText = lines.join('\n');

        if (navigator.share) {
            try {
                await navigator.share({
                    title: name,
                    text: shareText,
                });
                showToast('Card shared successfully');
                return;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    if (navigator.clipboard) {
                        await navigator.clipboard.writeText(shareText);
                        showToast('Contact copied to clipboard');
                    }
                }
                return;
            }
        }

        if (navigator.clipboard) {
            await navigator.clipboard.writeText(shareText);
            showToast('Contact copied to clipboard');
        } else {
            showToast('Sharing not supported on this browser');
        }
    };

    useEffect(() => {
        let active = true;
        let createdFrontUrl = null;
        let createdBackUrl = null;
        setActiveImageTab('front');

        if (selectedCard?.id) {
            // Fetch front photo
            fetchCardImageBlob(selectedCard.id, 'front').then((url) => {
                if (active && url) {
                    createdFrontUrl = url;
                    setCardImageBlobUrl(url);
                }
            });

            // Fetch back photo if exists
            if (selectedCard.back_image_path) {
                fetchCardImageBlob(selectedCard.id, 'back').then((url) => {
                    if (active && url) {
                        createdBackUrl = url;
                        setBackImageBlobUrl(url);
                    }
                });
            } else {
                setBackImageBlobUrl(null);
            }
        } else {
            setCardImageBlobUrl(null);
            setBackImageBlobUrl(null);
        }

        return () => {
            active = false;
            if (createdFrontUrl) URL.revokeObjectURL(createdFrontUrl);
            if (createdBackUrl) URL.revokeObjectURL(createdBackUrl);
        };
    }, [selectedCard?.id]);

    // Filter cards by Search, Script, Exhibition, and Team Member
    const filteredCards = cards.filter((card) => {
        // Exhibition filter
        if (selectedExhibitionFilter !== 'all') {
            const exId = Number(selectedExhibitionFilter);
            const matchesExhibition = Array.isArray(card.exhibitions) && card.exhibitions.some(e => e.id === exId);
            if (!matchesExhibition) return false;
        }

        // Team Member filter (Owner and Admin only)
        if (isOwnerOrAdmin && selectedMemberFilter !== 'all') {
            const mId = Number(selectedMemberFilter);
            const matchesMember = Array.isArray(card.scanners) && card.scanners.some(s => s.id === mId);
            if (!matchesMember) return false;
        }

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
                                    accuracy_score: targetCard.accuracy_score || 95,
                                    accuracy_reason: targetCard.accuracy_reason || '',
                                    detected_language: targetCard.detected_language || 'Gujarati',
                                    image_path: targetCard.image_path || null,
                                    raw_data: targetCard.raw_data || null,
                                };
                                await saveCard(restorePayload);
                                onRefresh();
                                showToast(`Restored "${targetCard.company || targetCard.name || 'Card'}"`, 'success');
                            },
                        }
                    );
                }
            } else {
                showToast(res.message || 'Failed to delete card', 'error');
            }
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Failed to delete card', 'error');
        }
    };

    const hasFiltersApplied = searchTerm.trim().length > 0 ||
        filterScript !== 'all' ||
        selectedExhibitionFilter !== 'all' ||
        (isOwnerOrAdmin && selectedMemberFilter !== 'all');

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
                        className="w-full bg-zinc-50 border border-zinc-200/80 pl-10 pr-9 py-2.5 rounded-2xl text-xs font-medium focus:outline-none focus:border-black transition-colors"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-200/80 hover:bg-zinc-300 text-zinc-600 flex items-center justify-center transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
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
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-semibold transition-all active:scale-95 shrink-0"
                        title="Export CSV"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        <span>Export CSV</span>
                    </button>
                </div>

                {/* Exhibition Filter Dropdown */}
                {exhibitions.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-100">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <select
                            value={selectedExhibitionFilter}
                            onChange={(e) => setSelectedExhibitionFilter(e.target.value)}
                            className="flex-1 bg-zinc-50 border border-zinc-200/80 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-1 focus:ring-black"
                        >
                            <option value="all">All Shows ({cards.length} cards)</option>
                            {exhibitions.map((ex) => (
                                <option key={ex.id} value={ex.id}>
                                    {ex.name} ({ex.cards_count || 0})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Team Member Filter Dropdown (Owner & Admin only) */}
                {isOwnerOrAdmin && workspaceMembers.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-100">
                        <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <select
                            value={selectedMemberFilter}
                            onChange={(e) => setSelectedMemberFilter(e.target.value)}
                            className="flex-1 bg-zinc-50 border border-zinc-200/80 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-1 focus:ring-black"
                        >
                            <option value="all">All Members ({cards.length} cards)</option>
                            {workspaceMembers.map((member) => (
                                <option key={member.id} value={member.id}>
                                    {member.name}
                                </option>
                            ))}
                        </select>
                        {selectedMemberFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setSelectedMemberFilter('all')}
                                className="px-2 py-1 text-[10px] font-bold text-zinc-500 hover:text-black bg-zinc-100 rounded-lg transition-colors"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Filter Result Counter / Swipe Hint */}
            <div className="flex items-center justify-between px-2 text-[10px] text-zinc-400 font-medium">
                {hasFiltersApplied ? (
                    <span>
                        Showing {filteredCards.length} of {cards.length} cards
                    </span>
                ) : (
                    <span>{cards.length} cards in directory</span>
                )}
                {filteredCards.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        <span>Swipe left to delete</span>
                        <span>•</span>
                        <span>Swipe right for WhatsApp</span>
                    </div>
                )}
            </div>

            {/* Cards List (with Gmail-style Swipeable Items) */}
            {filteredCards.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center shadow-behance border border-black/[0.04] space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                        <Search className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-sm font-bold text-zinc-950">No matching business cards</h3>
                        <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                            {searchTerm ? `No results found for "${searchTerm}"` : 'No cards captured yet.'}
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                        {hasFiltersApplied && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterScript('all');
                                    setSelectedExhibitionFilter('all');
                                    setSelectedMemberFilter('all');
                                }}
                                className="px-3.5 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold"
                            >
                                Clear Filters
                            </button>
                        )}
                        <button
                            onClick={onNavigateToScan}
                            className="px-4 py-1.5 rounded-full bg-black text-white text-xs font-bold active:scale-95 shadow-pill"
                        >
                            Scan a Card
                        </button>
                    </div>
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
                            isOwnerOrAdmin={isOwnerOrAdmin}
                            onFilterByMember={(id) => setSelectedMemberFilter(String(id))}
                        />
                    ))}
                </div>
            )}

            {/* Card Inspection Modal - Rendered via Portal at document.body with z-[100] */}
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
                            <div className="flex items-center gap-1.5 shrink-0">
                                {!isEditing && (
                                    <button
                                        onClick={startEditing}
                                        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 transition-colors active:scale-95"
                                        title="Edit Card Details"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setSelectedCard(null);
                                    }}
                                    className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition-colors active:scale-95"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {isEditing ? (
                            /* Card Edit Mode with CardFormEditor */
                            <div className="space-y-4 pt-1">
                                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                                    <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                                        Editing Contact Details
                                    </span>
                                    <span className="text-[11px] text-zinc-400">Save to update workspace</span>
                                </div>

                                <CardFormEditor
                                    cardData={editFormData}
                                    onChange={handleEditFieldChange}
                                />

                                <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                                    <button
                                        type="button"
                                        onClick={cancelEditing}
                                        disabled={isSaving}
                                        className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 font-bold text-xs hover:bg-zinc-50 active:scale-95 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={saveEditChanges}
                                        disabled={isSaving}
                                        className="flex-1 py-2.5 rounded-xl bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Normal View Mode */
                            <>
                                {/* Front / Back Image Tabs & Preview with Direct Tap-to-Download */}
                                {(cardImageBlobUrl || getCardImageUrl(selectedCard) || selectedCard.image_path) && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            {selectedCard.back_image_path ? (
                                                <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-xl max-w-[200px]">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveImageTab('front');
                                                        }}
                                                        className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] font-bold transition-all ${
                                                            activeImageTab === 'front'
                                                                ? 'bg-white text-zinc-950 shadow-xs'
                                                                : 'text-zinc-500 hover:text-zinc-800'
                                                        }`}
                                                    >
                                                        Front Image
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveImageTab('back');
                                                        }}
                                                        className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] font-bold transition-all ${
                                                            activeImageTab === 'back'
                                                                ? 'bg-white text-zinc-950 shadow-xs'
                                                                : 'text-zinc-500 hover:text-zinc-800'
                                                        }`}
                                                    >
                                                        Back Image
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] uppercase font-bold text-zinc-400">Card Photo</span>
                                            )}

                                            <button
                                                type="button"
                                                onClick={handleDownloadImage}
                                                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold transition-all active:scale-95 shadow-2xs shrink-0"
                                                title="Download card image"
                                            >
                                                <Download className="w-3.5 h-3.5 text-zinc-600" />
                                                <span>Download</span>
                                            </button>
                                        </div>

                                        <div
                                            onClick={handleDownloadImage}
                                            className="group relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 shadow-inner cursor-pointer select-none active:scale-[0.99] transition-transform"
                                            title="Tap to download card image"
                                        >
                                            <img
                                                src={
                                                    activeImageTab === 'back'
                                                        ? (backImageBlobUrl || selectedCard.back_image_path)
                                                        : (cardImageBlobUrl || getCardImageUrl(selectedCard) || selectedCard.image_path)
                                                }
                                                alt="Scanned Card"
                                                className="w-full max-h-52 object-contain mx-auto transition-transform duration-200 group-hover:scale-[1.01]"
                                            />

                                            {/* Floating Download Chip on bottom-right */}
                                            <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1.5 shadow-md pointer-events-none transition-all group-hover:bg-black/90">
                                                <Download className="w-3 h-3 text-emerald-400" />
                                                <span>Tap to Download</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Language & Exhibition Badges */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {isOwnerOrAdmin && Array.isArray(selectedCard.scanners) && selectedCard.scanners.map((scanner) => (
                                        <span
                                            key={scanner.id}
                                            className="text-[10px] uppercase font-mono font-bold text-blue-700 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80"
                                        >
                                            {scanner.name}
                                        </span>
                                    ))}
                                    {selectedCard.detected_language && (
                                        <span className="text-[10px] uppercase font-mono font-bold text-zinc-600 px-2.5 py-0.5 rounded-full bg-zinc-100">
                                            {selectedCard.detected_language}
                                        </span>
                                    )}

                                    {Array.isArray(selectedCard.exhibitions) && selectedCard.exhibitions.map((ex) => (
                                        <span
                                            key={ex.id}
                                            className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center gap-1"
                                        >
                                            <Calendar className="w-2.5 h-2.5" />
                                            <span>{ex.name}</span>
                                        </span>
                                    ))}
                                </div>

                                {/* Details Fields */}
                                <div className="space-y-2 text-xs">
                                    {selectedCard.name && (
                                        <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                                            <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Contact Person</span>
                                            <span className="font-bold text-zinc-950 font-gujarati text-sm">{selectedCard.name}</span>
                                            {selectedCard.designation && (
                                                <span className="text-zinc-500 ml-1.5 text-xs">({selectedCard.designation})</span>
                                            )}
                                        </div>
                                    )}

                                    {Array.isArray(selectedCard.phone) && selectedCard.phone.length > 0 && (
                                        <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60 space-y-2">
                                            <span className="text-[10px] uppercase font-bold text-zinc-400 block">Phone Numbers</span>
                                            <div className="space-y-1.5">
                                                {selectedCard.phone.map((ph, idx) => {
                                                    const isPhoneLandline = isLandlineNumber(ph);
                                                    return (
                                                        <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-white border border-zinc-200">
                                                            <span className="font-mono font-bold text-xs text-zinc-950 pl-1">{ph}</span>
                                                            <div className="flex items-center gap-1">
                                                                <a
                                                                    href={`tel:${ph}`}
                                                                    className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-semibold flex items-center gap-1"
                                                                >
                                                                    <Phone className="w-3 h-3" />
                                                                    <span>Call</span>
                                                                </a>
                                                                {!isPhoneLandline && (
                                                                    <button
                                                                        onClick={() => openWhatsApp(ph, selectedCard)}
                                                                        className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold flex items-center gap-1"
                                                                    >
                                                                        <MessageCircle className="w-3 h-3" />
                                                                        <span>WhatsApp</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {selectedCard.email && (
                                        <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Email</span>
                                                <a href={`mailto:${selectedCard.email}`} className="font-mono text-zinc-900 font-semibold underline">
                                                    {selectedCard.email}
                                                </a>
                                            </div>
                                            <Mail className="w-4 h-4 text-zinc-400" />
                                        </div>
                                    )}

                                    {selectedCard.website && (
                                        <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Website</span>
                                                <a
                                                    href={selectedCard.website.startsWith('http') ? selectedCard.website : `https://${selectedCard.website}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-blue-600 font-semibold flex items-center gap-1"
                                                >
                                                    <span>{selectedCard.website}</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>
                                            <Globe className="w-4 h-4 text-zinc-400" />
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

                                    {/* Individual Scan History Breakdown */}
                                    {Array.isArray(selectedCard.scans) && selectedCard.scans.length > 0 && (
                                        <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60 space-y-2">
                                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-400">
                                                <span>Scan Capture History</span>
                                                <span>{selectedCard.scans.length} events</span>
                                            </div>
                                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                                                {selectedCard.scans.map((scan) => (
                                                    <div
                                                        key={scan.id}
                                                        className="p-2 rounded-xl bg-white border border-zinc-200 flex items-center justify-between text-[11px]"
                                                    >
                                                        <div className="min-w-0 pr-2">
                                                            <span className="font-bold text-zinc-900 block truncate">
                                                                {scan.exhibition?.name || 'Exhibition Scan'}
                                                            </span>
                                                            <span className="text-zinc-400 text-[10px] block truncate">
                                                                By {scan.user?.name || 'Staff'} • {scan.scanned_at ? new Date(scan.scanned_at).toLocaleDateString() : 'Recorded'}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                                                            {scan.accuracy_score || 90}%
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 1-Tap Action Pills */}
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                    <button
                                        onClick={() => {
                                            downloadVCard(selectedCard);
                                            showToast('vCard downloaded for phone contacts');
                                        }}
                                        className="py-3 px-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
                                        title="Save to Phone Contacts"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        <span>Save</span>
                                    </button>

                                    {Array.isArray(selectedCard.phone) && selectedCard.phone[0] && (
                                        isLandlineNumber(selectedCard.phone[0]) ? (
                                            <a
                                                href={`tel:${selectedCard.phone[0]}`}
                                                className="py-3 px-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm"
                                            >
                                                <Phone className="w-4 h-4" />
                                                <span>Call</span>
                                            </a>
                                        ) : (
                                            <button
                                                onClick={() => openWhatsApp(selectedCard.phone[0], selectedCard)}
                                                className="py-3 px-2 rounded-2xl bg-[#0F9D58] hover:bg-[#0b8043] text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm"
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                                <span>WhatsApp</span>
                                            </button>
                                        )
                                    )}

                                    <button
                                        onClick={() => handleShareCard(selectedCard)}
                                        className="py-3 px-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
                                        title="Share Card via WhatsApp, Email, etc."
                                    >
                                        <Share2 className="w-4 h-4 text-zinc-700" />
                                        <span>Share</span>
                                    </button>
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
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
