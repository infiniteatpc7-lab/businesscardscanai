import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Calendar,
    MapPin,
    Plus,
    X,
    Sparkles,
    Edit2,
    Archive,
    Trash2,
    ArrowLeft,
    Check,
    CreditCard,
    Scan,
    Building2,
    AlertCircle
} from 'lucide-react';
import {
    fetchExhibitions,
    createExhibition,
    updateExhibition,
    deleteExhibition
} from '../../services/cardApi';
import { useToast } from '../../context/ToastContext';

export default function ExhibitionManageModal({
    isOpen,
    onClose,
    currentWorkspace,
    userRole = 'owner',
    onExhibitionUpdated
}) {
    if (!isOpen || typeof document === 'undefined') return null;

    const { showToast } = useToast();
    const [exhibitions, setExhibitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all'); // all, active, upcoming, completed, archived

    // Form state for Create or Edit
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingExhibition, setEditingExhibition] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        organizer: '',
        venue: '',
        city: '',
        start_date: '',
        end_date: '',
        description: '',
        status: 'active',
        set_as_current: true,
    });
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

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

    const openCreateForm = () => {
        setEditingExhibition(null);
        setFormData({
            name: '',
            organizer: '',
            venue: '',
            city: '',
            start_date: '',
            end_date: '',
            description: '',
            status: 'active',
            set_as_current: true,
        });
        setIsFormOpen(true);
    };

    const openEditForm = (ex) => {
        setEditingExhibition(ex);
        setFormData({
            name: ex.name || '',
            organizer: ex.organizer || '',
            venue: ex.venue || '',
            city: ex.city || '',
            start_date: ex.start_date ? ex.start_date.substring(0, 10) : '',
            end_date: ex.end_date ? ex.end_date.substring(0, 10) : '',
            description: ex.description || '',
            status: ex.status || 'active',
            set_as_current: false,
        });
        setIsFormOpen(true);
    };

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        const trimmedName = formData.name.trim();
        if (!trimmedName) {
            showToast('Exhibition name is required', 'warning');
            return;
        }

        if (formData.start_date && formData.end_date) {
            if (new Date(formData.end_date) < new Date(formData.start_date)) {
                showToast('End date cannot be earlier than start date', 'warning');
                return;
            }
        }

        setFormSubmitting(true);
        try {
            if (editingExhibition) {
                const res = await updateExhibition(editingExhibition.id, {
                    name: trimmedName,
                    organizer: formData.organizer?.trim() || null,
                    venue: formData.venue?.trim() || null,
                    city: formData.city?.trim() || null,
                    start_date: formData.start_date || null,
                    end_date: formData.end_date || null,
                    description: formData.description?.trim() || null,
                    status: formData.status,
                });

                if (res.success) {
                    showToast(`Exhibition "${trimmedName}" updated!`, 'success');
                    setIsFormOpen(false);
                    loadExhibitions();
                    onExhibitionUpdated?.();
                } else {
                    showToast(res.message || 'Failed to update exhibition', 'error');
                }
            } else {
                const res = await createExhibition({
                    name: trimmedName,
                    organizer: formData.organizer?.trim() || null,
                    venue: formData.venue?.trim() || null,
                    city: formData.city?.trim() || null,
                    start_date: formData.start_date || null,
                    end_date: formData.end_date || null,
                    description: formData.description?.trim() || null,
                    status: formData.status,
                    set_as_current: formData.set_as_current,
                });

                if (res.success) {
                    showToast(`Exhibition "${trimmedName}" created!`, 'success');
                    setIsFormOpen(false);
                    loadExhibitions();
                    onExhibitionUpdated?.();
                } else {
                    showToast(res.message || 'Failed to create exhibition', 'error');
                }
            }
        } catch (err) {
            console.error('Save exhibition error:', err);
            showToast('Failed to save exhibition', 'error');
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleDeleteOrArchive = async (ex) => {
        const hasRecords = (ex.cards_count > 0 || ex.card_scans_count > 0);
        const actionLabel = hasRecords ? 'archive' : 'delete';

        if (!confirm(`Are you sure you want to ${actionLabel} "${ex.name}"?`)) {
            return;
        }

        setDeletingId(ex.id);
        try {
            const res = await deleteExhibition(ex.id);
            if (res.success) {
                if (res.archived) {
                    showToast(res.message || `Exhibition "${ex.name}" safely archived.`, 'info');
                } else {
                    showToast(`Exhibition "${ex.name}" deleted.`, 'success');
                }
                loadExhibitions();
                onExhibitionUpdated?.();
            } else {
                showToast(res.message || 'Action failed', 'error');
            }
        } catch (err) {
            console.error('Delete/archive exhibition error:', err);
            showToast('Failed to delete/archive exhibition', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const filtered = exhibitions.filter((ex) => {
        if (statusFilter === 'all') return true;
        return ex.status === statusFilter;
    });

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return { label: 'Active', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'upcoming':
                return { label: 'Upcoming', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
            case 'completed':
                return { label: 'Completed', bg: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
            case 'archived':
                return { label: 'Archived', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
            default:
                return { label: status, bg: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
                onClick={() => !formSubmitting && onClose()}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            />

            {/* Modal Sheet */}
            <div className="relative bg-white rounded-t-[32px] sm:rounded-3xl p-6 pb-8 w-full max-w-lg shadow-2xl space-y-4 z-10 max-h-[92vh] flex flex-col animate-tab-fade">
                {/* Mobile Grabber */}
                <div
                    onClick={() => !formSubmitting && onClose()}
                    className="w-10 h-1 bg-zinc-300 rounded-full mx-auto sm:hidden mb-2 -mt-1 cursor-pointer"
                />

                {/* Header */}
                <div className="flex items-start justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                        {isFormOpen ? (
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="w-10 h-10 rounded-2xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 shrink-0 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        ) : (
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                                <Building2 className="w-5 h-5" />
                            </div>
                        )}
                        <div>
                            <h3 className="font-extrabold text-sm text-zinc-950">
                                {isFormOpen
                                    ? (editingExhibition ? 'Edit Exhibition' : 'New Exhibition')
                                    : 'Exhibitions & Trade Shows'}
                            </h3>
                            <p className="text-[11px] text-zinc-500 font-medium">
                                {isFormOpen
                                    ? 'Configure event details and booth tracking'
                                    : `Workspace: ${currentWorkspace?.name || 'Active'}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!isFormOpen && canManage && (
                            <button
                                onClick={openCreateForm}
                                className="px-3 py-1.5 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Create</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 shrink-0 transition-colors active:scale-95"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {isFormOpen ? (
                    /* Create / Edit Form */
                    <form onSubmit={handleSubmitForm} className="space-y-3 flex-1 overflow-y-auto pr-1">
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                                Exhibition Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Morbi Ceramics Expo 2026"
                                required
                                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                                    City / Location
                                </label>
                                <input
                                    type="text"
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    placeholder="e.g. Morbi, Gujarat"
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                                    Venue / Hall
                                </label>
                                <input
                                    type="text"
                                    value={formData.venue}
                                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                                    placeholder="e.g. Expo Ground, Hall 2"
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                                    Organizer (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.organizer}
                                    onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                                    placeholder="e.g. Indian Ceramic Society"
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                                    Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                                >
                                    <option value="active">Active (Live Show)</option>
                                    <option value="upcoming">Upcoming</option>
                                    <option value="completed">Completed</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                                Description / Booth Notes
                            </label>
                            <textarea
                                rows="2"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="e.g. Booth #B-45, Pavilion 3. Meeting sanitaryware exporters."
                                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black resize-none"
                            />
                        </div>

                        {!editingExhibition && (
                            <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.set_as_current}
                                    onChange={(e) => setFormData({ ...formData, set_as_current: e.target.checked })}
                                    className="rounded border-zinc-300 text-black focus:ring-black"
                                />
                                <span className="text-xs font-semibold text-zinc-800">
                                    Set as active exhibition for me right now
                                </span>
                            </label>
                        )}

                        <div className="pt-2 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                className="flex-1 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={formSubmitting}
                                className="flex-1 py-2.5 rounded-xl bg-black hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                {formSubmitting ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                <span>{editingExhibition ? 'Save Changes' : 'Create Exhibition'}</span>
                            </button>
                        </div>
                    </form>
                ) : (
                    /* Exhibition List */
                    <>
                        {/* Status Filter Chips */}
                        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-2xl shrink-0 overflow-x-auto no-scrollbar">
                            {['all', 'active', 'upcoming', 'completed', 'archived'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setStatusFilter(tab)}
                                    className={`py-1 px-3 rounded-xl text-[11px] font-bold capitalize transition-all whitespace-nowrap ${
                                        statusFilter === tab
                                            ? 'bg-white text-zinc-950 shadow-sm'
                                            : 'text-zinc-500 hover:text-zinc-800'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
                            {loading ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs font-medium">Loading exhibitions...</span>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="py-12 text-center text-zinc-400 text-xs">
                                    No exhibitions found in this status.
                                </div>
                            ) : (
                                filtered.map((ex) => {
                                    const badge = getStatusBadge(ex.status);
                                    const isDeleting = deletingId === ex.id;
                                    const hasRecords = (ex.cards_count > 0 || ex.card_scans_count > 0);

                                    return (
                                        <div
                                            key={ex.id}
                                            className="p-3.5 rounded-2xl border border-zinc-200/80 bg-white space-y-2 hover:border-zinc-300 transition-all"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-extrabold text-xs text-zinc-950">
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
                                                        {ex.start_date && (
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" />
                                                                {ex.start_date.substring(0, 10)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                {canManage && (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={() => openEditForm(ex)}
                                                            title="Edit Exhibition"
                                                            className="w-7 h-7 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition-colors active:scale-95"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>

                                                        {ex.status !== 'archived' && (
                                                            <button
                                                                onClick={() => handleDeleteOrArchive(ex)}
                                                                disabled={isDeleting}
                                                                title={hasRecords ? 'Archive Exhibition' : 'Delete Exhibition'}
                                                                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors active:scale-95 ${
                                                                    hasRecords
                                                                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                                                                        : 'bg-red-50 hover:bg-red-100 text-red-600'
                                                                }`}
                                                            >
                                                                {isDeleting ? (
                                                                    <div className="w-3 h-3 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
                                                                ) : hasRecords ? (
                                                                    <Archive className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}

