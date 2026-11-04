import React, { useState, useRef, useEffect } from 'react';
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
    UploadCloud,
    Phone,
    Calendar,
    ChevronRight,
    ImagePlus
} from 'lucide-react';
import CardUploadDropzone from '../components/scanner/CardUploadDropzone';
import CardFormEditor from '../components/scanner/CardFormEditor';
import DuplicateWarningModal from '../components/scanner/DuplicateWarningModal';
import BulkImportView from '../components/scanner/BulkImportView';
import { scanCard, saveCard, uploadCardImage, releaseScanReservation } from '../services/cardApi';
import { downloadVCard, openWhatsApp, isLandlineNumber, initiatePhoneCall } from '../services/vcfHelper';
import { useImageProcessor } from '../hooks/useImageProcessor';
import { useToast } from '../context/ToastContext';

export default function MobileScannerView({
    onCardSaved,
    onNavigateToCards,
    currentExhibition,
    onOpenExhibitionSelector,
    workspace = null,
    quota = null,
    onQuotaRefresh = null,
}) {
    const { showToast } = useToast();
    const { compressImage } = useImageProcessor();

    const [scanMode, setScanMode] = useState('single'); // 'single' | 'bulk'
    const [isBulkIdle, setIsBulkIdle] = useState(true);

    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageFileName, setImageFileName] = useState('');

    // Optional Back Image of Card
    const [backImagePreview, setBackImagePreview] = useState(null);
    const [isUploadingBack, setIsUploadingBack] = useState(false);

    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState('');
    const [scanError, setScanError] = useState(null);
    const [cardData, setCardData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState(null);

    const cardDataRef = useRef(null);
    const isSavedRef = useRef(false);

    useEffect(() => {
        cardDataRef.current = cardData;
    }, [cardData]);

    // Cleanup: if review is abandoned by navigating away, release the reservation
    useEffect(() => {
        return () => {
            if (cardDataRef.current?.scan_idempotency_key && !isSavedRef.current) {
                releaseScanReservation(cardDataRef.current.scan_idempotency_key, 'abandoned_scan');
                if (onQuotaRefresh) onQuotaRefresh();
            }
        };
    }, []);

    // Handle File Selection
    const handleFileSelected = async (file) => {
        if (cardData?.scan_idempotency_key && !isSavedRef.current) {
            releaseScanReservation(cardData.scan_idempotency_key, 'replaced_file');
            if (onQuotaRefresh) onQuotaRefresh();
        }
        setIsScanning(true);
        setScanError(null);
        setScanProgress('Optimizing card photo...');
        const { file: optimizedFile, dataUrl } = await compressImage(file);
        setImageFile(optimizedFile);
        setImagePreview(dataUrl);
        setImageFileName(file.name);
        executeScan(optimizedFile, dataUrl);
    };

    // Handle Back Image Upload
    const handleBackImageSelected = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingBack(true);
        try {
            const { file: optimizedFile, dataUrl } = await compressImage(file);
            setBackImagePreview(dataUrl);
            const res = await uploadCardImage({ file: optimizedFile });
            if (res.success && res.image_path) {
                setCardData(prev => prev ? { ...prev, back_image_path: res.image_path } : prev);
                showToast('Card back photo attached!', 'success');
            }
        } catch (err) {
            console.error('Back image upload error:', err);
            showToast('Failed to attach card back', 'error');
        } finally {
            setIsUploadingBack(false);
        }
    };

    // Load Sample Gujarati Card
    const handleLoadSample = async () => {
        try {
            if (cardData?.scan_idempotency_key && !isSavedRef.current) {
                releaseScanReservation(cardData.scan_idempotency_key, 'load_sample');
                if (onQuotaRefresh) onQuotaRefresh();
            }
            setScanError(null);
            setImagePreview('/samples/morbi_depo.jpg');
            setImageFileName('morbi_depo.jpg');
            const res = await fetch('/samples/morbi_depo.jpg');
            const blob = await res.blob();
            const file = new File([blob], 'morbi_depo.jpg', { type: 'image/jpeg' });
            setImageFile(file);
            executeScan(file);
        } catch (err) {
            console.error('Error loading sample:', err);
            setScanError('Failed to load sample card');
            showToast('Failed to load sample card', 'error');
        }
    };

    // Reset scanner
    const handleReset = () => {
        if (cardData?.scan_idempotency_key && !isSavedRef.current) {
            releaseScanReservation(cardData.scan_idempotency_key, 'user_reset');
            if (onQuotaRefresh) onQuotaRefresh();
        }
        setImagePreview(null);
        setImageFile(null);
        setImageFileName('');
        setBackImagePreview(null);
        setCardData(null);
        setScanError(null);
        setDuplicateWarning(null);
        isSavedRef.current = false;
    };

    // Retry Scan with current file
    const handleRetry = () => {
        if (cardData?.scan_idempotency_key && !isSavedRef.current) {
            releaseScanReservation(cardData.scan_idempotency_key, 'retry_scan');
            if (onQuotaRefresh) onQuotaRefresh();
        }
        if (imageFile) {
            executeScan(imageFile, imagePreview);
        }
    };

    // Execute Multimodal Scan
    const executeScan = async (file, base64Url = null) => {
        // Pre-flight quota check: verify available credits BEFORE Gemini API call
        let currentQuota = quota;
        if (onQuotaRefresh) {
            const refreshed = await onQuotaRefresh();
            if (refreshed) currentQuota = refreshed;
        }

        if (currentQuota && !currentQuota.is_unlimited && currentQuota.remaining_credits <= 0) {
            setIsScanning(false);
            setScanProgress('');
            window.dispatchEvent(new CustomEvent('plan:upgrade_required', {
                detail: {
                    error_code: 'QUOTA_EXCEEDED',
                    message: `Monthly scan allowance of ${currentQuota.monthly_allowance || 5} credits exceeded for this workspace. Please upgrade your plan to continue scanning.`,
                    quota: currentQuota,
                }
            }));
            return;
        }

        setIsScanning(true);
        setCardData(null);
        setScanError(null);
        setDuplicateWarning(null);
        isSavedRef.current = false;
        setScanProgress('Uploading business card...');

        const progressSteps = [
            'Detecting script orientation & text zones...',
            'De-warping decorative Gujarati calligraphy...',
            'Extracting firm name & Roman transliteration...',
            'Parsing mobile numbers & postal PIN...',
            'Structuring contact directory fields...'
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
                isSavedRef.current = false;
                showToast('Card extracted successfully!', 'success');
                if (onQuotaRefresh) onQuotaRefresh();
            } else {
                const isPlanError = ['QUOTA_EXCEEDED', 'FEATURE_NOT_INCLUDED', 'PLAN_LIMIT_EXCEEDED'].includes(result?.error_code);
                const errMsg = result.message || 'Scan failed to extract card text. Check lighting & angle.';
                setScanError(errMsg);
                if (!isPlanError) {
                    showToast(errMsg, 'error');
                }
                if (onQuotaRefresh) onQuotaRefresh();
            }
        } catch (error) {
            clearInterval(interval);
            console.error('Scan error:', error);
            const errMsg = 'Scan connection interrupted. Tap Retry to try again.';
            setScanError(errMsg);
            showToast(errMsg, 'error');
            if (onQuotaRefresh) onQuotaRefresh();
        } finally {
            setIsScanning(false);
            setScanProgress('');
        }
    };

    // Save to Database with Exhibition Association & Duplicate Detection
    const handleSave = async (forceDuplicate = false, linkExistingCardId = null) => {
        if (!cardData || isSaving) return;
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
                back_image_path: cardData.back_image_path || null,
                raw_data: cardData,
                force_duplicate: forceDuplicate,
                exhibition_id: currentExhibition?.id || null,
                link_existing_card_id: linkExistingCardId,
                scan_idempotency_key: cardData.scan_idempotency_key || null,
            };

            const result = await saveCard(payload);

            if (result.success) {
                isSavedRef.current = true;
                setDuplicateWarning(null);
                const successMsg = result.linked
                    ? `Contact linked to ${currentExhibition?.name || 'exhibition'}!`
                    : result.duplicate_override
                    ? 'Card saved as separate contact!'
                    : `Card saved to ${currentExhibition?.name || 'directory'}!`;
                showToast(successMsg, 'success');
                if (onQuotaRefresh) onQuotaRefresh();
                if (onCardSaved) onCardSaved(result.card);
            } else if (result.duplicate || result.status === 409) {
                // Show Duplicate Warning Modal with existing matches & exhibition linking option
                setDuplicateWarning({
                    existingCards: result.existing_cards || [],
                    matchReason: result.match_reason || 'phone',
                    message: result.message,
                    already_in_exhibition: result.already_in_exhibition,
                    target_exhibition: result.target_exhibition,
                });
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

    const primaryPhone = cardData && Array.isArray(cardData.phone) && cardData.phone.length > 0
        ? cardData.phone[0]
        : (cardData && typeof cardData.phone === 'string' ? cardData.phone : null);
    const isLandline = isLandlineNumber(primaryPhone);

    return (
        <div className={`space-y-4 ${
            (!cardData && scanMode === 'single') || (scanMode === 'bulk' && isBulkIdle)
                ? 'flex-1 flex flex-col justify-center pb-12'
                : 'pb-24'
        }`}>
            {/* Scan Mode Switcher (Single vs Bulk Import) */}
            <div className="flex items-center p-1 bg-zinc-100 rounded-2xl">
                <button
                    type="button"
                    onClick={() => setScanMode('single')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        scanMode === 'single' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                >
                    Single Card
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const features = workspace?.features || [];
                        if (features.length > 0 && !features.includes('bulk_import')) {
                            window.dispatchEvent(new CustomEvent('plan:upgrade_required', {
                                detail: {
                                    error_code: 'FEATURE_NOT_INCLUDED',
                                    feature: 'bulk_import',
                                    message: 'Bulk multiple card batch import is included in the Pro and Business plans.'
                                }
                            }));
                            return;
                        }
                        setScanMode('bulk');
                    }}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        scanMode === 'bulk' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                >
                    Bulk Multiple Import
                </button>
            </div>

            {scanMode === 'bulk' ? (
                <BulkImportView
                    currentExhibition={currentExhibition}
                    onOpenExhibitionSelector={onOpenExhibitionSelector}
                    onNavigateToCards={onNavigateToCards}
                    onBatchSaved={() => onCardSaved?.(null)}
                    onIdleChange={setIsBulkIdle}
                />
            ) : (
                <>
                    {/* Active Exhibition Info Bar */}
                    {currentExhibition && (
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-black/[0.05] shadow-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Tagged Exhibition</span>
                                    <span className="text-xs font-bold text-zinc-950 truncate block">{currentExhibition.name}</span>
                                </div>
                            </div>
                            {onOpenExhibitionSelector && (
                                <button
                                    onClick={onOpenExhibitionSelector}
                                    className="px-2.5 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-bold active:scale-95 transition-all"
                                >
                                    Change
                                </button>
                            )}
                        </div>
                    )}

            {/* Capture Area */}
            <CardUploadDropzone
                imagePreview={imagePreview}
                imageFileName={imageFileName}
                isScanning={isScanning}
                scanError={scanError}
                onFileSelected={handleFileSelected}
                onLoadSample={handleLoadSample}
                onReset={handleReset}
                onRetry={handleRetry}
            />

            {/* Scanning Status Box */}
            {isScanning && (
                <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] text-center space-y-2.5">
                    <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin mx-auto"></div>
                    <div className="space-y-0.5">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Neural OCR Engine
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
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/60">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Extracted</span>
                            </div>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-wider">
                                {cardData.detected_language || 'Gujarati'}
                            </span>
                        </div>

                        <span className="text-[11px] text-zinc-400 font-medium">
                            Review & Edit
                        </span>
                    </div>

                    {/* Extracted Form Editor */}
                    <CardFormEditor cardData={cardData} onChange={handleFieldChange} />

                    {/* Card Back Photo Attachment */}
                    <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 shrink-0">
                                <ImagePlus className="w-4 h-4 text-zinc-600" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs font-bold text-zinc-900 block truncate">
                                    {cardData.back_image_path || backImagePreview ? 'Card Back Attached' : 'Card Back Photo (Optional)'}
                                </span>
                                <span className="text-[10px] text-zinc-500 block truncate">
                                    {cardData.back_image_path || backImagePreview ? 'Saved in individual scan history' : 'Capture product list, map or reverse notes'}
                                </span>
                            </div>
                        </div>

                        <label className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-800 text-[11px] font-bold cursor-pointer active:scale-95 transition-all shadow-2xs shrink-0">
                            {isUploadingBack ? 'Attaching...' : (cardData.back_image_path || backImagePreview ? 'Change' : '+ Add Back')}
                            <input
                                type="file"
                                accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.avif,.bmp,.tiff"
                                capture="environment"
                                onChange={handleBackImageSelected}
                                disabled={isUploadingBack}
                                className="hidden"
                            />
                        </label>
                    </div>

                    {/* Quick Direct Actions: Save to Phone, WhatsApp / Call */}
                    {primaryPhone && (
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

                            {isLandline ? (
                                <button
                                    onClick={() => initiatePhoneCall(primaryPhone)}
                                    className="py-2.5 px-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>Call Office</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => openWhatsApp(primaryPhone, cardData)}
                                    className="py-2.5 px-3 rounded-2xl bg-[#0F9D58] hover:bg-[#0b8043] text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>WhatsApp</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Primary Commit Button */}
                    <div className="pt-2">
                        <button
                            onClick={() => handleSave(false)}
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
            </>
            )}

            {/* Duplicate Warning Modal */}
            <DuplicateWarningModal
                isOpen={Boolean(duplicateWarning)}
                duplicateData={duplicateWarning}
                onClose={() => setDuplicateWarning(null)}
                onForceSave={() => handleSave(true)}
                onLinkExisting={(existingCardId) => handleSave(false, existingCardId)}
                onViewExisting={(existingCard) => {
                    setDuplicateWarning(null);
                    onNavigateToCards?.(existingCard);
                }}
                isSaving={isSaving}
            />
        </div>
    );
}
