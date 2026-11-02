import React, { useState } from 'react';
import {
    Search,
    Download,
    Plus,
    Building2,
    User,
    Phone,
    MapPin,
    Mail,
    Globe,
    Trash2,
    Edit3,
    ExternalLink,
    Filter,
    Check,
    X,
    FileSpreadsheet,
    Languages
} from 'lucide-react';
import { AccuracyBadge, StatusBadge } from '../components/common/Badge';
import { deleteCard } from '../services/cardApi';
import { useToast } from '../context/ToastContext';

export default function ContactsPage({
    cards,
    onRefresh,
    onNavigateToScanner
}) {
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState('all'); // 'all' | 'gujarati' | 'english'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
    const [selectedCard, setSelectedCard] = useState(null);

    // Filter cards
    const filteredCards = cards.filter((card) => {
        const query = searchTerm.toLowerCase();
        const matchesQuery =
            !query ||
            (card.company && card.company.toLowerCase().includes(query)) ||
            (card.company_english && card.company_english.toLowerCase().includes(query)) ||
            (card.name && card.name.toLowerCase().includes(query)) ||
            (card.address && card.address.toLowerCase().includes(query)) ||
            (Array.isArray(card.phone) && card.phone.some((p) => p.includes(query)));

        if (!matchesQuery) return false;

        if (selectedLanguage === 'gujarati') {
            return card.detected_language?.toLowerCase().includes('gujarati') || (card.company && /[\u0A80-\u0AFF]/.test(card.company));
        } else if (selectedLanguage === 'english') {
            return card.detected_language?.toLowerCase().includes('english') && !/[\u0A80-\u0AFF]/.test(card.company || '');
        }

        return true;
    });

    // Delete handler
    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this contact?')) return;
        try {
            const res = await deleteCard(id);
            if (res.success) {
                showToast('Contact deleted successfully');
                if (selectedCard?.id === id) setSelectedCard(null);
                onRefresh();
            }
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Failed to delete contact', 'error');
        }
    };

    // Export CSV
    const handleExportCSV = () => {
        if (cards.length === 0) {
            showToast('No contacts to export', 'info');
            return;
        }

        const headers = ['ID', 'Company', 'Company English', 'Name', 'Phone', 'Email', 'Address', 'Accuracy Score', 'Created At'];
        const rows = cards.map((c) => [
            c.id,
            `"${(c.company || '').replace(/"/g, '""')}"`,
            `"${(c.company_english || '').replace(/"/g, '""')}"`,
            `"${(c.name || '').replace(/"/g, '""')}"`,
            `"${(Array.isArray(c.phone) ? c.phone.join('; ') : c.phone || '').replace(/"/g, '""')}"`,
            `"${(c.email || '').replace(/"/g, '""')}"`,
            `"${(c.address || '').replace(/"/g, '""')}"`,
            c.accuracy_score || 95,
            c.created_at || ''
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `contacts_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV Exported successfully!');
    };

    return (
        <div className="space-y-6">
            {/* Header Toolbar */}
            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search company, name, phone, Surat address..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200/80 pl-10 pr-4 py-2.5 rounded-2xl text-xs font-medium focus:outline-none focus:border-black transition-colors"
                    />
                </div>

                {/* Filter and Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Language Filter */}
                    <div className="bg-zinc-100 p-1 rounded-2xl flex items-center gap-1 border border-zinc-200/60 text-xs font-semibold">
                        <button
                            onClick={() => setSelectedLanguage('all')}
                            className={`px-3 py-1 rounded-xl transition-all ${
                                selectedLanguage === 'all' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600'
                            }`}
                        >
                            All ({cards.length})
                        </button>
                        <button
                            onClick={() => setSelectedLanguage('gujarati')}
                            className={`px-3 py-1 rounded-xl font-gujarati transition-all ${
                                selectedLanguage === 'gujarati' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600'
                            }`}
                        >
                            ગુજરાતી
                        </button>
                        <button
                            onClick={() => setSelectedLanguage('english')}
                            className={`px-3 py-1 rounded-xl transition-all ${
                                selectedLanguage === 'english' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600'
                            }`}
                        >
                            English
                        </button>
                    </div>

                    {/* Export CSV */}
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-all active:scale-95"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-600" />
                        <span>Export CSV</span>
                    </button>

                    {/* New Card */}
                    <button
                        onClick={onNavigateToScanner}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-black text-white text-xs font-bold hover:bg-zinc-800 transition-all shadow-pill active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Scan New</span>
                    </button>
                </div>
            </div>

            {/* Contacts Content */}
            {filteredCards.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center shadow-behance border border-black/[0.04] space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                        <User className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-zinc-950">No contacts found</h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                        {searchTerm
                            ? `No results matching "${searchTerm}". Try another search term.`
                            : 'Scan visiting cards to build your exhibition lead address book.'}
                    </p>
                    <button
                        onClick={onNavigateToScanner}
                        className="px-5 py-2.5 rounded-full bg-black text-white text-xs font-bold hover:bg-zinc-800 transition-all shadow-pill active:scale-95"
                    >
                        Scan First Card
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredCards.map((card) => (
                        <div
                            key={card.id}
                            className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] hover:shadow-behance-lg transition-all flex flex-col justify-between space-y-4 group cursor-pointer"
                            onClick={() => setSelectedCard(card)}
                        >
                            <div className="space-y-3">
                                {/* Card Header */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-0.5">
                                        <h3 className="font-gujarati font-bold text-base text-zinc-950 group-hover:text-black leading-snug">
                                            {card.company || card.name || 'Unnamed Company'}
                                        </h3>
                                        {card.company_english && card.company && (
                                            <p className="text-xs font-medium text-zinc-500">
                                                {card.company_english}
                                            </p>
                                        )}
                                    </div>
                                    <AccuracyBadge score={card.accuracy_score} />
                                </div>

                                {/* Person / Role */}
                                {(card.name || card.designation) && (
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-700 font-semibold pt-1">
                                        <User className="w-3.5 h-3.5 text-zinc-400" />
                                        <span>{card.name || 'Contact'}</span>
                                        {card.designation && (
                                            <span className="text-zinc-400 font-normal">· {card.designation}</span>
                                        )}
                                    </div>
                                )}

                                {/* Phone */}
                                {Array.isArray(card.phone) && card.phone.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-zinc-800">
                                        <Phone className="w-3.5 h-3.5 text-zinc-400" />
                                        <span>{card.phone.join(', ')}</span>
                                    </div>
                                )}

                                {/* Address */}
                                {card.address && (
                                    <div className="flex items-start gap-1.5 text-[11px] text-zinc-600 line-clamp-2 leading-relaxed">
                                        <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                                        <span className="font-gujarati">{card.address}</span>
                                    </div>
                                )}
                            </div>

                            {/* Card Footer */}
                            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                                <span>{new Date(card.created_at || Date.now()).toLocaleDateString()}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCard(card);
                                        }}
                                        className="font-bold text-zinc-900 hover:underline px-1"
                                    >
                                        View Details
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(card.id);
                                        }}
                                        className="text-zinc-400 hover:text-rose-600 p-1 rounded-md"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Contact Detail Modal */}
            {selectedCard && (
                <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
                    <div
                        onClick={() => setSelectedCard(null)}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                    />

                    <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 z-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <h3 className="font-gujarati font-extrabold text-xl text-zinc-950">
                                    {selectedCard.company || selectedCard.name || 'Business Contact'}
                                </h3>
                                {selectedCard.company_english && (
                                    <p className="text-sm font-semibold text-zinc-600">
                                        {selectedCard.company_english}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedCard(null)}
                                className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-black"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <AccuracyBadge score={selectedCard.accuracy_score} />
                            <StatusBadge status="verified" />
                            <span className="text-xs font-semibold text-zinc-400">
                                {selectedCard.detected_language || 'Gujarati'}
                            </span>
                        </div>

                        {/* Details Grid */}
                        <div className="space-y-3 text-xs">
                            {selectedCard.name && (
                                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Person</span>
                                    <span className="text-sm font-bold text-zinc-900">{selectedCard.name}</span>
                                    {selectedCard.designation && <span className="text-zinc-500 ml-1">({selectedCard.designation})</span>}
                                </div>
                            )}

                            {Array.isArray(selectedCard.phone) && selectedCard.phone.length > 0 && (
                                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Phone / WhatsApp</span>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCard.phone.map((ph, idx) => (
                                            <a
                                                key={idx}
                                                href={`tel:${ph}`}
                                                className="font-mono font-bold text-sm text-emerald-700 hover:underline"
                                            >
                                                {ph}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedCard.address && (
                                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Postal Address</span>
                                    <p className="font-gujarati text-zinc-900 text-xs leading-relaxed">{selectedCard.address}</p>
                                    {selectedCard.address_english && (
                                        <p className="text-zinc-500 text-xs">{selectedCard.address_english}</p>
                                    )}
                                </div>
                            )}

                            {selectedCard.accuracy_reason && (
                                <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 text-emerald-900">
                                    <span className="text-[10px] uppercase font-bold text-emerald-700 block mb-0.5">OCR Analysis</span>
                                    <p className="text-xs leading-relaxed">{selectedCard.accuracy_reason}</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                            <button
                                onClick={() => handleDelete(selectedCard.id)}
                                className="px-4 py-2 rounded-2xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Contact</span>
                            </button>

                            <button
                                onClick={() => setSelectedCard(null)}
                                className="px-6 py-2.5 rounded-2xl bg-black text-white text-xs font-bold hover:bg-zinc-800 transition-all shadow-pill"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
