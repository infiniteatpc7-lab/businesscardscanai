import React, { useState } from 'react';
import {
    ScanLine,
    Languages,
    FileText,
    Sparkles,
    Database,
    Copy,
    CheckCircle2,
    ArrowRight
} from 'lucide-react';
import CardUploadDropzone from '../components/scanner/CardUploadDropzone';
import CardFormEditor from '../components/scanner/CardFormEditor';
import JsonViewer from '../components/scanner/JsonViewer';
import { AccuracyBadge } from '../components/common/Badge';
import { scanCard, saveCard } from '../services/cardApi';
import { useImageProcessor } from '../hooks/useImageProcessor';
import { useToast } from '../context/ToastContext';

export default function ScannerPage({ onCardSaved, onNavigateToContacts }) {
    const { showToast } = useToast();
    const { compressImage } = useImageProcessor();

    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageFileName, setImageFileName] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState('');
    const [cardData, setCardData] = useState(null);
    const [activeTab, setActiveTab] = useState('table'); // 'table' | 'json'
    const [isSaving, setIsSaving] = useState(false);

    // Handle File Selection
    const handleFileSelected = async (file) => {
        setIsScanning(true);
        setScanProgress('Optimizing card photo...');
        const { file: optimizedFile, dataUrl } = await compressImage(file);
        setImageFile(optimizedFile);
        setImagePreview(dataUrl);
        setImageFileName(file.name);
        executeScan(optimizedFile, dataUrl);
    };

    // Load Sample Gujarati Card
    const handleLoadSample = async () => {
        try {
            setImagePreview('/samples/morbi_depo.jpg');
            setImageFileName('morbi_depo.jpg');
            const res = await fetch('/samples/morbi_depo.jpg');
            const blob = await res.blob();
            const file = new File([blob], 'morbi_depo.jpg', { type: 'image/jpeg' });
            setImageFile(file);
            executeScan(file);
        } catch (err) {
            console.error('Error loading sample:', err);
            showToast('Failed to load sample card', 'error');
        }
    };

    // Reset scanner
    const handleReset = () => {
        setImagePreview(null);
        setImageFile(null);
        setImageFileName('');
        setCardData(null);
    };

    // Execute Multimodal Scan
    const executeScan = async (file, base64Url = null) => {
        setIsScanning(true);
        setCardData(null);
        setScanProgress('Uploading business card image...');

        const progressSteps = [
            'Detecting script orientation & text zones...',
            'De-warping decorative Gujarati typography...',
            'Extracting firm name & Roman transliteration...',
            'Parsing mobile numbers & postal PIN...',
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
            const result = await scanCard({ file, base64Url });
            clearInterval(interval);

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
    const handleSave = async () => {
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

            const result = await saveCard(payload);
            if (result.success) {
                showToast('Card saved successfully to database!', 'success');
                if (onCardSaved) onCardSaved(result.card);
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

    // Update form field
    const handleFieldChange = (field, value) => {
        setCardData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    return (
        <div className="space-y-8">
            {/* Behance Hero AI Visualizer Motif */}
            <div className="text-center pt-2">
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

                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-zinc-200/80 text-[11px] font-semibold text-zinc-700 mb-2 shadow-sm">
                    <Languages className="w-3.5 h-3.5 text-zinc-950" />
                    <span>Specialized Multimodal Gujarati, Hindi & Regional Script OCR</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 max-w-xl mx-auto">
                    Instant Visiting Card Intelligence
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 max-w-md mx-auto mt-1.5 font-normal">
                    Gemini Vision decodes complex Gujarati ligatures, extracts phone numbers, and provides dual-script English transliterations in real-time.
                </p>
            </div>

            {/* Scanner Workspace Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Image Dropzone & Controls (5 Cols) */}
                <div className="lg:col-span-5 space-y-4">
                    <CardUploadDropzone
                        imagePreview={imagePreview}
                        imageFileName={imageFileName}
                        isScanning={isScanning}
                        onFileSelected={handleFileSelected}
                        onLoadSample={handleLoadSample}
                        onReset={handleReset}
                    />

                    {/* Scanner Status Box */}
                    {isScanning && (
                        <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] text-center space-y-3">
                            <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin mx-auto"></div>
                            <div className="space-y-1">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                    Multimodal Vision OCR
                                </h4>
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
                        <div className="bg-white rounded-3xl p-6 shadow-behance border border-black/[0.04] space-y-5">
                            {/* Header: Dynamic Accuracy Badge & Controls */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100">
                                <div className="flex items-center gap-3">
                                    <AccuracyBadge score={cardData.accuracy_score} />
                                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                        {cardData.detected_language || 'Gujarati'}
                                    </span>
                                </div>

                                {/* Segmented View Switcher */}
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

                            {/* Accuracy Reason Bar */}
                            {cardData.accuracy_reason && (
                                <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-200/80 flex items-start gap-2.5 text-xs text-zinc-600">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold text-zinc-900">Analysis Breakdown: </span>
                                        <span>{cardData.accuracy_reason}</span>
                                    </div>
                                </div>
                            )}

                            {/* View Content */}
                            {activeTab === 'table' ? (
                                <CardFormEditor cardData={cardData} onChange={handleFieldChange} />
                            ) : (
                                <JsonViewer data={cardData} onCopy={() => showToast('JSON copied to clipboard')} />
                            )}

                            {/* Action Buttons */}
                            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                                <button
                                    onClick={handleSave}
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

                                {onNavigateToContacts && (
                                    <button
                                        onClick={onNavigateToContacts}
                                        className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <span>View Contacts</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
