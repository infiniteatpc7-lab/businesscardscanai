import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    CreditCard,
    CheckCircle2,
    Sparkles,
    Check,
    MessageCircle,
    PhoneCall,
    Mail,
    ArrowRight,
    Loader2,
    Calendar,
    Receipt,
    History,
    Shield,
    Lock,
    ExternalLink,
    Building2,
    ChevronRight,
    Clock,
    Zap
} from 'lucide-react';
import {
    fetchCustomerSubscription,
    fetchCustomerUsageLedger,
    fetchCustomerSubscriptionHistory,
    fetchCustomerPaymentHistory,
    fetchAvailablePlans,
    requestPlanUpgrade
} from '../../services/cardApi';

export default function CustomerSubscriptionDashboard({
    isOpen,
    onClose,
    currentWorkspace,
    userRole = 'owner',
    onSwitchWorkspace,
    workspaces = []
}) {
    if (!isOpen) return null;

    // Tabs: 'overview' | 'upgrade' | 'history'
    const [activeTab, setActiveTab] = useState('overview');
    const [historySubTab, setHistorySubTab] = useState('scans'); // 'scans' | 'payments'
    const [isLoading, setIsLoading] = useState(true);
    const [subData, setSubData] = useState(null);

    // Ledger & History state
    const [ledgerItems, setLedgerItems] = useState([]);
    const [isLedgerLoading, setIsLedgerLoading] = useState(false);
    const [subscriptionHistory, setSubscriptionHistory] = useState([]);

    // Payments state
    const [payments, setPayments] = useState([]);
    const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);

    // Plans & Upgrade state
    const [plans, setPlans] = useState([]);
    const [isPlansLoading, setIsPlansLoading] = useState(false);
    const [selectedUpgradePlan, setSelectedUpgradePlan] = useState(null);
    const [upgradeNote, setUpgradeNote] = useState('');
    const [upgradePhone, setUpgradePhone] = useState('');
    const [isSubmittingUpgrade, setIsSubmittingUpgrade] = useState(false);
    const [upgradeSuccessMsg, setUpgradeSuccessMsg] = useState(null);

    const isMember = (userRole || '').toLowerCase() === 'member';

    // Load initial subscription data
    const loadSubscriptionData = async () => {
        setIsLoading(true);
        try {
            const res = await fetchCustomerSubscription();
            if (res.success) {
                setSubData(res);
            }
        } catch (err) {
            console.error('Failed to load subscription:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setActiveTab('overview');
            setHistorySubTab('scans');
            setUpgradeSuccessMsg(null);
            setSelectedUpgradePlan(null);
            loadSubscriptionData();
        }
    }, [isOpen, currentWorkspace?.id]);

    // Load tab-specific data when tab changes
    useEffect(() => {
        if (!isOpen || isMember) return;

        if (activeTab === 'upgrade' && plans.length === 0) {
            loadPlans();
        } else if (activeTab === 'history') {
            if (historySubTab === 'scans' && ledgerItems.length === 0) {
                loadLedger();
            } else if (historySubTab === 'payments' && payments.length === 0) {
                loadPayments();
            }
        }
    }, [activeTab, historySubTab, isOpen]);

    const loadPlans = async () => {
        setIsPlansLoading(true);
        try {
            const res = await fetchAvailablePlans();
            if (res.success && Array.isArray(res.plans)) {
                setPlans(res.plans);
            }
        } catch (err) {
            console.error('Failed to load plans:', err);
        } finally {
            setIsPlansLoading(false);
        }
    };

    const loadLedger = async () => {
        setIsLedgerLoading(true);
        try {
            const [ledgerRes, historyRes] = await Promise.all([
                fetchCustomerUsageLedger(1, 30),
                fetchCustomerSubscriptionHistory()
            ]);
            if (ledgerRes.success && Array.isArray(ledgerRes.ledger)) {
                setLedgerItems(ledgerRes.ledger);
            }
            if (historyRes.success && Array.isArray(historyRes.history)) {
                setSubscriptionHistory(historyRes.history);
            }
        } catch (err) {
            console.error('Failed to load ledger / history:', err);
        } finally {
            setIsLedgerLoading(false);
        }
    };

    const loadPayments = async () => {
        setIsPaymentsLoading(true);
        try {
            const res = await fetchCustomerPaymentHistory({ status: 'all', perPage: 25 });
            if (res.success && Array.isArray(res.transactions)) {
                setPayments(res.transactions);
            } else {
                setPayments([]);
            }
        } catch (err) {
            console.error('Failed to load payments:', err);
            setPayments([]);
        } finally {
            setIsPaymentsLoading(false);
        }
    };

    const handleUpgradeSubmit = async (e) => {
        e.preventDefault();
        if (!selectedUpgradePlan) return;
        setIsSubmittingUpgrade(true);
        try {
            const res = await requestPlanUpgrade({
                planId: selectedUpgradePlan.id,
                note: upgradeNote.trim(),
                phone: upgradePhone.trim(),
            });
            if (res.success) {
                setUpgradeSuccessMsg(res);
                setSelectedUpgradePlan(null);
                setUpgradeNote('');
            }
        } catch (err) {
            console.error('Failed to submit upgrade request:', err);
        } finally {
            setIsSubmittingUpgrade(false);
        }
    };

    // Derived values
    const currentPlan = subData?.plan || null;
    const quota = subData?.quota || null;
    const allowance = quota?.monthly_allowance ?? (currentPlan?.monthly_scan_allowance || 0);
    const isUnlimited = quota?.is_unlimited || allowance === -1;
    const used = quota?.used_credits ?? 0;
    const remaining = isUnlimited ? '∞' : Math.max(0, allowance - used);
    const usagePercent = isUnlimited ? 0 : allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;

    const billingStart = subData?.subscription?.billing_period_starts_at
        ? new Date(subData.subscription.billing_period_starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Active cycle';
    const billingEnd = subData?.subscription?.billing_period_ends_at
        ? new Date(subData.subscription.billing_period_ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Next renewal';

    const whatsappDirectLink = (planName) => {
        const text = `Hello! I would like to upgrade my workspace "${currentWorkspace?.name || 'My Workspace'}" to the ${planName || 'Pro'} plan.`;
        return `https://wa.me/917600198889?text=${encodeURIComponent(text)}`;
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            {/* Backdrop Dismiss */}
            <div className="fixed inset-0 -z-10" onClick={onClose} />

            {/* Modal Card - Clean Light Mobile App Shell */}
            <div className="relative bg-[#FBFBFC] rounded-t-[32px] sm:rounded-3xl w-full max-w-lg shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden animate-tab-fade border border-black/[0.04]">
                
                {/* Mobile Drag Indicator */}
                <div
                    onClick={onClose}
                    className="w-10 h-1 bg-zinc-300 rounded-full mx-auto sm:hidden mt-3 cursor-pointer shrink-0"
                />

                {/* Clean Mobile App Header */}
                <div className="p-5 pb-3 bg-white border-b border-zinc-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-950 text-white flex items-center justify-center shadow-sm">
                            <CreditCard className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold text-zinc-950 leading-tight">
                                    Subscription & Credits
                                </h3>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                                    {currentPlan?.name || 'Free'}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-500 font-medium">
                                {currentWorkspace?.name || 'Workspace'} • <span className="capitalize">{userRole}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition-colors active:scale-95"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Segmented Native Mobile Switcher (No scrollbar, perfectly balanced) */}
                <div className="px-5 pt-3 pb-2 bg-white border-b border-zinc-100 shrink-0">
                    <div className="bg-zinc-100/90 p-1 rounded-2xl grid grid-cols-3 gap-1">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`py-2 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
                                activeTab === 'overview'
                                    ? 'bg-white text-zinc-950 shadow-sm'
                                    : 'text-zinc-600 hover:text-zinc-900'
                            }`}
                        >
                            <Zap className="w-3.5 h-3.5 text-emerald-600" />
                            <span>My Plan</span>
                        </button>
                        <button
                            onClick={() => {
                                if (isMember) {
                                    setActiveTab('upgrade');
                                } else {
                                    setActiveTab('upgrade');
                                    if (plans.length === 0) loadPlans();
                                }
                            }}
                            className={`py-2 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
                                activeTab === 'upgrade'
                                    ? 'bg-white text-zinc-950 shadow-sm'
                                    : 'text-zinc-600 hover:text-zinc-900'
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>Upgrade</span>
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('history');
                                if (!isMember) {
                                    if (historySubTab === 'scans' && ledgerItems.length === 0) loadLedger();
                                    if (historySubTab === 'payments' && payments.length === 0) loadPayments();
                                }
                            }}
                            className={`py-2 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
                                activeTab === 'history'
                                    ? 'bg-white text-zinc-950 shadow-sm'
                                    : 'text-zinc-600 hover:text-zinc-900'
                            }`}
                        >
                            <History className="w-3.5 h-3.5 text-zinc-700" />
                            <span>History</span>
                        </button>
                    </div>
                </div>

                {/* Scrollable Content Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {isLoading ? (
                        <div className="py-16 text-center space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto" />
                            <p className="text-xs text-zinc-500 font-medium">Loading subscription details...</p>
                        </div>
                    ) : (
                        <>
                            {/* TAB 1: OVERVIEW */}
                            {activeTab === 'overview' && (
                                <div className="space-y-4 animate-tab-fade">
                                    {/* Native App Hero Card */}
                                    <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white p-5 rounded-3xl shadow-md relative overflow-hidden space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400 block mb-0.5">
                                                    Current Subscription
                                                </span>
                                                <h4 className="text-xl font-extrabold tracking-tight">
                                                    {currentPlan?.name || 'Free Plan'}
                                                </h4>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black text-white">
                                                    {currentPlan?.formatted_price || '₹0'}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 block">/ month</span>
                                            </div>
                                        </div>

                                        {/* Scan Quota Progress */}
                                        <div className="space-y-2 pt-1">
                                            <div className="flex justify-between items-baseline text-xs font-bold">
                                                <span className="text-zinc-400">Available Scan Balance</span>
                                                <span className="text-white text-sm font-extrabold">
                                                    <span className="text-emerald-400 text-lg">{remaining}</span> / {isUnlimited ? '∞' : allowance} left
                                                </span>
                                            </div>
                                            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden p-0.5">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${Math.min(100, Math.max(5, usagePercent))}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                                                <span>Used this cycle: <strong className="text-zinc-200">{used} cards</strong></span>
                                                <span>{usagePercent}% utilized</span>
                                            </div>
                                        </div>

                                        {/* Friendly policy notice */}
                                        <div className="bg-white/10 rounded-2xl p-3 text-[11px] text-zinc-300 flex items-center gap-2 border border-white/10">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                            <span>
                                                1 successfully saved card consumes 1 credit. Failed scans never use credits.
                                            </span>
                                        </div>
                                    </div>

                                    {/* Plan Inclusions / Features */}
                                    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-zinc-200/70 shadow-sm space-y-3">
                                        <h5 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
                                            Included in your plan
                                        </h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-zinc-700">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                </div>
                                                <span className="font-medium">Hindi, Gujarati & English OCR</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                </div>
                                                <span className="font-medium">One-Tap vCard Phone Save</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                </div>
                                                <span className="font-medium">CSV & Excel Directory Export</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                </div>
                                                <span className="font-medium">Multi-User Booth Scanning</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Billing Cycle Details */}
                                    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-zinc-200/70 shadow-sm space-y-2.5 text-xs">
                                        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                                            <span className="text-zinc-500">Current Period</span>
                                            <span className="font-bold text-zinc-900">{billingStart} — {billingEnd}</span>
                                        </div>
                                        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                                            <span className="text-zinc-500">Workspace Status</span>
                                            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                Active & Synchronized
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500">Your Permission</span>
                                            <span className="font-bold text-zinc-900 capitalize">
                                                {userRole} {isMember ? '(View only)' : '(Full billing access)'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action to Upgrade */}
                                    {!isMember && (
                                        <button
                                            onClick={() => {
                                                setActiveTab('upgrade');
                                                if (plans.length === 0) loadPlans();
                                            }}
                                            className="w-full py-3.5 px-4 rounded-2xl bg-zinc-950 hover:bg-black text-white text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <Sparkles className="w-4 h-4 text-amber-400" />
                                            <span>Upgrade for More Monthly Scans</span>
                                            <ArrowRight className="w-4 h-4 ml-1" />
                                        </button>
                                    )}

                                    {/* Other Workspaces Quick Switch */}
                                    {subData?.workspaces_summary && subData.workspaces_summary.length > 1 && (
                                        <div className="bg-zinc-50 rounded-3xl p-4 border border-zinc-200/70 space-y-2">
                                            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                                                Your Other Workspaces
                                            </span>
                                            <div className="space-y-1.5">
                                                {subData.workspaces_summary
                                                    .filter((ws) => !ws.is_current_workspace)
                                                    .map((ws) => (
                                                        <div
                                                            key={ws.id}
                                                            className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-zinc-200/60 text-xs"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                                                                <span className="font-bold text-zinc-900">{ws.name}</span>
                                                            </div>
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                                                                {ws.plan_name}
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: UPGRADE PLANS */}
                            {activeTab === 'upgrade' && (
                                <div className="space-y-4 animate-tab-fade">
                                    {isMember ? (
                                        <div className="bg-white rounded-3xl p-6 border border-zinc-200/70 text-center space-y-3">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                                                <Lock className="w-6 h-6" />
                                            </div>
                                            <h4 className="text-base font-extrabold text-zinc-950">
                                                Member Role Restricted
                                            </h4>
                                            <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                                                Only workspace Owners and Admins can purchase plans or request quota upgrades. Please reach out to your workspace owner to upgrade scans.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {upgradeSuccessMsg && (
                                                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                                                    <div className="flex items-center gap-2 font-bold">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                        <span>Upgrade Request Submitted!</span>
                                                    </div>
                                                    <p className="text-emerald-700 leading-relaxed">
                                                        {upgradeSuccessMsg.message}
                                                    </p>
                                                    {upgradeSuccessMsg.support?.whatsapp && (
                                                        <a
                                                            href={upgradeSuccessMsg.support.whatsapp}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 mt-1"
                                                        >
                                                            <MessageCircle className="w-3.5 h-3.5" />
                                                            <span>Open WhatsApp Chat Now</span>
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            {isPlansLoading ? (
                                                <div className="py-12 text-center space-y-2">
                                                    <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mx-auto" />
                                                    <p className="text-xs text-zinc-500">Loading available plans...</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {plans.map((p) => {
                                                        const isThisCurrent = p.is_current;
                                                        const scans = p.monthly_scan_allowance === -1 ? 'Unlimited' : p.monthly_scan_allowance;

                                                        return (
                                                            <div
                                                                key={p.id}
                                                                className={`p-4 rounded-3xl border transition-all text-left space-y-3 ${
                                                                    isThisCurrent
                                                                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                                                                        : 'bg-white hover:border-zinc-300 text-zinc-900 border-zinc-200/80 shadow-sm'
                                                                }`}
                                                            >
                                                                <div className="flex items-start justify-between">
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="text-base font-extrabold">
                                                                                {p.name}
                                                                            </h4>
                                                                            {isThisCurrent && (
                                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                                                    Current Plan
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className={`text-xs mt-0.5 ${isThisCurrent ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                                            {p.description || `${scans} scan credits every month`}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-lg font-black">
                                                                            {p.formatted_price}
                                                                        </span>
                                                                        <span className={`text-[10px] block ${isThisCurrent ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                                            / month
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Allowance badge */}
                                                                <div className={`p-2.5 rounded-2xl flex items-center justify-between text-xs font-bold ${
                                                                    isThisCurrent ? 'bg-zinc-800 text-emerald-400' : 'bg-zinc-50 text-emerald-700 border border-zinc-200/60'
                                                                }`}>
                                                                    <span>Monthly Allowance</span>
                                                                    <span>{scans} Cards / Mo</span>
                                                                </div>

                                                                {/* Plan Actions */}
                                                                {!isThisCurrent && (
                                                                    <div className="flex items-center gap-2 pt-1">
                                                                        <a
                                                                            href={whatsappDirectLink(p.name)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                                                                        >
                                                                            <MessageCircle className="w-3.5 h-3.5" />
                                                                            <span>Instant WhatsApp Upgrade</span>
                                                                        </a>
                                                                        <button
                                                                            onClick={() => setSelectedUpgradePlan(p)}
                                                                            className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
                                                                        >
                                                                            <span>Inquire</span>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Upgrade Request Drawer / Form */}
                                            {selectedUpgradePlan && (
                                                <form
                                                    onSubmit={handleUpgradeSubmit}
                                                    className="bg-white p-4 rounded-3xl border border-zinc-200/80 shadow-md space-y-3 animate-tab-fade"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <h5 className="text-xs font-extrabold text-zinc-950">
                                                            Request Upgrade to "{selectedUpgradePlan.name}"
                                                        </h5>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedUpgradePlan(null)}
                                                            className="text-zinc-400 hover:text-zinc-700"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                                                            Contact Phone / WhatsApp Number
                                                        </label>
                                                        <input
                                                            type="tel"
                                                            placeholder="+91 98765 43210"
                                                            value={upgradePhone}
                                                            onChange={(e) => setUpgradePhone(e.target.value)}
                                                            className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                                                            Note or Expected Booth Volume (Optional)
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            placeholder="Need additional scans for upcoming trade expo..."
                                                            value={upgradeNote}
                                                            onChange={(e) => setUpgradeNote(e.target.value)}
                                                            className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black"
                                                        />
                                                    </div>

                                                    <button
                                                        type="submit"
                                                        disabled={isSubmittingUpgrade}
                                                        className="w-full py-2.5 px-4 rounded-xl bg-zinc-950 hover:bg-black text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                                                    >
                                                        {isSubmittingUpgrade ? (
                                                            <>
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                <span>Sending Request...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                                                <span>Submit Plan Upgrade Request</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </form>
                                            )}

                                            {/* Support Hotline card */}
                                            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200/60 flex items-center justify-between text-xs">
                                                <div>
                                                    <span className="font-bold text-zinc-900 block">Need custom enterprise quota?</span>
                                                    <span className="text-[11px] text-zinc-500">Call sales team: +91 76001 98889</span>
                                                </div>
                                                <a
                                                    href="tel:+917600198889"
                                                    className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-800 shadow-sm active:scale-95"
                                                >
                                                    <PhoneCall className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: HISTORY (Activity & Payments) */}
                            {activeTab === 'history' && (
                                <div className="space-y-3 animate-tab-fade">
                                    {isMember ? (
                                        <div className="bg-white rounded-3xl p-6 border border-zinc-200/70 text-center space-y-3">
                                            <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-600 flex items-center justify-center mx-auto">
                                                <Lock className="w-6 h-6" />
                                            </div>
                                            <h4 className="text-base font-extrabold text-zinc-950">
                                                Restricted to Workspace Admins
                                            </h4>
                                            <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                                                Detailed scan deduction logs and payment transaction history are reserved for workspace Owners and Admins.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Sub-tab pills */}
                                            <div className="flex items-center gap-2 pb-1">
                                                <button
                                                    onClick={() => {
                                                        setHistorySubTab('scans');
                                                        if (ledgerItems.length === 0) loadLedger();
                                                    }}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                        historySubTab === 'scans'
                                                            ? 'bg-zinc-950 text-white'
                                                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                                    }`}
                                                >
                                                    Scan Activity ({ledgerItems.length})
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setHistorySubTab('payments');
                                                        if (payments.length === 0) loadPayments();
                                                    }}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                        historySubTab === 'payments'
                                                            ? 'bg-zinc-950 text-white'
                                                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                                    }`}
                                                >
                                                    Payment Receipts ({payments.length})
                                                </button>
                                            </div>

                                            {/* Sub-tab: Scan Activity */}
                                            {historySubTab === 'scans' && (
                                                <div className="space-y-2">
                                                    {isLedgerLoading ? (
                                                        <div className="py-12 text-center space-y-2">
                                                            <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mx-auto" />
                                                            <p className="text-xs text-zinc-500">Loading scan deductions...</p>
                                                        </div>
                                                    ) : ledgerItems.length === 0 ? (
                                                        <div className="bg-white rounded-3xl p-8 border border-zinc-200/70 text-center space-y-2">
                                                            <div className="w-10 h-10 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                                                                <CreditCard className="w-5 h-5" />
                                                            </div>
                                                            <h5 className="text-xs font-bold text-zinc-900">No Scan Deductions Yet</h5>
                                                            <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                                                                Every business card you scan and save consumes 1 scan credit. Your deductions will show here in real time.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {ledgerItems.map((item) => (
                                                                <div
                                                                    key={item.id}
                                                                    className="p-3 rounded-2xl bg-white border border-zinc-200/70 shadow-sm flex items-center justify-between text-xs"
                                                                >
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                                            <CheckCircle2 className="w-4 h-4" />
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-bold text-zinc-900 block leading-snug">
                                                                                {item.reason || 'Card Scanned & Saved'}
                                                                            </span>
                                                                            <span className="text-[10px] text-zinc-400">
                                                                                {item.confirmed_at
                                                                                    ? new Date(item.confirmed_at).toLocaleString('en-IN', {
                                                                                          day: 'numeric',
                                                                                          month: 'short',
                                                                                          hour: '2-digit',
                                                                                          minute: '2-digit',
                                                                                      })
                                                                                    : 'Just now'} • By {item.user_name}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <span className="font-mono font-bold text-zinc-950 px-2 py-1 rounded-lg bg-zinc-50 border border-zinc-200/60">
                                                                        -{item.quantity} credit
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Sub-tab: Payment Receipts */}
                                            {historySubTab === 'payments' && (
                                                <div className="space-y-2">
                                                    {isPaymentsLoading ? (
                                                        <div className="py-12 text-center space-y-2">
                                                            <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mx-auto" />
                                                            <p className="text-xs text-zinc-500">Loading invoices...</p>
                                                        </div>
                                                    ) : payments.length === 0 ? (
                                                        <div className="bg-white rounded-3xl p-8 border border-zinc-200/70 text-center space-y-2">
                                                            <div className="w-10 h-10 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                                                                <Receipt className="w-5 h-5" />
                                                            </div>
                                                            <h5 className="text-xs font-bold text-zinc-900">No Payment Records</h5>
                                                            <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                                                                You are currently using the complimentary Free Plan. Paid renewals and receipts will appear here.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {payments.map((tx) => (
                                                                <div
                                                                    key={tx.id}
                                                                    className="p-3 rounded-2xl bg-white border border-zinc-200/70 shadow-sm flex items-center justify-between text-xs"
                                                                >
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                                                                            <Receipt className="w-4 h-4" />
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-bold text-zinc-900 block leading-snug">
                                                                                {tx.plan_name || 'Workspace Subscription'}
                                                                            </span>
                                                                            <span className="text-[10px] text-zinc-400">
                                                                                {tx.created_at
                                                                                    ? new Date(tx.created_at).toLocaleDateString('en-IN', {
                                                                                          day: 'numeric',
                                                                                          month: 'short',
                                                                                          year: 'numeric'
                                                                                      })
                                                                                    : 'Recent'} • {tx.gateway_payment_id || tx.gateway_order_id || 'Ref #'+tx.id}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="font-extrabold text-zinc-950 block">
                                                                            {tx.formatted_amount}
                                                                        </span>
                                                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                                            tx.status === 'successful'
                                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                                : tx.status === 'pending'
                                                                                ? 'bg-amber-50 text-amber-700'
                                                                                : 'bg-zinc-100 text-zinc-700'
                                                                        }`}>
                                                                            {tx.status}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Bottom App Safe Area Footer */}
                <div className="p-4 bg-white border-t border-zinc-100 flex items-center justify-between shrink-0 text-xs">
                    <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Secure Cloud Quota Sync</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition-all active:scale-95 text-xs"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
