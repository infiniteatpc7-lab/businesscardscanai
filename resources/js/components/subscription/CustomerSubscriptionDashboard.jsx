import React, { useState, useEffect } from 'react';
import {
    X,
    CreditCard,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Zap,
    Shield,
    Calendar,
    Receipt,
    History,
    Building2,
    Users,
    ChevronRight,
    ArrowRight,
    Loader2,
    Sparkles,
    Check,
    MessageCircle,
    Mail,
    PhoneCall,
    BarChart3,
    Info,
    ExternalLink,
    Lock
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
    // Tabs: 'overview' | 'upgrade' | 'ledger' | 'payments'
    const [activeTab, setActiveTab] = useState('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [subData, setSubData] = useState(null);

    // Ledger state
    const [ledgerItems, setLedgerItems] = useState([]);
    const [isLedgerLoading, setIsLedgerLoading] = useState(false);

    // History state
    const [historyItems, setHistoryItems] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    // Payments state
    const [payments, setPayments] = useState([]);
    const [paymentFilter, setPaymentFilter] = useState('all');
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
        } else if (activeTab === 'ledger' && ledgerItems.length === 0) {
            loadLedger();
        } else if (activeTab === 'payments') {
            loadPayments();
        }
    }, [activeTab, isOpen, paymentFilter]);

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
                setHistoryItems(historyRes.history);
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
            const res = await fetchCustomerPaymentHistory({ status: paymentFilter, perPage: 20 });
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
                setUpgradePhone('');
            }
        } catch (err) {
            console.error('Upgrade request error:', err);
        } finally {
            setIsSubmittingUpgrade(false);
        }
    };

    if (!isOpen) return null;

    const plan = subData?.plan || {};
    const quota = subData?.quota || {};
    const sub = subData?.subscription || {};
    const workspaceInfo = subData?.workspace || currentWorkspace || {};
    const isPaid = (plan.price ?? 0) > 0;
    const isUnlimited = quota.is_unlimited || plan.is_unlimited_scans;
    const used = quota.used_credits ?? 0;
    const allowance = isUnlimited ? 'Unlimited' : (quota.monthly_allowance ?? plan.monthly_scan_allowance ?? 50);
    const remaining = isUnlimited ? 'Unlimited' : (quota.remaining_credits ?? Math.max(0, allowance - used));
    const reserved = quota.reserved_credits ?? 0;
    const usagePercent = isUnlimited ? 0 : Math.min(100, Math.round((used / (allowance || 1)) * 100));

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Sheet Container */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] z-10 animate-tab-fade overflow-hidden border border-black/[0.06] dark:border-zinc-800">
                {/* Mobile Drag Indicator */}
                <div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto sm:hidden mt-2.5 mb-1" />

                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-950/40">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-black text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center shrink-0 shadow-sm">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-extrabold text-zinc-950 dark:text-white truncate">
                                    Subscription & Usage
                                </h3>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                    isPaid
                                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                }`}>
                                    {plan.name || 'Free Plan'}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1 mt-0.5">
                                <Building2 className="w-3 h-3 text-zinc-400" />
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{workspaceInfo.name}</span>
                                <span className="text-[10px] uppercase font-bold text-zinc-400">({userRole})</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Member Read-Only Notice */}
                {isMember && (
                    <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>You are viewing workspace scan credits. Billing is managed by your workspace Owner.</span>
                    </div>
                )}

                {/* Navigation Tabs */}
                {!isMember && (
                    <div className="flex border-b border-zinc-100 dark:border-zinc-800 px-4 bg-zinc-50/30 dark:bg-zinc-950/30 shrink-0 gap-1 overflow-x-auto text-xs">
                        <button
                            type="button"
                            onClick={() => setActiveTab('overview')}
                            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                                activeTab === 'overview'
                                    ? 'border-orange-500 text-orange-600 dark:text-orange-400 font-bold'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>Usage & Quota</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('upgrade')}
                            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                                activeTab === 'upgrade'
                                    ? 'border-orange-500 text-orange-600 dark:text-orange-400 font-bold'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                        >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Plans & Upgrade</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('ledger')}
                            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                                activeTab === 'ledger'
                                    ? 'border-orange-500 text-orange-600 dark:text-orange-400 font-bold'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                        >
                            <History className="w-3.5 h-3.5" />
                            <span>Usage Ledger</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('payments')}
                            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                                activeTab === 'payments'
                                    ? 'border-orange-500 text-orange-600 dark:text-orange-400 font-bold'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                        >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Payment History</span>
                        </button>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {isLoading ? (
                        <div className="py-16 text-center text-zinc-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
                            <p className="text-xs font-semibold">Loading subscription status...</p>
                        </div>
                    ) : (
                        <>
                            {/* TAB 1: OVERVIEW & USAGE */}
                            {activeTab === 'overview' && (
                                <div className="space-y-4">
                                    {/* Upgrade Success Notification */}
                                    {upgradeSuccessMsg && (
                                        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                                            <p className="font-bold flex items-center gap-1.5">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                Upgrade Request Submitted!
                                            </p>
                                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                                                {upgradeSuccessMsg.message}
                                            </p>
                                        </div>
                                    )}

                                    {/* Plan Hero Tile */}
                                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-tr from-zinc-900 to-zinc-800 text-white shadow-sm space-y-3 relative overflow-hidden">
                                        <div className="flex items-start justify-between gap-3 relative z-10">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block mb-1">
                                                    Current Active Plan
                                                </span>
                                                <h4 className="text-xl font-extrabold tracking-tight">
                                                    {plan.name || 'Free Tier'}
                                                </h4>
                                                <p className="text-xs text-zinc-300 mt-0.5">
                                                    {plan.description || 'Core OCR business card scanning for small booths'}
                                                </p>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="text-2xl font-black text-white">
                                                    {isPaid ? `₹${Number(plan.price).toLocaleString('en-IN')}` : '₹0'}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 block">/ {plan.billing_interval || 'month'}</span>
                                            </div>
                                        </div>

                                        {/* Billing Dates */}
                                        <div className="pt-2.5 border-t border-zinc-700/80 flex items-center justify-between text-xs text-zinc-300 relative z-10">
                                            <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Billing Cycle
                                            </span>
                                            <span className="font-mono text-[11px] font-semibold">
                                                {formatDate(sub.billing_period_starts_at)} — {formatDate(sub.billing_period_ends_at)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Scan Credits Quota Meter */}
                                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
                                                <Sparkles className="w-4 h-4 text-orange-500" />
                                                <span>Monthly Scan Allowance</span>
                                            </div>
                                            <span className="font-extrabold text-sm text-zinc-900 dark:text-white font-mono">
                                                {used} / {allowance}
                                            </span>
                                        </div>

                                        {/* Progress Bar */}
                                        {!isUnlimited ? (
                                            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-300 rounded-full ${
                                                        usagePercent >= 90
                                                            ? 'bg-rose-500'
                                                            : usagePercent >= 70
                                                            ? 'bg-amber-500'
                                                            : 'bg-orange-500'
                                                    }`}
                                                    style={{ width: `${usagePercent}%` }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Unlimited Card Scans Active</span>
                                            </div>
                                        )}

                                        {/* Metric Pills */}
                                        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                                            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60">
                                                <span className="text-[10px] text-zinc-400 block font-medium">Allowance</span>
                                                <span className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5 block">{allowance}</span>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60">
                                                <span className="text-[10px] text-zinc-400 block font-medium">Saved Cards</span>
                                                <span className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5 block">{used}</span>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60">
                                                <span className="text-[10px] text-zinc-400 block font-medium">Remaining</span>
                                                <span className={`text-xs font-extrabold mt-0.5 block ${remaining === 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {remaining}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Explanation Note per Section 2 */}
                                        <div className="flex items-start gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                            <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                                            <span>
                                                <strong>1 successfully saved business card consumes 1 credit.</strong> Failed extractions or discarded previews never consume credits.
                                            </span>
                                        </div>
                                    </div>

                                    {/* Multi-Workspace Overview per Section 1 */}
                                    {subData?.workspaces_summary && subData.workspaces_summary.length > 1 && (
                                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/80 space-y-2.5">
                                            <h5 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                                                Your Workspace Subscriptions ({subData.workspaces_summary.length})
                                            </h5>
                                            <div className="space-y-1.5">
                                                {subData.workspaces_summary.map((ws) => (
                                                    <div
                                                        key={ws.id}
                                                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                                            ws.is_current_workspace
                                                                ? 'bg-white dark:bg-zinc-900 border-orange-500/30 shadow-2xs'
                                                                : 'bg-white/60 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-zinc-800'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Building2 className={`w-3.5 h-3.5 ${ws.is_current_workspace ? 'text-orange-500' : 'text-zinc-400'}`} />
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-zinc-900 dark:text-white truncate">
                                                                    {ws.name}
                                                                </p>
                                                                <p className="text-[10px] text-zinc-400">
                                                                    Role: {ws.role} · {ws.subscription_status}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                                                {ws.plan_name}
                                                            </span>
                                                            {!ws.is_current_workspace && onSwitchWorkspace && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        onSwitchWorkspace(ws);
                                                                        onClose();
                                                                    }}
                                                                    className="text-[10px] font-bold text-orange-600 dark:text-orange-400 hover:underline"
                                                                >
                                                                    Switch
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action row to browse plans */}
                                    {!isMember && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('upgrade')}
                                            className="w-full py-3 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                                        >
                                            <Zap className="w-4 h-4" />
                                            <span>Upgrade Plan & Add More Credits</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: PLANS & UPGRADE */}
                            {activeTab === 'upgrade' && (
                                <div className="space-y-4">
                                    <div className="text-center space-y-1">
                                        <h4 className="text-sm font-extrabold text-zinc-950 dark:text-white">
                                            Choose the Right Plan for Your Booth
                                        </h4>
                                        <p className="text-xs text-zinc-500">
                                            Scale scan allowances and team members across all trade exhibitions.
                                        </p>
                                    </div>

                                    {isPlansLoading ? (
                                        <div className="py-12 text-center text-zinc-400">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
                                            Loading available SaaS plans...
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {plans.map((p) => {
                                                const isCurrent = p.is_current;
                                                const isPlanPaid = p.price > 0;

                                                return (
                                                    <div
                                                        key={p.id}
                                                        className={`p-4 rounded-2xl border transition-all ${
                                                            isCurrent
                                                                ? 'bg-zinc-50 dark:bg-zinc-800/40 border-orange-500/50 shadow-2xs'
                                                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h5 className="text-sm font-extrabold text-zinc-950 dark:text-white">
                                                                        {p.name}
                                                                    </h5>
                                                                    {isCurrent && (
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">
                                                                            Current
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-zinc-500 mt-0.5">
                                                                    {p.description || `${p.monthly_scan_allowance === -1 ? 'Unlimited' : p.monthly_scan_allowance} monthly scan credits`}
                                                                </p>
                                                            </div>

                                                            <div className="text-right shrink-0">
                                                                <span className="text-lg font-black text-zinc-950 dark:text-white">
                                                                    {isPlanPaid ? `₹${Number(p.price).toLocaleString('en-IN')}` : '₹0'}
                                                                </span>
                                                                <span className="text-[10px] text-zinc-400 block">/ mo</span>
                                                            </div>
                                                        </div>

                                                        {/* Features list */}
                                                        {p.features && p.features.length > 0 && (
                                                            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap gap-1.5">
                                                                {p.features.slice(0, 4).map((f) => (
                                                                    <span
                                                                        key={f}
                                                                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                                                    >
                                                                        <Check className="w-2.5 h-2.5 text-emerald-500" />
                                                                        {f.replace(/_/g, ' ')}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Action button */}
                                                        <div className="mt-3.5 pt-2 flex items-center justify-end">
                                                            {isCurrent ? (
                                                                <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                                    Active on this workspace
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedUpgradePlan(p)}
                                                                    className="px-3.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-black text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <span>Request Upgrade</span>
                                                                    <ArrowRight className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Upgrade Request Sheet / Modal */}
                                    {selectedUpgradePlan && (
                                        <div className="p-4 rounded-2xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-xs font-bold text-orange-950 dark:text-orange-200 flex items-center gap-1.5">
                                                    <Zap className="w-4 h-4 text-orange-600" />
                                                    Upgrade Request: {selectedUpgradePlan.name}
                                                </h5>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedUpgradePlan(null)}
                                                    className="text-xs text-zinc-400 hover:text-zinc-600"
                                                >
                                                    Cancel
                                                </button>
                                            </div>

                                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                                Direct gateway checkout is currently being provisioned. Submit this request and our sales team will activate your plan immediately with GST invoice.
                                            </p>

                                            <form onSubmit={handleUpgradeSubmit} className="space-y-2.5">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                                                        Contact Phone / WhatsApp
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={upgradePhone}
                                                        onChange={(e) => setUpgradePhone(e.target.value)}
                                                        placeholder="+91 98765 43210"
                                                        className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                                                        Special Instructions / GST details (Optional)
                                                    </label>
                                                    <textarea
                                                        value={upgradeNote}
                                                        onChange={(e) => setUpgradeNote(e.target.value)}
                                                        rows={2}
                                                        placeholder="E.g., Need 3 additional booth reps for upcoming trade show..."
                                                        className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                    />
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={isSubmittingUpgrade}
                                                    className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                >
                                                    {isSubmittingUpgrade ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Zap className="w-3.5 h-3.5" />
                                                    )}
                                                    Submit Plan Upgrade Request
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: USAGE LEDGER & SUBSCRIPTION HISTORY */}
                            {activeTab === 'ledger' && (
                                <div className="space-y-4">
                                    {/* Scan Usage Ledger Section */}
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <h5 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                                                Scan Deductions & Credit History
                                            </h5>
                                            <span className="text-[10px] text-zinc-400">
                                                Real-time usage
                                            </span>
                                        </div>

                                        {isLedgerLoading ? (
                                            <div className="py-8 text-center text-zinc-400">
                                                <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-500 mb-1" />
                                                Loading usage records...
                                            </div>
                                        ) : ledgerItems.length === 0 ? (
                                            <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 text-center text-xs text-zinc-400">
                                                No scan usage recorded in this billing period.
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                                {ledgerItems.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs flex items-center justify-between"
                                                    >
                                                        <div>
                                                            <p className="font-semibold text-zinc-900 dark:text-white">
                                                                {item.operation_type === 'single_scan' ? 'Card Scan' : 'Batch Scan'}
                                                                <span className="text-[10px] text-zinc-400 font-normal ml-1">
                                                                    by {item.user_name}
                                                                </span>
                                                            </p>
                                                            <p className="text-[10px] text-zinc-400">
                                                                {formatDate(item.confirmed_at || item.created_at)}
                                                            </p>
                                                        </div>

                                                        <span className="font-bold text-orange-600 dark:text-orange-400 font-mono">
                                                            -{item.quantity} credit
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Subscription Plan Change History Section */}
                                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
                                        <h5 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                                            Plan Change History
                                        </h5>

                                        {historyItems.length === 0 ? (
                                            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-center text-xs text-zinc-400">
                                                Initial Free Tier assigned upon workspace registration.
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                {historyItems.map((h) => (
                                                    <div
                                                        key={h.id}
                                                        className="p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs space-y-1"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1 font-bold text-zinc-900 dark:text-white text-xs">
                                                                {h.previous_plan_name && (
                                                                    <>
                                                                        <span className="line-through text-zinc-400 font-normal">
                                                                            {h.previous_plan_name}
                                                                        </span>
                                                                        <ArrowRight className="w-3 h-3 text-zinc-400" />
                                                                    </>
                                                                )}
                                                                <span>{h.plan_name || 'Free Plan'}</span>
                                                            </div>
                                                            <span className="text-[10px] font-mono text-zinc-400">
                                                                {formatDate(h.created_at)}
                                                            </span>
                                                        </div>

                                                        <p className="text-[10px] text-zinc-400">
                                                            Source: {h.assignment_source === 'admin_assigned' ? 'Admin Assigned' : h.assignment_source === 'system_free' ? 'System Free' : 'Checkout'}
                                                            {h.reason && ` · "${h.reason}"`}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: PAYMENT HISTORY */}
                            {activeTab === 'payments' && (
                                <div className="space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h5 className="text-xs font-bold text-zinc-950 dark:text-white">
                                                Workspace Payment Records
                                            </h5>
                                            <p className="text-[11px] text-zinc-500">
                                                Past transactions and invoices for {workspaceInfo.name}
                                            </p>
                                        </div>

                                        {/* Status Filter */}
                                        <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700">
                                            {['all', 'successful', 'pending', 'failed'].map((st) => (
                                                <button
                                                    key={st}
                                                    type="button"
                                                    onClick={() => setPaymentFilter(st)}
                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium capitalize transition-all cursor-pointer ${
                                                        paymentFilter === st
                                                            ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold shadow-2xs'
                                                            : 'text-zinc-500 hover:text-zinc-800'
                                                    }`}
                                                >
                                                    {st}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {isPaymentsLoading ? (
                                        <div className="py-12 text-center text-zinc-400">
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-500 mb-2" />
                                            Loading payment transactions...
                                        </div>
                                    ) : payments.length === 0 ? (
                                        <div className="p-8 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                                            <Receipt className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600" />
                                            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                                No payment transactions found
                                            </p>
                                            <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                                                No payment transactions match this filter. When subscriptions or invoices are processed, receipts will be listed here.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {payments.map((p) => {
                                                const statusClass =
                                                    p.status === 'successful'
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                                                        : p.status === 'pending'
                                                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                                                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50';

                                                return (
                                                    <div
                                                        key={p.id}
                                                        className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs space-y-1.5"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-zinc-950 dark:text-white text-sm">
                                                                    {p.formatted_amount || `₹${Number(p.amount).toFixed(2)}`}
                                                                </span>
                                                                <span className="text-[10px] text-zinc-400 font-mono uppercase">
                                                                    {p.currency || 'INR'}
                                                                </span>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize border ${statusClass}`}>
                                                                {p.status}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center justify-between text-[11px] text-zinc-500">
                                                            <span>Gateway: {p.gateway} · {formatDate(p.paid_at || p.created_at)}</span>
                                                            <span className="font-mono text-[10px] text-zinc-400 truncate max-w-[140px]">
                                                                Ref: {p.gateway_payment_id || p.gateway_order_id || `#TXN-${p.id}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all cursor-pointer"
                    >
                        Close
                    </button>

                    <div className="flex items-center gap-2">
                        <a
                            href="https://wa.me/917600198889"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                        >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Sales Support</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
