import React, { useState, useRef } from 'react';
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
    Lock,
    ChevronLeft,
    ChevronRight,
    Building2,
    Users,
    Calendar
} from 'lucide-react';

const UPGRADE_PLANS = [
    {
        id: 'pro',
        name: 'Growth Pro Plan',
        badge: 'Recommended',
        badgeColor: 'text-amber-700 bg-amber-50 border border-amber-200/80',
        price: '₹999',
        interval: '/ month',
        scans: '500 monthly business card scans',
        features: [
            '500 monthly business card scans',
            'CSV & Excel Directory Export',
            'Bulk Multi-Card Photo Import',
            'Gujarati, Hindi & English High-Accuracy OCR',
            'Priority WhatsApp Support',
        ],
        whatsappPlanName: 'Growth Pro Plan (₹999)'
    },
    {
        id: 'business',
        name: 'Business Enterprise',
        badge: 'High Volume Booths',
        badgeColor: 'text-emerald-700 bg-emerald-50 border border-emerald-200/80',
        price: '₹2,999',
        interval: '/ month',
        scans: '2,500 monthly business card scans',
        features: [
            '2,500 monthly business card scans',
            'Unlimited Team Members & Booth Staff',
            'CSV, Excel & Full Directory Exports',
            'High-Speed Bulk Batch Processing',
            'Dedicated Account Manager on WhatsApp',
        ],
        whatsappPlanName: 'Business Enterprise Plan (₹2,999)'
    }
];

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

    const [activePlanIndex, setActivePlanIndex] = useState(0);
    const carouselRef = useRef(null);

    const workspaceName = workspace?.name || 'My Workspace';
    const currentPlanName = workspace?.plan_name || 'Free';

    // Map featureKey to human-readable titles and icons
    const featureMetadata = {
        export_csv: {
            title: 'Export to CSV & Excel',
            icon: FileSpreadsheet,
            description: 'Download your contacts into clean CSV and Excel files for your CRM and team follow-ups.',
            reasonText: 'to unlock CSV and Excel contact export'
        },
        export_excel: {
            title: 'Excel Workbook Export',
            icon: FileSpreadsheet,
            description: 'Export structured spreadsheets compatible with Microsoft Excel and Google Sheets.',
            reasonText: 'to unlock Excel export'
        },
        bulk_import: {
            title: 'Bulk Multi-Card Import',
            icon: Layers,
            description: 'Upload up to 50 business card photos at once and let our batch processor extract all contacts automatically.',
            reasonText: 'to unlock Bulk Multi-Card Import'
        },
        reverse_card_scan: {
            title: 'Back-of-Card Capture',
            icon: Layers,
            description: 'Capture the reverse side of business cards to preserve handwritten booth notes and price lists.',
            reasonText: 'to unlock reverse-card capture'
        },
        max_team_members: {
            title: 'Team Member Limit Reached',
            icon: Users,
            description: 'You have reached the maximum team members allowed on your current plan. Upgrade to invite your booth reps and staff.',
            reasonText: 'to invite more team members'
        },
        max_active_exhibitions: {
            title: 'Active Exhibition Limit Reached',
            icon: Calendar,
            description: 'You have reached the active exhibition limit for this workspace. Upgrade to manage multiple trade shows and expos simultaneously.',
            reasonText: 'to create more active exhibitions'
        },
        max_workspaces: {
            title: 'Workspace Limit Reached',
            icon: Building2,
            description: 'You have reached the maximum workspaces allowed for your account. Upgrade to create additional workspaces for different brands or ventures.',
            reasonText: 'to create more workspaces'
        },
        quota_exceeded: {
            title: 'Monthly Scan Limit Reached (5/5)',
            icon: Zap,
            description: 'You have used all 5 free card scans for this cycle. Upgrade for higher monthly scans and never pause scanning at the expo booth.',
            reasonText: 'to increase my scan allowance'
        },
        on_load: {
            title: 'Upgrade Your Scanner Workspace',
            icon: Sparkles,
            description: 'Unlock 500+ monthly card scans, CSV/Excel directory export, and bulk multi-photo scanning.',
            reasonText: 'to upgrade my workspace'
        }
    };

    const baseMeta = (reason === 'quota_exceeded')
        ? featureMetadata.quota_exceeded
        : (featureKey && featureMetadata[featureKey])
        ? featureMetadata[featureKey]
        : (reason === 'on_load')
        ? featureMetadata.on_load
        : {
            title: featureName ? (featureName.includes('Limit') || featureName.includes('Reached') ? featureName : `Unlock ${featureName}`) : 'Plan Upgrade Required',
            icon: Lock,
            description: 'This feature is available on Pro and Business subscription plans.',
            reasonText: `to unlock ${featureName || 'premium features'}`
        };

    const resolvedMeta = {
        ...baseMeta,
        title: featureName ? (featureName.includes('Limit') || featureName.includes('Reached') ? featureName : `Unlock ${featureName}`) : baseMeta.title,
        description: message || baseMeta.description,
    };

    const Icon = resolvedMeta.icon;
    const selectedPlan = UPGRADE_PLANS[activePlanIndex] || UPGRADE_PLANS[0];

    const whatsappMessage = `Hello! I would like to upgrade my workspace "${workspaceName}" to the ${selectedPlan.whatsappPlanName} ${resolvedMeta.reasonText}.`;
    const whatsappUrl = `https://wa.me/919727509762?text=${encodeURIComponent(whatsappMessage)}`;

    // Handle scroll snapping detection
    const handleScroll = () => {
        if (!carouselRef.current) return;
        const scrollLeft = carouselRef.current.scrollLeft;
        const cardWidth = carouselRef.current.offsetWidth;
        if (cardWidth > 0) {
            const index = Math.round(scrollLeft / cardWidth);
            if (index !== activePlanIndex && index >= 0 && index < UPGRADE_PLANS.length) {
                setActivePlanIndex(index);
            }
        }
    };

    const scrollToPlan = (index) => {
        if (!carouselRef.current) return;
        const cardWidth = carouselRef.current.offsetWidth;
        carouselRef.current.scrollTo({
            left: index * cardWidth,
            behavior: 'smooth'
        });
        setActivePlanIndex(index);
    };

    return createPortal(
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            {/* Backdrop Dismiss */}
            <div className="fixed inset-0 -z-10" onClick={onClose} />

            {/* Modal Card - Clean Native Mobile Sheet */}
            <div className="relative bg-white rounded-t-[32px] sm:rounded-3xl w-full max-w-md shadow-2xl z-10 max-h-[94vh] flex flex-col overflow-hidden animate-tab-fade border border-black/[0.04]">
                
                {/* Mobile Drag Indicator */}
                <div
                    onClick={onClose}
                    className="w-10 h-1 bg-zinc-300 rounded-full mx-auto sm:hidden mt-3 cursor-pointer shrink-0"
                />

                {/* Top Header */}
                <div className="flex items-center justify-between p-5 pb-1">
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
                <div className="p-5 pt-1 space-y-3.5 overflow-y-auto">
                    {/* Header Icon & Title */}
                    <div className="text-center space-y-1.5 pt-0.5">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-950 text-white flex items-center justify-center mx-auto shadow-md">
                            <Icon className="w-6 h-6 text-amber-400" />
                        </div>
                        <h3 className="text-base font-extrabold text-zinc-950 tracking-tight leading-snug">
                            {resolvedMeta.title}
                        </h3>
                        <p className="text-[11px] text-zinc-500 font-medium leading-relaxed max-w-xs mx-auto">
                            {resolvedMeta.description}
                        </p>
                    </div>

                    {/* Swipeable Plan Cards Carousel */}
                    <div className="relative">
                        <div
                            ref={carouselRef}
                            onScroll={handleScroll}
                            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none scroll-smooth -mx-1 px-1 py-0.5"
                            style={{ scrollSnapType: 'x mandatory' }}
                        >
                            {UPGRADE_PLANS.map((plan, idx) => (
                                <div
                                    key={plan.id}
                                    className="min-w-full snap-center px-1"
                                >
                                    <div className="p-4 rounded-3xl bg-zinc-50 border border-zinc-200/80 shadow-xs space-y-3">
                                        <div className="flex items-start justify-between pb-2 border-b border-zinc-200/60">
                                            <div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-1 ${plan.badgeColor}`}>
                                                    {plan.badge}
                                                </span>
                                                <h4 className="text-base font-extrabold text-zinc-950">
                                                    {plan.name}
                                                </h4>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black text-zinc-950">{plan.price}</span>
                                                <span className="text-[10px] text-zinc-500 block">{plan.interval}</span>
                                            </div>
                                        </div>

                                        {/* Feature Checklist */}
                                        <div className="space-y-1.5 text-xs text-zinc-700">
                                            {plan.features.map((feat, fIdx) => (
                                                <div key={fIdx} className="flex items-center gap-2">
                                                    <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                                    </div>
                                                    <span className={fIdx === 0 ? 'font-bold text-zinc-950' : 'text-zinc-600 font-medium'}>
                                                        {feat}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Prev / Next Chevrons for desktop & easy tap */}
                        {activePlanIndex > 0 && (
                            <button
                                type="button"
                                onClick={() => scrollToPlan(activePlanIndex - 1)}
                                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-md border border-zinc-200/80 flex items-center justify-center text-zinc-700 hover:bg-white active:scale-90"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        )}
                        {activePlanIndex < UPGRADE_PLANS.length - 1 && (
                            <button
                                type="button"
                                onClick={() => scrollToPlan(activePlanIndex + 1)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-md border border-zinc-200/80 flex items-center justify-center text-zinc-700 hover:bg-white active:scale-90"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Pagination Dots with Swipe Hint */}
                    <div className="flex items-center justify-between px-2 pt-0.5 text-[10px] text-zinc-400 font-semibold">
                        <span>Swipe to compare</span>
                        <div className="flex items-center gap-1.5">
                            {UPGRADE_PLANS.map((p, idx) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => scrollToPlan(idx)}
                                    className={`h-1.5 transition-all rounded-full ${
                                        activePlanIndex === idx
                                            ? 'w-5 bg-zinc-950'
                                            : 'w-1.5 bg-zinc-300 hover:bg-zinc-400'
                                    }`}
                                />
                            ))}
                        </div>
                        <span className="font-mono">{activePlanIndex + 1} / {UPGRADE_PLANS.length}</span>
                    </div>

                    {/* Dynamic Action Buttons */}
                    <div className="space-y-2 pt-1">
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                        >
                            <MessageCircle className="w-4 h-4" />
                            <span>
                                Upgrade to {activePlanIndex === 0 ? 'Pro' : 'Business'} via WhatsApp
                            </span>
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
                    <div className="text-center pt-0.5">
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
