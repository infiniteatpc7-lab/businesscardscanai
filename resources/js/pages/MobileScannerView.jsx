import React, { useState } from 'react';
import {
    ScanLine,
    Languages,
    FileText,
    Sparkles,
    Database,
    Copy,
    CheckCircle2,
    ArrowRight,
    MessageCircle,
    UserPlus,
    X,
    Camera,
    UploadCloud
} from 'lucide-react';
import CardUploadDropzone from '../components/scanner/CardUploadDropzone';
import CardFormEditor from '../components/scanner/CardFormEditor';
import JsonViewer from '../components/scanner/JsonViewer';
import { AccuracyBadge } from '../components/common/Badge';
import { scanCard, saveCard } from '../services/cardApi';
import { downloadVCard, openWhatsApp } from '../services/vcfHelper';
import { useImageProcessor } from '../hooks/useImageProcessor';
import { useToast } from '../context/ToastContext';

export default function MobileScannerView({
    onCardSaved,
    onNavigateToCards
}) {
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
        setScanProgress('Uploading business card...');

        const progressSteps = [
            'Detecting script orientation & text zones...',
            'De-warping decorative Gujarati calligraphy...',
            'Extracting firm name & Roman transliteration...',
            'Parsing mobile numbers & postal PIN...',
            'Evaluating dynamic accuracy rating...'
        ];

        let stepIndex = 0;
        const interval = setInterval(() => {
            if (stepIndex < progressSteps.length) {
                setScanProgress(progressSteps[stepIndex]);
                stepIndex++;
            }
        }, 1100);

        try {
            const result = await scanCard({ file, base64Url });
            clearInterval(interval);

            if (result.success && result.data) {
                setCardData(result.data);
                showToast('Card extracted successfully!', 'success');
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
                showToast('Card saved to business directory!', 'success');
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

    // Update field directly
    const handleFieldChange = (field, value) => {
        setCardData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    return (
        <div className="space-y-4 pb-24">
            {/* Capture Area */}
            <CardUploadDropzone
                imagePreview={imagePreview}
                imageFileName={imageFileName}
                isScanning={isScanning}
                onFileSelected={handleFileSelected}
                onLoadSample={handleLoadSample}
                onReset={handleReset}
            />

            {/* Scanning Status Box */}
            {isScanning && (
                <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] text-center space-y-2.5">
                    <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin mx-auto"></div>
                    <div className="space-y-0.5">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            CardScan Engine
                        </h4>
                        <p className="text-xs font-bold text-zinc-900">{scanProgress}</p>
                    </div>
                </div>
            )}

            {/* Extracted Data Bento Card */}
            {cardData && (
                <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-4">
                    {/* Header: Status & View Switcher */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Verified</span>
                            </div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                {cardData.detected_language || 'Gujarati'}
                            </span>
                        </div>

                        {/* Switcher */}
                        <div className="bg-zinc-100 p-0.5 rounded-xl flex items-center gap-1 border border-zinc-200/60 text-[11px] font-bold">
                            <button
                                onClick={() => setActiveTab('table')}
                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                    activeTab === 'table' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
                                }`}
                            >
                                Form
                            </button>
                            <button
                                onClick={() => setActiveTab('json')}
                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                    activeTab === 'json' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
                                }`}
                            >
                                JSON
                            </button>
                        </div>
                    </div>

                    {/* Content View */}
                    {activeTab === 'table' ? (
                        <CardFormEditor cardData={cardData} onChange={handleFieldChange} />
                    ) : (
                        <JsonViewer data={cardData} onCopy={() => showToast('JSON copied to clipboard')} />
                    )}

                    {/* Quick Direct Actions: Save to Phone, WhatsApp */}
                    {Array.isArray(cardData.phone) && cardData.phone.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                                onClick={() => {
                                    downloadVCard(cardData);
                                    showToast('vCard downloaded for phonebook');
                                }}
                                className="py-2.5 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Save to Phone</span>
                            </button>

                            <button
                                onClick={() => openWhatsApp(cardData.phone[0], cardData)}
                                className="py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                            </button>
                        </div>
                    )}

                    {/* Primary Commit Button */}
                    <div className="pt-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full py-3.5 px-5 rounded-2xl bg-black hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-pill active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <Database className="w-4 h-4 text-emerald-400" />
                            )}
                            <span>{isSaving ? 'Saving Card...' : 'Save Card to Business Directory'}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

