import React, { useState, useEffect, useRef } from 'react';
import {
    UploadCloud,
    Camera,
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    X,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Layers,
    Calendar,
    Save,
    RotateCcw,
    ImagePlus,
    FileText,
    ExternalLink
} from 'lucide-react';
import CardFormEditor from './CardFormEditor';
import {
    createBulkImport,
    uploadBulkItem,
    uploadBulkItemBackImage,
    processBulkImport,
    processBulkImportNext,
    fetchBulkProgress,
    fetchBulkItems,
    updateBulkItem,
    retryBulkItem,
    commitBulkImport,
    cancelBulkImport
} from '../../services/cardApi';
import { useImageProcessor } from '../../hooks/useImageProcessor';
import { useToast } from '../../context/ToastContext';

export default function BulkImportView({
    currentExhibition,
    onOpenExhibitionSelector,
    onNavigateToCards,
    onBatchSaved
}) {
    const { showToast } = useToast();
    const { compressImage } = useImageProcessor();
    const fileInputRef = useRef(null);

    // Pipeline phases: 'pick' | 'uploading' | 'processing' | 'review' | 'saving' | 'completed'
    const [phase, setPhase] = useState('pick');
    const [selectedPhotos, setSelectedPhotos] = useState([]); // array of { id, file, dataUrl, backFile, backDataUrl }
    const [activeBatch, setActiveBatch] = useState(null);
    const [isOptimizingPhotos, setIsOptimizingPhotos] = useState(false);
    const [optimizingProgress, setOptimizingProgress] = useState({ current: 0, total: 0 });

    // Progress stats
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [processingStats, setProcessingStats] = useState({
        total: 0,
        processed: 0,
        pending: 0,
        extracting: 0,
        extracted: 0,
        duplicate: 0,
        failed: 0
    });

    // Review stage state
    const [reviewFilter, setReviewFilter] = useState('all'); // 'all' | 'ready' | 'duplicate' | 'failed'
    const [items, setItems] = useState([]);
    const [editingItemIndex, setEditingItemIndex] = useState(null);
    const [editFormData, setEditFormData] = useState(null);
    const [isSavingChanges, setIsSavingChanges] = useState(false);

    // Saving stage progress
    const [commitProgress, setCommitProgress] = useState({ saved: 0, total: 0, results: [] });

    // Handle initial multi-file selection from gallery
    const handlePhotosSelected = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsOptimizingPhotos(true);
        setOptimizingProgress({ current: 0, total: files.length });

        const processed = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setOptimizingProgress({ current: i + 1, total: files.length });
            try {
                const { file: optFile, dataUrl } = await compressImage(file);
                const safeName = (file && typeof file.name === 'string' && file.name)
                    ? file.name
                    : `card_${Date.now()}_${i + 1}.jpg`;
                processed.push({
                    clientItemId: `photo_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
                    file: optFile || file,
                    dataUrl: dataUrl,
                    backFile: null,
                    backDataUrl: null,
                    name: safeName
                });
            } catch (err) {
                console.error('Photo optimization error:', err);
                processed.push({
                    clientItemId: `photo_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
                    file: file,
                    dataUrl: null,
                    backFile: null,
                    backDataUrl: null,
                    name: (file && file.name) ? file.name : `card_${Date.now()}_${i + 1}.jpg`
                });
            }
        }

        setSelectedPhotos((prev) => [...prev, ...processed]);
        setIsOptimizingPhotos(false);
        e.target.value = '';
    };

    // Remove photo from pre-upload staging
    const handleRemoveSelectedPhoto = (clientItemId) => {
        setSelectedPhotos((prev) => prev.filter((p) => p.clientItemId !== clientItemId));
    };

    // Attach optional back image to pre-upload photo
    const handleAttachBackPhoto = async (clientItemId, e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const { file: optFile, dataUrl } = await compressImage(file);
            setSelectedPhotos((prev) =>
                prev.map((p) => (p.clientItemId === clientItemId ? { ...p, backFile: optFile, backDataUrl: dataUrl } : p))
            );
            showToast('Back photo attached', 'success');
        } catch (err) {
            console.error('Back image error:', err);
        }
        e.target.value = '';
    };

    // Start concurrent upload of selected photos
    const handleStartUpload = async () => {
        if (!currentExhibition) {
            showToast('Please select an active exhibition first', 'warning');
            onOpenExhibitionSelector?.();
            return;
        }

        if (selectedPhotos.length === 0) {
            showToast('Please select at least 1 photo to import', 'warning');
            return;
        }

        setPhase('uploading');
        setUploadProgress({ current: 0, total: selectedPhotos.length });

        try {
            // Step 1: Initialize batch
            const initRes = await createBulkImport({
                exhibitionId: currentExhibition.id,
                expectedCount: selectedPhotos.length
            });

            if (!initRes.success || !initRes.batch) {
                showToast(initRes.message || 'Failed to initialize bulk import', 'error');
                setPhase('pick');
                return;
            }

            const batch = initRes.batch;
            setActiveBatch(batch);

            // Step 2: Upload images concurrently (3-5 at a time)
            const concurrency = 4;
            let currentIndex = 0;
            let uploadedCount = 0;

            const uploadWorker = async () => {
                while (currentIndex < selectedPhotos.length) {
                    const idx = currentIndex++;
                    const photo = selectedPhotos[idx];

                    try {
                        const itemRes = await uploadBulkItem(batch.batch_uuid, {
                            clientItemId: photo.clientItemId,
                            sequenceOrder: idx + 1,
                            file: photo.file
                        });

                        if (itemRes.success && itemRes.item && photo.backFile) {
                            await uploadBulkItemBackImage(batch.batch_uuid, itemRes.item.id, {
                                file: photo.backFile
                            });
                        }

                        uploadedCount++;
                        setUploadProgress({ current: uploadedCount, total: selectedPhotos.length });
                    } catch (uploadErr) {
                        console.error('Upload failed for item:', photo.name, uploadErr);
                    }
                }
            };

            const workers = Array.from({ length: Math.min(concurrency, selectedPhotos.length) }, () => uploadWorker());
            await Promise.all(workers);

            // Step 3: Trigger background AI extraction
            setPhase('processing');
            await processBulkImport(batch.batch_uuid);
        } catch (err) {
            console.error('Batch setup error:', err);
            showToast('Error setting up bulk import', 'error');
            setPhase('pick');
        }
    };

    // Polling and processing runner during background processing
    const isStepProcessingRef = useRef(false);

    useEffect(() => {
        let timer = null;
        let isCancelled = false;

        if (phase === 'processing' && activeBatch) {
            // Load initial items so card list appears immediately
            fetchBulkItems(activeBatch.batch_uuid, 'all')
                .then((res) => {
                    if (!isCancelled && res.success && Array.isArray(res.items)) {
                        setItems(res.items);
                    }
                })
                .catch(console.error);

            const pollAndDrive = async () => {
                if (isCancelled) return;

                try {
                    const res = await fetchBulkProgress(activeBatch.batch_uuid);
                    if (res.success && res.batch) {
                        const b = res.batch;
                        setProcessingStats({
                            total: b.total_items,
                            processed: b.processed_items,
                            pending: b.pending_items ?? 0,
                            extracting: b.extracting_items ?? 0,
                            extracted: b.extracted_items ?? 0,
                            duplicate: b.duplicate_items ?? 0,
                            failed: b.failed_items ?? 0
                        });

                        // Refresh item states so thumbnails and labels update in real time
                        const itemsRes = await fetchBulkItems(activeBatch.batch_uuid, 'all');
                        if (!isCancelled && itemsRes.success && Array.isArray(itemsRes.items)) {
                            setItems(itemsRes.items);
                        }

                        // Check completion
                        const pendingCount = b.pending_items ?? 0;
                        const extractingCount = b.extracting_items ?? 0;
                        if (
                            b.status === 'ready_for_review' ||
                            (b.total_items > 0 && pendingCount === 0 && extractingCount === 0)
                        ) {
                            loadReviewItems(activeBatch.batch_uuid);
                            return;
                        }

                        // Seamless worker driver: If queue worker is not running in local dev,
                        // trigger processBulkImportNext so the user NEVER gets stuck!
                        if (pendingCount > 0 && !isStepProcessingRef.current) {
                            isStepProcessingRef.current = true;
                            processBulkImportNext(activeBatch.batch_uuid)
                                .catch(console.error)
                                .finally(() => {
                                    isStepProcessingRef.current = false;
                                });
                        }
                    }
                } catch (e) {
                    console.error('Progress poll error:', e);
                }

                if (!isCancelled) {
                    timer = setTimeout(pollAndDrive, 1500);
                }
            };

            timer = setTimeout(pollAndDrive, 600);
        }

        return () => {
            isCancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [phase, activeBatch?.batch_uuid]);

    // Load review items
    const loadReviewItems = async (batchUuid) => {
        try {
            const res = await fetchBulkItems(batchUuid, 'all');
            if (res.success && Array.isArray(res.items)) {
                setItems(res.items);
                setPhase('review');
            }
        } catch (err) {
            console.error('Error loading review items:', err);
            showToast('Failed to load extracted cards', 'error');
        }
    };

    // Filter items in review
    const filteredItems = items.filter((item) => {
        if (reviewFilter === 'ready') return item.status === 'extracted';
        if (reviewFilter === 'duplicate') return item.status === 'duplicate_detected';
        if (reviewFilter === 'failed') return item.status === 'failed';
        return true;
    });

    // Open item editor modal
    const handleOpenEditItem = (indexInFiltered) => {
        const item = filteredItems[indexInFiltered];
        if (!item) return;

        setEditingItemIndex(indexInFiltered);
        setEditFormData({
            company: item.extracted_data?.company || '',
            company_english: item.extracted_data?.company_english || '',
            name: item.extracted_data?.name || '',
            name_english: item.extracted_data?.name_english || '',
            designation: item.extracted_data?.designation || '',
            department: item.extracted_data?.department || '',
            phone: Array.isArray(item.extracted_data?.phone) ? [...item.extracted_data.phone] : (item.extracted_data?.phone ? [item.extracted_data.phone] : []),
            email: item.extracted_data?.email || '',
            website: item.extracted_data?.website || '',
            address: item.extracted_data?.address || '',
            address_english: item.extracted_data?.address_english || '',
            tagline_services: item.extracted_data?.tagline_services || '',
            tax_id: item.extracted_data?.tax_id || '',
            social_profiles: Array.isArray(item.extracted_data?.social_profiles) ? [...item.extracted_data.social_profiles] : [],
            decision: item.decision || (item.status === 'duplicate_detected' ? 'link_existing' : 'create_new'),
            matched_card_id: item.matched_card_id || null,
        });
    };

    // Save in-place edits to item
    const handleSaveItemEdit = async () => {
        if (editingItemIndex === null || !editFormData || !activeBatch) return;
        const currentItem = filteredItems[editingItemIndex];
        setIsSavingChanges(true);

        try {
            const res = await updateBulkItem(activeBatch.batch_uuid, currentItem.id, {
                decision: editFormData.decision,
                matched_card_id: editFormData.matched_card_id,
                extracted_data: editFormData
            });

            if (res.success && res.item) {
                setItems((prev) => prev.map((it) => (it.id === currentItem.id ? res.item : it)));
                showToast('Card details updated', 'success');
                setEditingItemIndex(null);
            }
        } catch (err) {
            console.error('Update item error:', err);
            showToast('Failed to save changes', 'error');
        } finally {
            setIsSavingChanges(false);
        }
    };

    // Retry failed OCR item
    const handleRetryItem = async (itemId) => {
        if (!activeBatch) return;
        try {
            const res = await retryBulkItem(activeBatch.batch_uuid, itemId);
            if (res.success) {
                showToast('Card re-queued for extraction', 'info');
                setItems((prev) =>
                    prev.map((it) => (it.id === itemId ? { ...it, status: 'pending', error_message: null } : it))
                );
            }
        } catch (err) {
            console.error('Retry error:', err);
        }
    };

    // Commit and save all reviewed items incrementally
    const handleCommitBatch = async () => {
        if (!activeBatch) return;

        const itemsToSave = items.filter((it) => it.status !== 'saved');
        if (itemsToSave.length === 0) {
            showToast('No cards to save', 'info');
            return;
        }

        setPhase('saving');
        setCommitProgress({ saved: 0, total: itemsToSave.length, results: [] });

        const payloadItems = itemsToSave.map((it) => ({
            id: it.id,
            decision: it.decision || (it.status === 'duplicate_detected' ? 'link_existing' : 'create_new'),
            matched_card_id: it.matched_card_id || null,
            scan_notes: `Bulk import ${activeBatch.batch_uuid.substring(0, 8)}`,
        }));

        try {
            const res = await commitBulkImport(activeBatch.batch_uuid, payloadItems);
            if (res.success) {
                const savedCount = (res.results || []).filter((r) => r.status === 'saved').length;
                showToast(`Successfully saved ${savedCount} cards to directory!`, 'success');
                onBatchSaved?.();
                setPhase('completed');
            } else {
                showToast(res.message || 'Error committing cards', 'error');
                setPhase('review');
            }
        } catch (err) {
            console.error('Commit error:', err);
            showToast('Network error during commit', 'error');
            setPhase('review');
        }
    };

    // Cancel batch
    const handleCancelBatch = async () => {
        if (activeBatch) {
            try {
                await cancelBulkImport(activeBatch.batch_uuid);
            } catch (e) {
                console.error('Cancel error:', e);
            }
        }
        setPhase('pick');
        setSelectedPhotos([]);
        setActiveBatch(null);
        setItems([]);
        showToast('Bulk import cancelled', 'info');
    };

    return (
        <div className="space-y-4">
            {/* Active Exhibition Info Banner */}
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
                            type="button"
                            onClick={onOpenExhibitionSelector}
                            className="px-2.5 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-bold transition-colors"
                        >
                            Change
                        </button>
                    )}
                </div>
            )}

            {/* PHASE 1: PHOTO SELECTION & PRE-UPLOAD STAGING */}
            {phase === 'pick' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                Gallery Multiple Photo Import
                            </span>
                            <span className="text-[11px] font-bold text-indigo-600">
                                {selectedPhotos.length} Photos Selected
                            </span>
                        </div>

                        {/* Preparing / Optimizing Photos Indicator */}
                        {isOptimizingPhotos && (
                            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center gap-3">
                                <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-indigo-950">Preparing card photos from gallery...</p>
                                    <p className="text-[11px] text-indigo-600">
                                        Processing photo {optimizingProgress.current} of {optimizingProgress.total}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Dropzone for Multi-Photo Picker */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-zinc-200 hover:border-zinc-400 bg-zinc-50/60 hover:bg-zinc-50 rounded-2xl p-6 text-center cursor-pointer transition-all group"
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotosSelected}
                            />
                            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center group-hover:scale-105 transition-transform text-zinc-600">
                                <UploadCloud className="w-6 h-6" />
                            </div>
                            <h4 className="text-sm font-bold text-zinc-900 mb-1">
                                Tap to select photos from gallery
                            </h4>
                            <p className="text-xs text-zinc-400">
                                Select 5, 20, 50, or up to 100+ business card photos at once
                            </p>
                        </div>

                        {/* Selected Photos Grid Preview */}
                        {selectedPhotos.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-zinc-100">
                                <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
                                    <span>Selected Cards Preview ({selectedPhotos.length})</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPhotos([])}
                                        className="text-[11px] text-red-500 hover:text-red-700 font-bold"
                                    >
                                        Clear All
                                    </button>
                                </div>

                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto p-1">
                                    {selectedPhotos.map((photo, idx) => (
                                        <div
                                            key={photo.clientItemId}
                                            className="relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-900 aspect-[3/2] group"
                                        >
                                            <img
                                                src={photo.dataUrl}
                                                alt={`Card ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[9px] font-mono font-bold">
                                                #{idx + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSelectedPhoto(photo.clientItemId)}
                                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-sm"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>

                                            {/* Attach Back Photo Button */}
                                            <label className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-white/90 text-zinc-900 text-[8px] font-bold cursor-pointer hover:bg-white flex items-center gap-0.5">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleAttachBackPhoto(photo.clientItemId, e)}
                                                />
                                                {photo.backFile ? '✓ Back' : '+ Back'}
                                            </label>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleStartUpload}
                                    className="w-full mt-3 py-3 rounded-2xl bg-black text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                                >
                                    <Sparkles className="w-4 h-4 text-emerald-400" />
                                    <span>Upload & Process {selectedPhotos.length} Cards with AI</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PHASE 2: CONCURRENT UPLOAD PROGRESS */}
            {phase === 'uploading' && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 text-center shadow-behance border border-black/[0.04] space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-600 animate-pulse">
                        <UploadCloud className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-sm font-bold text-zinc-950">Uploading Photos to Staging</h3>
                        <p className="text-xs text-zinc-500">
                            Uploaded {uploadProgress.current} of {uploadProgress.total} card images ({uploadProgress.total > 0 ? Math.round((uploadProgress.current / uploadProgress.total) * 100) : 0}%)
                        </p>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden p-0.5">
                        <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-300 shadow-sm"
                            style={{
                                width: `${uploadProgress.total > 0 ? Math.min(100, Math.round((uploadProgress.current / uploadProgress.total) * 100)) : 0}%`
                            }}
                        />
                    </div>
                </div>
            )}

            {/* PHASE 3: LIVE AI OCR PROCESSING PROGRESS & CARDS BREAKDOWN */}
            {phase === 'processing' && (
                <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-behance border border-black/[0.04] space-y-4">
                    {/* Header with Live animation */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                                <Sparkles className="w-5 h-5 animate-spin" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                                    <span>Scanning with Gemini AI</span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 animate-pulse">
                                        LIVE
                                    </span>
                                </h3>
                                <p className="text-xs text-zinc-500 truncate">
                                    Processed {processingStats.processed + processingStats.failed} of {processingStats.total} cards
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleCancelBatch}
                            className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-600 text-xs font-bold transition-colors shrink-0"
                        >
                            Cancel
                        </button>
                    </div>

                    {/* Accurate Real-time Progress Bar */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-zinc-600">Scan Progress</span>
                            <span className="text-emerald-600 font-mono">
                                {processingStats.total > 0
                                    ? Math.round(((processingStats.processed + processingStats.failed) / processingStats.total) * 100)
                                    : 0}%
                            </span>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden p-0.5">
                            <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500 shadow-sm"
                                style={{
                                    width: `${processingStats.total > 0
                                        ? Math.min(100, Math.round(((processingStats.processed + processingStats.failed) / processingStats.total) * 100))
                                        : 0}%`
                                }}
                            />
                        </div>
                    </div>

                    {/* Status Breakdown Badges: Scanned, Pending, Duplicates, Failed */}
                    <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                        <div className="p-2.5 rounded-2xl bg-emerald-50/80 border border-emerald-100">
                            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Scanned</span>
                            <span className="text-base font-black text-emerald-950">{processingStats.extracted || 0}</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-amber-50/80 border border-amber-100">
                            <span className="text-[10px] uppercase font-bold text-amber-600 block">Pending</span>
                            <span className="text-base font-black text-amber-950">{processingStats.pending || 0}</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-purple-50/80 border border-purple-100">
                            <span className="text-[10px] uppercase font-bold text-purple-600 block">Duplicate</span>
                            <span className="text-base font-black text-purple-950">{processingStats.duplicate || 0}</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-rose-50/80 border border-rose-100">
                            <span className="text-[10px] uppercase font-bold text-rose-600 block">Failed</span>
                            <span className="text-base font-black text-rose-950">{processingStats.failed || 0}</span>
                        </div>
                    </div>

                    {/* Live Cards Progress Grid */}
                    {items.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-zinc-100">
                            <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
                                <span>Batch Cards Status</span>
                                <span>{items.length} Cards</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1">
                                {items.map((item, idx) => {
                                    const isDone = item.status === 'extracted' || item.status === 'ready';
                                    const isDup = item.status === 'duplicate_detected';
                                    const isFail = item.status === 'failed';
                                    const isCur = item.status === 'extracting';
                                    const parsed = item.parsed_data || {};

                                    return (
                                        <div
                                            key={item.id}
                                            className={`p-2.5 rounded-2xl border transition-all flex flex-col justify-between ${
                                                isDone
                                                    ? 'bg-emerald-50/50 border-emerald-200'
                                                    : isDup
                                                    ? 'bg-purple-50/50 border-purple-200'
                                                    : isFail
                                                    ? 'bg-rose-50/50 border-rose-200'
                                                    : isCur
                                                    ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-400/20'
                                                    : 'bg-zinc-50 border-zinc-200'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[10px] font-mono font-bold text-zinc-400">
                                                    #{idx + 1}
                                                </span>
                                                <span
                                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                                        isDone
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : isDup
                                                            ? 'bg-purple-100 text-purple-800'
                                                            : isFail
                                                            ? 'bg-rose-100 text-rose-800'
                                                            : isCur
                                                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                                                            : 'bg-zinc-200 text-zinc-600'
                                                    }`}
                                                >
                                                    {isDone ? '✓ Scanned' : isDup ? 'Duplicate' : isFail ? 'Failed' : isCur ? 'Scanning...' : 'Pending'}
                                                </span>
                                            </div>

                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-zinc-950 truncate">
                                                    {parsed.name || (isCur ? 'Reading card...' : isDone ? 'Contact Extracted' : 'Card Photo')}
                                                </p>
                                                <p className="text-[10px] text-zinc-500 truncate">
                                                    {parsed.company || (isDone ? 'Company found' : isFail ? 'Unreadable card' : 'Waiting in queue')}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* PHASE 4: REVIEW GRID & IN-PLACE FORM EDITOR */}
            {phase === 'review' && (
                <div className="space-y-3">
                    {/* Header & Filter Chips */}
                    <div className="bg-white rounded-3xl p-4 shadow-behance border border-black/[0.04] space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-950">
                                Review Batch ({items.length} cards)
                            </span>
                            <button
                                type="button"
                                onClick={handleCommitBatch}
                                className="px-4 py-1.5 rounded-full bg-black text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
                            >
                                Save All Verified Cards
                            </button>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setReviewFilter('all')}
                                className={`px-3 py-1 rounded-xl transition-all ${
                                    reviewFilter === 'all' ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600'
                                }`}
                            >
                                All ({items.length})
                            </button>
                            <button
                                onClick={() => setReviewFilter('ready')}
                                className={`px-3 py-1 rounded-xl transition-all ${
                                    reviewFilter === 'ready' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'
                                }`}
                            >
                                Ready ({items.filter((i) => i.status === 'extracted').length})
                            </button>
                            <button
                                onClick={() => setReviewFilter('duplicate')}
                                className={`px-3 py-1 rounded-xl transition-all ${
                                    reviewFilter === 'duplicate' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'
                                }`}
                            >
                                Duplicate Matches ({items.filter((i) => i.status === 'duplicate_detected').length})
                            </button>
                            <button
                                onClick={() => setReviewFilter('failed')}
                                className={`px-3 py-1 rounded-xl transition-all ${
                                    reviewFilter === 'failed' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700'
                                }`}
                            >
                                Failed ({items.filter((i) => i.status === 'failed').length})
                            </button>
                        </div>
                    </div>

                    {/* Cards Grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                        {filteredItems.map((item, idx) => {
                            const isReady = item.status === 'extracted';
                            const isDup = item.status === 'duplicate_detected';
                            const isFailed = item.status === 'failed';

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => handleOpenEditItem(idx)}
                                    className="bg-white rounded-2xl p-2.5 border border-black/[0.06] shadow-xs cursor-pointer hover:border-black transition-all space-y-2 relative"
                                >
                                    <div className="relative aspect-[3/2] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-200">
                                        <img
                                            src={`/api/bulk-imports/${activeBatch?.batch_uuid}/items/${item.id}/image`}
                                            alt="Card"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                        {/* Status Badge */}
                                        <span
                                            className={`absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase ${
                                                isReady
                                                    ? 'bg-emerald-500 text-white'
                                                    : isDup
                                                    ? 'bg-amber-500 text-white'
                                                    : 'bg-red-500 text-white'
                                            }`}
                                        >
                                            {isReady ? 'Ready' : isDup ? 'Match' : 'Failed'}
                                        </span>
                                    </div>

                                    <div className="space-y-0.5">
                                        <h4 className="font-bold text-xs text-zinc-900 truncate">
                                            {item.extracted_data?.company || item.extracted_data?.name || 'Unidentified'}
                                        </h4>
                                        <p className="text-[10px] text-zinc-500 truncate">
                                            {item.extracted_data?.name || item.extracted_data?.phone?.[0] || 'Tap to edit'}
                                        </p>
                                    </div>

                                    {isFailed && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRetryItem(item.id);
                                            }}
                                            className="w-full py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-bold flex items-center justify-center gap-1"
                                        >
                                            <RefreshCw className="w-2.5 h-2.5" />
                                            <span>Retry OCR</span>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ITEM EDIT DRAWER / MODAL WITH PREV / NEXT NAVIGATION */}
            {editingItemIndex !== null && editFormData && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                Reviewing Card #{editingItemIndex + 1} of {filteredItems.length}
                            </span>
                            <button
                                onClick={() => setEditingItemIndex(null)}
                                className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Duplicate Decision Selector if match exists */}
                        {filteredItems[editingItemIndex]?.status === 'duplicate_detected' && (
                            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-2">
                                <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>Matching Contact Detected in Directory</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setEditFormData((prev) => ({ ...prev, decision: 'link_existing' }))}
                                        className={`flex-1 py-1.5 px-2 rounded-xl font-bold border transition-all ${
                                            editFormData.decision === 'link_existing'
                                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                                : 'bg-white text-zinc-700 border-zinc-200'
                                        }`}
                                    >
                                        Link to Existing Contact
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditFormData((prev) => ({ ...prev, decision: 'create_new' }))}
                                        className={`flex-1 py-1.5 px-2 rounded-xl font-bold border transition-all ${
                                            editFormData.decision === 'create_new'
                                                ? 'bg-black text-white border-black shadow-sm'
                                                : 'bg-white text-zinc-700 border-zinc-200'
                                        }`}
                                    >
                                        Create New Contact
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Card Form Editor */}
                        <CardFormEditor
                            cardData={editFormData}
                            onChange={(field, val) => setEditFormData((prev) => ({ ...prev, [field]: val }))}
                        />

                        {/* Bottom Actions: Prev / Next / Save Changes */}
                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-100">
                            <button
                                type="button"
                                disabled={editingItemIndex === 0}
                                onClick={() => handleOpenEditItem(editingItemIndex - 1)}
                                className="p-2 rounded-xl border border-zinc-200 text-zinc-600 disabled:opacity-30"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveItemEdit}
                                disabled={isSavingChanges}
                                className="flex-1 py-2.5 rounded-xl bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                                <Save className="w-3.5 h-3.5" />
                                <span>Save Changes</span>
                            </button>

                            <button
                                type="button"
                                disabled={editingItemIndex === filteredItems.length - 1}
                                onClick={() => handleOpenEditItem(editingItemIndex + 1)}
                                className="p-2 rounded-xl border border-zinc-200 text-zinc-600 disabled:opacity-30"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PHASE 5: COMPLETED BANNER */}
            {phase === 'completed' && (
                <div className="bg-white rounded-3xl p-8 text-center shadow-behance border border-black/[0.04] space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
                        <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-sm font-bold text-zinc-950">Bulk Import Complete!</h3>
                        <p className="text-xs text-zinc-500">
                            All cards have been saved to your directory and associated with {currentExhibition?.name}.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onNavigateToCards}
                        className="px-6 py-2.5 rounded-full bg-black text-white text-xs font-bold shadow-pill active:scale-95 transition-all"
                    >
                        View in Directory
                    </button>
                </div>
            )}
        </div>
    );
}
