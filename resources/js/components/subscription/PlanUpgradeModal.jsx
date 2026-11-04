import React from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Sparkles,
    Check,
    MessageCircle,
    PhoneCall,
    ArrowRight,
    FileSpreadsheet,
    Zap,
    Layers,
    Shield,
    Lock
} from 'lucide-react';

export default function PlanUpgradeModal({
    isOpen,
    onClose,
    reason = 'on_load', // 'on_load' | 'feature_locked' | 'quota_exceeded'
    featureKey = null,
    featureName = null,
    message = null,
    workspace = null,
    onOpenFullDashboard
}) {
    if (!isOpen) return null;

    const workspaceName = workspace?.name || 'My Workspace';
    const currentPlanName = workspace?.plan_name || 'Free';

    // Map featureKey to human-readable titles and icons
    const featureMetadata = {
        export_csv: {
            title: 'Export to CSV & Excel',
            icon: FileSpreadsheet,
            description: 'Download your contacts into clean CSV and Excel files for your CRM and team follow-ups.',
            whatsappText: `Hello! I would like to upgrade my workspace "${workspaceName}" to Pro to unlock CSV and Excel contact export.`
        },
        export_excel: {
            title: 'Excel Workbook Export',
            icon: FileSpreadsheet,
            description: 'Export structured spreadsheets compatible with Microsoft Excel and Google Sheets.',
            whatsappText: `Hello! I would like to upgrade my workspace "${workspaceName}" to Pro to unlock Excel export.`
        },
        bulk_import: {
            title: 'Bulk Multi-Card Import',
            icon: Layers,
            description: 'Upload up to 50 business card photos at once and let our batch processor extract all contacts automatically.',
            whatsappText: `Hello! I would like to upgrade my workspace "${workspaceName}" to Pro to unlock Bulk Multi-Card Import.`
        },
        reverse_card_scan: {
            title: 'Back-of-Card Capture',
            icon: Layers,
            description: 'Capture the reverse side of business cards to preserve handwritten booth notes and price lists.',
            whatsappText: `Hello! I would like to upgrade my workspace "${workspaceName}" to Pro to unlock reverse-card capture.`
        },
        quota_exceeded: {
            title: 'Monthly Scan Limit Reached (5/5)',
            icon: Zap,
            description: 'You have used all 5 free card scans for this cycle. Upgrade to Pro for 500 scans/month and never pause scanning at the expo booth.',
            whatsappText: `Hello! I have reached my 5-card free limit on workspace "${workspaceName}" and would like to upgrade to Pro for 500 scans.`
        },
        on_load: {
            title: 'Upgrade to BusinessCardScan Pro',
            icon: Sparkles,
            description: 'Get 500 card scans every month, CSV/Excel directory export, and bulk multi-photo scanning.',
            whatsappText: `Hello! I would like to upgrade my workspace "${workspaceName}" from Free to the Pro plan.`
        }
    };

    const resolvedMeta = (reason === 'quota_exceeded')
        ? featureMetadata.quota_exceeded
        : (featureKey && featureMetadata[featureKey])
        ? featureMetadata[featureKey]
        : (reason === 'on_load')
        ? featureMetadata.on_load
        : {
            title: featureName ? `Unlock ${featureName}` : 'Premium Feature',
            icon: Lock,
            description: message || 'This feature is available on Pro and Business subscription plans.',
            whatsappText: `Hello! I would like to upgrade my workspace "${workspaceName}" to unlock ${featureName || 'premium features'}.`
        };

    const Icon = resolvedMeta.icon;
    const whatsappUrl = `https://wa.me/919727509762?text=${encodeURIComponent(resolvedMeta.whatsappText)}`;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            {/* Backdrop Dismiss */}
            <div className="fixed inset-0 -z-10" onClick={onClose} />

            {/* Modal Card - Clean Native Mobile Sheet */}
            <div className="relative bg-white rounded-t-[32px] sm:rounded-3xl w-full max-w-md shadow-2xl z-10 max-h-[92vh] flex flex-col overflow-hidden animate-tab-fade border border-black/[0.04]">
                
                {/* Mobile Drag Indicator */}
                <div
                    onClick={onClose}
                    className="w-10 h-1 bg-zinc-300 rounded-full mx-auto sm:hidden mt-3 cursor-pointer shrink-0"
                />

                {/* Top Close Button */}
                <div className="flex items-center justify-between p-5 pb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                        {currentPlanName} Plan
                    </span>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition-colors active:scale-95"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 pt-1 space-y-4 overflow-y-auto">
                    {/* Header Icon & Title */}
                    <div className="text-center space-y-2 pt-1">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-white flex items-center justify-center mx-auto shadow-md">
                            <Icon className="w-7 h-7 text-amber-400" />
                        </div>
                        <h3 className="text-lg font-extrabold text-zinc-950 tracking-tight leading-snug">
                            {resolvedMeta.title}
                        </h3>
                        <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-sm mx-auto">
                            {resolvedMeta.description}
                        </p>
                    </div>

                    {/* Pro Plan Value Card */}
                    <div className="p-4 rounded-3xl bg-zinc-50 border border-zinc-200/80 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
                            <div>
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
                                    Recommended
                                </span>
                                <h4 className="text-base font-extrabold text-zinc-950">
                                    Growth Pro Plan
                                </h4>
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-black text-zinc-950">₹999</span>
                                <span className="text-[10px] text-zinc-500 block">/ month</span>
                            </div>
                        </div>

                        {/* Feature Checklist */}
                        <div className="space-y-2 text-xs text-zinc-700">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                                <span className="font-semibold text-zinc-900">500 monthly business card scans</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                                <span>CSV & Excel Directory Export</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                                <span>Bulk Multi-Card Photo Import</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                                <span>Gujarati, Hindi & English High-Accuracy OCR</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                                <span>Priority WhatsApp Support</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-1">
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                        >
                            <MessageCircle className="w-4 h-4" />
                            <span>Upgrade to Pro via WhatsApp</span>
                        </a>

                        <div className="grid grid-cols-2 gap-2">
                            <a
                                href="tel:+919727509762"
                                className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>Call Sales</span>
                            </a>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onOpenFullDashboard?.();
                                }}
                                className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <span>View All Plans</span>
                                <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                    </div>

                    {/* Dismiss Link */}
                    <div className="text-center pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-xs font-semibold text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            Continue on Free Plan
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
