import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
    ScanLine,
    UploadCloud,
    Camera,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Building2,
    User,
    Briefcase,
    Phone,
    Mail,
    Globe,
    MapPin,
    Tag,
    FileText,
    Copy,
    Check,
    Database,
    Trash2,
    RefreshCw,
    X,
    Search,
    Languages,
    SlidersHorizontal,
    ExternalLink,
    ArrowRight
} from 'lucide-react';

export default function App() {
    // State
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState('');
    const [cardData, setCardData] = useState(null);
    const [activeTab, setActiveTab] = useState('table'); // 'table' | 'json'
    const [copiedJson, setCopiedJson] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedCards, setSavedCards] = useState([]);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [toast, setToast] = useState(null);

    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    // Show toast helper
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Fetch saved cards on mount
    const fetchSavedCards = async () => {
        try {
            const res = await fetch('/api/cards');
            const data = await res.json();
            if (data.success) {
                setSavedCards(data.cards);
            }
        } catch (err) {
            console.error('Error fetching cards:', err);
        }
    };

    useEffect(() => {
        fetchSavedCards();
    }, []);

    // Handle Image Selection
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    // Compress & downscale large phone camera photos before upload
    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const maxDim = 1800;
                    let w = img.width;
                    let h = img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
                    canvas.toBlob((blob) => {
                        const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });
                        resolve({ file: optimizedFile, dataUrl });
                    }, 'image/jpeg', 0.88);
                };
                img.onerror = () => resolve({ file, dataUrl: e.target.result });
                img.src = e.target.result;
            };
            reader.onerror = () => resolve({ file, dataUrl: null });
            reader.readAsDataURL(file);
        });
    };

    const processFile = async (file) => {
        setIsScanning(true);
        setScanProgress('Optimizing card photo...');
        const { file: optimizedFile, dataUrl } = await compressImage(file);
        setImageFile(optimizedFile);
        setImagePreview(dataUrl);
        triggerScan(optimizedFile, dataUrl);
    };

    // Load sample card
    const handleLoadSample = async () => {
        try {
            setImagePreview('/samples/morbi_depo.jpg');
            const res = await fetch('/samples/morbi_depo.jpg');
            const blob = await res.blob();
            const file = new File([blob], 'morbi_depo.jpg', { type: 'image/jpeg' });
            setImageFile(file);
            triggerScan(file);
        } catch (err) {
            console.error('Error loading sample:', err);
            showToast('Failed to load sample image', 'error');
        }
    };

    // Trigger Multimodal Scan via API
    const triggerScan = async (file, base64Url = null) => {
        setIsScanning(true);
        setCardData(null);
        setScanProgress('Uploading business card image...');

        const progressSteps = [
            'Detecting script orientation & text zones...',
            'De-warping decorative Gujarati typography...',
            'Extracting firm name & Roman transliteration...',
            'Parsing mobile numbers & Surat postal code...',
            'Calculating dynamic accuracy rating...'
        ];

        let stepIndex = 0;
        const interval = setInterval(() => {
            if (stepIndex < progressSteps.length) {
                setScanProgress(progressSteps[stepIndex]);
                stepIndex++;
            }
        }, 1200);

        try {
            const formData = new FormData();
            if (file) {
                formData.append('image', file);
            } else if (base64Url) {
                formData.append('image_base64', base64Url);
            }

            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: formData,
            });

            clearInterval(interval);
            const result = await response.json();

            if (result.success && result.data) {
                setCardData(result.data);
                showToast(`Card parsed! Accuracy: ${result.data.accuracy_score || 95}%`, 'success');
            } else {
                showToast(result.message || 'Scan failed to extract card text', 'error');
            }
        } catch (error) {
            clearInterval(interval);
            console.error('Scan error:', error);
            showToast('Scan connection failed. Check server status.', 'error');
        } finally {
            setIsScanning(false);
            setScanProgress('');
        }
    };

    // Save to Database
    const handleSaveToDatabase = async () => {
        if (!cardData) return;
        setIsSaving(true);
        try {
            const payload = {
                company: cardData.company || '',
                company_english: cardData.company_english || '',
                name: cardData.name || '',
                name_english: cardData.name_english || '',
                designation: cardData.designation || '',
                department: cardData.department || '',
                phone: Array.isArray(cardData.phone) ? cardData.phone : (cardData.phone ? [cardData.phone] : []),
                email: cardData.email || '',
                website: cardData.website || '',
                address: cardData.address || '',
                address_english: cardData.address_english || '',
                tagline_services: cardData.tagline_services || '',
                tax_id: cardData.tax_id || '',
                social_profiles: Array.isArray(cardData.social_profiles) ? cardData.social_profiles : [],
                accuracy_score: cardData.accuracy_score || 90,
                accuracy_reason: cardData.accuracy_reason || '',
                detected_language: cardData.detected_language || 'Gujarati',
                image_path: cardData.image_path || imagePreview,
                raw_data: cardData,
            };

            const response = await fetch('/api/cards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            if (result.success) {
                showToast('Card saved successfully to database!', 'success');
                fetchSavedCards();
            } else {
                showToast(result.message || 'Error saving to database', 'error');
            }
        } catch (err) {
            console.error('Save error:', err);
            showToast('Failed to save to database', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Copy JSON
    const handleCopyJson = () => {
        if (!cardData) return;
        navigator.clipboard.writeText(JSON.stringify(cardData, null, 2));
        setCopiedJson(true);
        showToast('JSON copied to clipboard!');
        setTimeout(() => setCopiedJson(false), 2000);
    };

    // Update field directly
    const handleFieldChange = (field, value) => {
        setCardData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Delete card from history
    const handleDeleteCard = async (id) => {
        if (!confirm('Are you sure you want to delete this saved card?')) return;
        try {
            const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('Card deleted');
                fetchSavedCards();
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    // Accuracy badge color styles
    const getAccuracyBadge = (score) => {
        const val = Number(score) || 90;
        if (val >= 90) {
            return {
                bg: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
                dot: 'bg-emerald-500',
                label: 'High Accuracy'
            };
        } else if (val >= 75) {
            return {
                bg: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
                dot: 'bg-amber-500',
                label: 'Medium Accuracy'
            };
        } else {
            return {
                bg: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
                dot: 'bg-rose-500',
                label: 'Needs Review'
            };
        }
    };

    const accuracyBadge = cardData ? getAccuracyBadge(cardData.accuracy_score) : null;

    // Filtered saved cards
    const filteredCards = savedCards.filter(c => {
        if (!historySearch) return true;
        const q = historySearch.toLowerCase();
        return (
            (c.company && c.company.toLowerCase().includes(q)) ||
            (c.company_english && c.company_english.toLowerCase().includes(q)) ||
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.address && c.address.toLowerCase().includes(q)) ||
            (Array.isArray(c.phone) && c.phone.some(p => p.includes(q)))
        );
    });

    return (
        <div className="min-h-screen bg-[#F4F4F6] text-[#111115] relative overflow-x-hidden selection:bg-black selection:text-white pb-20">
            {/* Background subtle neo-grid */}
            <div className="absolute inset-0 bg-subtle-grid pointer-events-none opacity-60"></div>

            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-bounce duration-300">
                    <div className={`px-5 py-3 rounded-full shadow-lg border backdrop-blur-md flex items-center gap-2.5 text-sm font-medium ${
                        toast.type === 'error'
                            ? 'bg-rose-950/90 text-rose-100 border-rose-800'
                            : 'bg-zinc-900/90 text-zinc-100 border-zinc-700'
                    }`}>
                        {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 bg-[#F4F4F6]/80 backdrop-blur-xl border-b border-black/[0.06] px-4 sm:px-8 py-3.5">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-black flex items-center justify-center text-white shadow-sm">
                            <ScanLine className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="font-bold text-base tracking-tight text-zinc-900">CardScan AI</h1>
                                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700">v2.0</span>
                            </div>
                            <p className="text-xs text-zinc-500 font-medium hidden sm:block">Multimodal Gujarati & Regional OCR</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={handleLoadSample}
                            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50 transition-all shadow-sm active:scale-95"
                            title="Load Morbi Depo Gujarati Card"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>Try Sample (મોરબી ડેપો)</span>
                        </button>

                        <button
                            onClick={() => setHistoryOpen(true)}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-black text-white hover:bg-zinc-800 transition-all shadow-pill active:scale-95"
                        >
                            <Database className="w-3.5 h-3.5" />
                            <span>Saved History</span>
                            <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-300 font-mono">
                                {savedCards.length}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Hero */}
            <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-8">
                {/* Behance Hero Section: AI Live Perception Motif */}
                <div className="relative text-center mb-8 pt-2">
                    {/* Halftone / 3D tactile sphere graphic representation */}
                    <div className="mx-auto w-24 h-24 sm:w-28 sm:h-28 rounded-full relative flex items-center justify-center mb-4">
                        <div className="absolute inset-0 rounded-full halftone-orb-glow animate-pulse"></div>
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-zinc-900 via-zinc-800 to-zinc-700 p-0.5 shadow-2xl flex items-center justify-center">
                            <div className="w-full h-full rounded-full bg-radial from-zinc-700 to-zinc-950 flex items-center justify-center border border-white/20">
                                <ScanLine className={`w-8 h-8 sm:w-10 sm:h-10 text-white ${isScanning ? 'animate-spin' : ''}`} />
                            </div>
                        </div>
                        {/* Audio wave pulse rings */}
                        <div className={`absolute -inset-2 rounded-full border border-black/10 pointer-events-none ${isScanning ? 'animate-ping' : ''}`}></div>
                        <div className="absolute -inset-6 rounded-full border border-black/5 pointer-events-none"></div>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200/80 text-[11px] font-semibold text-zinc-600 mb-2">
                        <Languages className="w-3.5 h-3.5 text-zinc-900" />
                        <span>Gujarati · Hindi · English · Decorative Script Specialist</span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 max-w-xl mx-auto">
                        Instant Visiting Card Intelligence
                    </h2>
                    <p className="text-sm text-zinc-600 max-w-md mx-auto mt-1.5 font-normal">
                        Multimodal Gemini AI reads stylized Gujarati fonts, extracts contact data, and yields dual-script transliterations with live accuracy confidence.
                    </p>
                </div>

                {/* Upload & Workspace Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Image Card & Controls (5 Cols) */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] transition-all">
                            <div className="flex items-center justify-between mb-3.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Card Source</span>
                                {imagePreview && (
                                    <button
                                        onClick={() => {
                                            setImagePreview(null);
                                            setImageFile(null);
                                            setCardData(null);
                                        }}
                                        className="text-xs font-medium text-zinc-500 hover:text-black flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        <span>Reset</span>
                                    </button>
                                )}
                            </div>

                            {/* Dropzone or Image Preview */}
                            {!imagePreview ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-zinc-200 hover:border-zinc-400 bg-zinc-50/60 hover:bg-zinc-50 rounded-2xl p-8 text-center cursor-pointer transition-all group"
                                >
                                    <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                                        <UploadCloud className="w-7 h-7 text-zinc-600" />
                                    </div>
                                    <h4 className="text-sm font-bold text-zinc-900 mb-1">Upload Card Image</h4>
                                    <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                                        Drag & drop or tap to browse JPG, PNG, WebP up to 12MB
                                    </p>
                                </div>
                            ) : (
                                <div className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 shadow-inner group">
                                    <img
                                        src={imagePreview}
                                        alt="Card Preview"
                                        className="w-full h-auto max-h-[340px] object-contain mx-auto transition-transform"
                                    />

                                    {/* Scanning Laser Wave Animation */}
                                    {isScanning && (
                                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                            <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10B981] animate-[bounce_2s_infinite]"></div>
                                            <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[0.5px]"></div>
                                        </div>
                                    )}

                                    {/* Overlay Tag */}
                                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-white/90 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl">
                                        <span className="truncate max-w-[200px]">{imageFile?.name || 'morbi_depo.jpg'}</span>
                                        <span className="text-emerald-400 font-semibold">{isScanning ? 'Scanning...' : 'Ready'}</span>
                                    </div>
                                </div>
                            )}

                            {/* Hidden inputs */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/jpg"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {/* Ergonomic Capture Action Buttons (Behance bottom pill style) */}
                            <div className="grid grid-cols-2 gap-2.5 mt-4">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-95"
                                >
                                    <UploadCloud className="w-4 h-4 text-zinc-700" />
                                    <span>Select File</span>
                                </button>
                                <button
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-95"
                                >
                                    <Camera className="w-4 h-4 text-zinc-700" />
                                    <span>Capture Camera</span>
                                </button>
                            </div>

                            {/* Quick Sample Trigger */}
                            <div className="mt-3 pt-3 border-t border-zinc-100 text-center">
                                <button
                                    onClick={handleLoadSample}
                                    className="text-xs text-zinc-600 hover:text-black font-semibold inline-flex items-center gap-1.5"
                                >
                                    <span>Load Sample Gujarati Card (મોરબી ડેપો)</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Scanner Status Box */}
                        {isScanning && (
                            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] text-center space-y-3">
                                <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin mx-auto"></div>
                                <div className="space-y-1">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Multimodal Neural OCR</h4>
                                    <p className="text-sm font-semibold text-zinc-900">{scanProgress}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Scan Results & Editable Form (7 Cols) */}
                    <div className="lg:col-span-7 space-y-4">
                        {!cardData && !isScanning ? (
                            <div className="bg-white rounded-3xl p-12 text-center shadow-behance border border-black/[0.04] flex flex-col items-center justify-center min-h-[380px]">
                                <div className="w-16 h-16 rounded-3xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-4">
                                    <FileText className="w-8 h-8" />
                                </div>
                                <h3 className="text-base font-bold text-zinc-900">No Card Processed Yet</h3>
                                <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-6">
                                    Select an image or click "Try Sample" to watch Gemini Multimodal OCR decode complex fonts, phone numbers, and addresses in real-time.
                                </p>
                                <button
                                    onClick={handleLoadSample}
                                    className="px-5 py-2.5 rounded-full bg-black text-white text-xs font-bold hover:bg-zinc-800 transition-all shadow-pill active:scale-95 flex items-center gap-2"
                                >
                                    <Sparkles className="w-4 h-4 text-amber-400" />
                                    <span>Try Morbi Depo Sample</span>
                                </button>
                            </div>
                        ) : null}

                        {cardData && (
                            <div className="bg-white rounded-3xl p-6 shadow-behance border border-black/[0.04] space-y-6">
                                {/* Header: Dynamic Accuracy Badge & Controls */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100">
                                    {/* Accuracy Badge */}
                                    <div className="flex items-center gap-3">
                                        <div className={`px-3.5 py-1.5 rounded-full border text-xs font-bold flex items-center gap-2 ${accuracyBadge.bg}`}>
                                            <span className={`w-2 h-2 rounded-full ${accuracyBadge.dot} animate-pulse`}></span>
                                            <span>{cardData.accuracy_score || 95}% ACCURACY</span>
                                        </div>
                                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                            {cardData.detected_language || 'Gujarati'}
                                        </span>
                                    </div>

                                    {/* Segmented View Switcher (Behance Case Study Style) */}
                                    <div className="bg-zinc-100 p-1 rounded-2xl flex items-center gap-1 border border-zinc-200/60">
                                        <button
                                            onClick={() => setActiveTab('table')}
                                            className={`px-3.5 py-1 rounded-xl text-xs font-bold transition-all ${
                                                activeTab === 'table'
                                                    ? 'bg-white text-zinc-900 shadow-sm'
                                                    : 'text-zinc-500 hover:text-zinc-800'
                                            }`}
                                        >
                                            Table View
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('json')}
                                            className={`px-3.5 py-1 rounded-xl text-xs font-bold transition-all ${
                                                activeTab === 'json'
                                                    ? 'bg-white text-zinc-900 shadow-sm'
                                                    : 'text-zinc-500 hover:text-zinc-800'
                                            }`}
                                        >
                                            {'{ }'} JSON
                                        </button>
                                    </div>
                                </div>

                                {/* Accuracy Breakdown Reason Bar */}
                                {cardData.accuracy_reason && (
                                    <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-200/80 flex items-start gap-2.5 text-xs text-zinc-600">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-bold text-zinc-900">Analysis Breakdown: </span>
                                            <span>{cardData.accuracy_reason}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Tab 1: Live Editable Table Form */}
                                {activeTab === 'table' && (
                                    <div className="space-y-4 text-xs">
                                        {/* Company Name (Dual-Script) */}
                                        <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                                            <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                                                <Building2 className="w-3.5 h-3.5 text-zinc-700" />
                                                <span>Company / Firm Name</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] text-zinc-400 block mb-0.5">Original Script (ગુજરાતી / हिंदी)</label>
                                                    <input
                                                        type="text"
                                                        value={cardData.company || ''}
                                                        onChange={(e) => handleFieldChange('company', e.target.value)}
                                                        placeholder="Company in original script"
                                                        className="w-full bg-transparent font-gujarati font-bold text-zinc-900 text-sm focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-zinc-400 block mb-0.5">Roman Transliteration / English</label>
                                                    <input
                                                        type="text"
                                                        value={cardData.company_english || ''}
                                                        onChange={(e) => handleFieldChange('company_english', e.target.value)}
                                                        placeholder="English Company name"
                                                        className="w-full bg-transparent font-medium text-zinc-800 text-sm focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Person Name & Title */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                                                <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                                                    <User className="w-3.5 h-3.5 text-zinc-700" />
                                                    <span>Contact Person</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={cardData.name || cardData.name_english || ''}
                                                    onChange={(e) => handleFieldChange('name', e.target.value)}
                                                    placeholder="Person Name (if present)"
                                                    className="w-full bg-transparent font-semibold text-zinc-900 text-sm focus:outline-none"
                                                />
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                                                <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                                                    <Briefcase className="w-3.5 h-3.5 text-zinc-700" />
                                                    <span>Designation / Role</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={cardData.designation || ''}
                                                    onChange={(e) => handleFieldChange('designation', e.target.value)}
                                                    placeholder="e.g. Proprietor, Director"
                                                    className="w-full bg-transparent font-medium text-zinc-900 text-sm focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Phone & Mobile Numbers */}
                                        <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                                            <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                                                <Phone className="w-3.5 h-3.5 text-zinc-700" />
                                                <span>Phone / Mobile Numbers</span>
                                            </div>
                                            <input
                                                type="text"
                                                value={Array.isArray(cardData.phone) ? cardData.phone.join(', ') : (cardData.phone || '')}
                                                onChange={(e) => handleFieldChange('phone', e.target.value.split(',').map(s => s.trim()))}
                                                placeholder="e.g. 7600768285"
                                                className="w-full bg-transparent font-mono font-bold text-zinc-900 text-sm focus:outline-none"
                                            />
                                        </div>

                                        {/* Address (Dual Script) */}
                                        <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                                            <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                                                <MapPin className="w-3.5 h-3.5 text-zinc-700" />
                                                <span>Full Postal Address</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div>
                                                    <label className="text-[10px] text-zinc-400 block mb-0.5">Original Regional Address</label>
                                                    <textarea
                                                        rows={2}
                                                        value={cardData.address || ''}
                                                        onChange={(e) => handleFieldChange('address', e.target.value)}
                                                        placeholder="Address in original script"
                                                        className="w-full bg-transparent font-gujarati text-zinc-800 text-xs focus:outline-none resize-none leading-relaxed"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-zinc-400 block mb-0.5">English Transliteration</label>
                                                    <textarea
                                                        rows={2}
                                                        value={cardData.address_english || ''}
                                                        onChange={(e) => handleFieldChange('address_english', e.target.value)}
                                                        placeholder="English translated address"
                                                        className="w-full bg-transparent font-medium text-zinc-800 text-xs focus:outline-none resize-none leading-relaxed"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Email & Website */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                                                <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                                                    <Mail className="w-3.5 h-3.5 text-zinc-700" />
                                                    <span>Email Address</span>
                                                </div>
                                                <input
                                                    type="email"
                                                    value={cardData.email || ''}
                                                    onChange={(e) => handleFieldChange('email', e.target.value)}
                                                    placeholder="contact@firm.com"
                                                    className="w-full bg-transparent font-medium text-zinc-900 text-xs focus:outline-none"
                                                />
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                                                <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                                                    <Globe className="w-3.5 h-3.5 text-zinc-700" />
                                                    <span>Website</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={cardData.website || ''}
                                                    onChange={(e) => handleFieldChange('website', e.target.value)}
                                                    placeholder="www.firm.com"
                                                    className="w-full bg-transparent font-medium text-zinc-900 text-xs focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tab 2: Clean Formatted JSON View */}
                                {activeTab === 'json' && (
                                    <div className="relative">
                                        <div className="absolute top-3 right-3 z-10">
                                            <button
                                                onClick={handleCopyJson}
                                                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                                            >
                                                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                                            </button>
                                        </div>
                                        <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono overflow-x-auto max-h-[400px] leading-relaxed border border-zinc-800">
                                            {JSON.stringify(cardData, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                                    <button
                                        onClick={handleSaveToDatabase}
                                        disabled={isSaving}
                                        className="w-full sm:flex-1 py-3 px-6 rounded-2xl bg-black hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-pill active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {isSaving ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <Database className="w-4 h-4 text-emerald-400" />
                                        )}
                                        <span>{isSaving ? 'Saving to Database...' : 'Save Card to Database'}</span>
                                    </button>

                                    <button
                                        onClick={handleCopyJson}
                                        className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Copy className="w-4 h-4 text-zinc-600" />
                                        <span>Copy JSON</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Saved Cards History Slide-Over Drawer */}
            {historyOpen && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div
                        onClick={() => setHistoryOpen(false)}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                    ></div>

                    <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
                        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
                            {/* Drawer Header */}
                            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                                        <Database className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-zinc-900">Saved Cards Database</h3>
                                        <p className="text-[11px] text-zinc-500">{savedCards.length} records stored</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setHistoryOpen(false)}
                                    className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-500"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Search Filter */}
                            <div className="p-4 border-b border-zinc-100">
                                <div className="relative">
                                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Search by company, phone, name, city..."
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        className="w-full bg-zinc-50 border border-zinc-200 pl-9 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:border-black font-medium"
                                    />
                                </div>
                            </div>

                            {/* Cards List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {filteredCards.length === 0 ? (
                                    <div className="text-center py-12 text-zinc-400 text-xs">
                                        No matching cards found.
                                    </div>
                                ) : (
                                    filteredCards.map((c) => (
                                        <div
                                            key={c.id}
                                            className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 hover:border-zinc-300 transition-all space-y-2 relative group"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h4 className="font-gujarati font-bold text-sm text-zinc-900 leading-snug">
                                                        {c.company || c.company_english || c.name || 'Unnamed Business'}
                                                    </h4>
                                                    {c.company_english && c.company && (
                                                        <p className="text-[11px] font-medium text-zinc-500">{c.company_english}</p>
                                                    )}
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
                                                    {c.accuracy_score || 95}%
                                                </span>
                                            </div>

                                            {/* Phone number */}
                                            {Array.isArray(c.phone) && c.phone.length > 0 && (
                                                <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-zinc-700">
                                                    <Phone className="w-3 h-3 text-zinc-400" />
                                                    <span>{c.phone.join(', ')}</span>
                                                </div>
                                            )}

                                            {/* Address */}
                                            {c.address && (
                                                <div className="flex items-start gap-1.5 text-[11px] text-zinc-600 line-clamp-2">
                                                    <MapPin className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
                                                    <span className="font-gujarati">{c.address}</span>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between text-[11px]">
                                                <span className="text-zinc-400">
                                                    {new Date(c.created_at).toLocaleDateString()}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setCardData(c.raw_data || c);
                                                            if (c.image_path) setImagePreview(c.image_path);
                                                            setHistoryOpen(false);
                                                            showToast('Card loaded into workspace');
                                                        }}
                                                        className="font-bold text-zinc-900 hover:underline"
                                                    >
                                                        Open in Editor
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCard(c.id)}
                                                        className="text-zinc-400 hover:text-rose-600 p-1"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

