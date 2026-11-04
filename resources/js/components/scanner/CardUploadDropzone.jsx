import React, { useRef } from 'react';
import { UploadCloud, Camera, Sparkles, RefreshCw, ArrowRight, RotateCcw, Download } from 'lucide-react';

export default function CardUploadDropzone({
    imagePreview,
    imageFileName,
    isScanning,
    scanError,
    onFileSelected,
    onLoadSample,
    onReset,
    onRetry
}) {
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const [previewFailed, setPreviewFailed] = React.useState(false);

    React.useEffect(() => {
        setPreviewFailed(false);
    }, [imagePreview]);

    const handleDownload = (e) => {
        if (!imagePreview || isScanning) return;
        const link = document.createElement('a');
        link.href = imagePreview;
        link.download = imageFileName || 'card_photo.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleInput = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileSelected(file);
            // Reset input value so same file can be re-selected if needed
            e.target.value = '';
        }
    };

    return (
        <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] transition-all">
            <div className="flex items-center justify-between mb-3.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Card Source</span>
                {imagePreview && (
                    <button
                        onClick={onReset}
                        disabled={isScanning}
                        className="text-xs font-semibold text-zinc-500 hover:text-black disabled:opacity-40 flex items-center gap-1 transition-colors"
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
                    className="border-2 border-dashed border-zinc-200 hover:border-zinc-400 bg-zinc-50/60 hover:bg-zinc-50 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all group"
                >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 rounded-2xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <UploadCloud className="w-6 h-6 sm:w-7 sm:h-7 text-zinc-600" />
                    </div>
                    <h4 className="text-sm font-bold text-zinc-900 mb-1">Upload Card Image</h4>
                    <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                        Drag & drop or tap to browse JPG, PNG, WebP, HEIC, AVIF, BMP up to 16MB
                    </p>
                </div>
            ) : (
                <div
                    onClick={handleDownload}
                    className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 shadow-inner cursor-pointer select-none active:scale-[0.99] transition-transform min-h-[180px] flex items-center justify-center"
                    title="Tap to download card image"
                >
                    {!previewFailed ? (
                        <img
                            src={imagePreview}
                            alt="Card Preview"
                            onError={() => setPreviewFailed(true)}
                            className="w-full h-auto max-h-[300px] sm:max-h-[340px] object-contain mx-auto"
                        />
                    ) : (
                        <div className="py-12 px-6 text-center text-zinc-300 space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-emerald-400">
                                <Camera className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-bold text-white truncate max-w-xs mx-auto">
                                {imageFileName || 'High-Efficiency Photo'}
                            </p>
                            <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {imageFileName?.toLowerCase()?.endsWith('.heic') || imageFileName?.toLowerCase()?.endsWith('.heif') ? 'HEIC Image Ready' : 'Image Ready for AI Processing'}
                            </span>
                        </div>
                    )}

                    {/* Scanning Laser Line Animation */}
                    {isScanning && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10B981] animate-[bounce_2s_infinite]"></div>
                            <div className="absolute inset-0 bg-emerald-500/10"></div>
                        </div>
                    )}

                    {/* Overlay Tag with Download Hint */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-white/90 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl">
                        <span className="truncate max-w-[170px] sm:max-w-[200px]">{imageFileName || 'business_card.jpg'}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {!isScanning && (
                                <span className="flex items-center gap-1 text-[10px] text-zinc-300 font-sans font-bold bg-white/10 px-2 py-0.5 rounded-md">
                                    <Download className="w-3 h-3 text-emerald-400" />
                                    <span>Download</span>
                                </span>
                            )}
                            <span className={isScanning ? 'text-emerald-400 font-semibold' : scanError ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                                {isScanning ? 'Scanning...' : scanError ? 'Failed' : 'Ready'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Error & Retry Notice if scan encountered an issue */}
            {scanError && !isScanning && (
                <div className="mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-between gap-2">
                    <span className="text-xs text-rose-800 font-semibold truncate">{scanError}</span>
                    <button
                        onClick={onRetry}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 flex items-center gap-1 active:scale-95 transition-all"
                    >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                    </button>
                </div>
            )}

            {/* Hidden Inputs */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.avif,.bmp,.tiff"
                onChange={handleInput}
                className="hidden"
            />
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.avif,.bmp,.tiff"
                capture="environment"
                onChange={handleInput}
                className="hidden"
            />

            {/* Capture Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 mt-4">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-900 text-xs font-bold transition-all active:scale-95"
                >
                    <UploadCloud className="w-4 h-4 text-zinc-700" />
                    <span>Select File</span>
                </button>
                <button
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isScanning}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-900 text-xs font-bold transition-all active:scale-95"
                >
                    <Camera className="w-4 h-4 text-zinc-700" />
                    <span>Capture Camera</span>
                </button>
            </div>

            {/* Sample Card Trigger */}
            {!imagePreview && (
                <div className="mt-3 pt-3 border-t border-zinc-100 text-center">
                    <button
                        onClick={onLoadSample}
                        disabled={isScanning}
                        className="text-xs text-zinc-600 hover:text-black font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-40"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Load Sample Gujarati Card (મોરબી ડેપો)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}
