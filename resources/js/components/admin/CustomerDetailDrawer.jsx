import React, { useState, useEffect } from 'react';
import {
    X,
    Building2,
    Calendar,
    CheckCircle2,
    AlertTriangle,
    CreditCard,
    Shield,
    Clock,
    UserX,
    UserCheck,
    History,
    ChevronDown,
    ChevronUp,
    Zap,
    Receipt,
    Loader2,
    Coins,
    BarChart3,
    ArrowRight,
    RefreshCw
} from 'lucide-react';
import {
    fetchWorkspaceSubscriptionHistory,
    fetchPaymentTransactions
} from '../../services/platformAdminApi';

export default function CustomerDetailDrawer({
    customer,
    isOpen,
    onClose,
    onSuspendClick,
    onActivateClick,
    onManageWorkspacePlan
}) {
    const [activeTab, setActiveTab] = useState('subscriptions'); // subscriptions | payments | activity
    const [expandedHistoryWsId, setExpandedHistoryWsId] = useState(null);
    const [wsHistoryData, setWsHistoryData] = useState({});
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    // Payments state
    const [paymentTransactions, setPaymentTransactions] = useState([]);
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
    const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);

    // Reset tab and expanded history on customer change
    useEffect(() => {
        if (isOpen && customer) {
            setActiveTab('subscriptions');
            setExpandedHistoryWsId(null);
            setWsHistoryData({});
            setPaymentTransactions([]);
            setPaymentStatusFilter('all');
        }
    }, [isOpen, customer?.id]);

    // Load payments when switching to payments tab or changing filter
    useEffect(() => {
        if (isOpen && customer && activeTab === 'payments') {
            loadPayments();
        }
    }, [isOpen, customer?.id, activeTab, paymentStatusFilter]);

    const loadPayments = async () => {
        if (!customer) return;
        setIsPaymentsLoading(true);
        try {
            const res = await fetchPaymentTransactions({
                customerId: customer.id,
                status: paymentStatusFilter,
                perPage: 50,
            });
            if (res.success && Array.isArray(res.transactions)) {
                setPaymentTransactions(res.transactions);
            } else {
                setPaymentTransactions([]);
            }
        } catch (err) {
            console.error('Failed to load customer payment transactions:', err);
            setPaymentTransactions([]);
        } finally {
            setIsPaymentsLoading(false);
        }
    };

    const handleToggleSubscriptionHistory = async (workspaceId) => {
        if (expandedHistoryWsId === workspaceId) {
            setExpandedHistoryWsId(null);
            return;
        }

        setExpandedHistoryWsId(workspaceId);

        // Fetch history if not already cached
        if (!wsHistoryData[workspaceId]) {
            setIsHistoryLoading(true);
            try {
                const res = await fetchWorkspaceSubscriptionHistory(workspaceId);
                if (res.success && Array.isArray(res.history)) {
                    setWsHistoryData((prev) => ({ ...prev, [workspaceId]: res.history }));
                } else {
                    setWsHistoryData((prev) => ({ ...prev, [workspaceId]: [] }));
                }
            } catch (err) {
                console.error('Failed to fetch workspace subscription history:', err);
                setWsHistoryData((prev) => ({ ...prev, [workspaceId]: [] }));
            } finally {
                setIsHistoryLoading(false);
            }
        }
    };

    if (!isOpen || !customer) return null;

    const isSuspended = customer.status === 'suspended';

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

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden select-none transition-colors">
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
                <div className="w-screen max-w-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xl flex flex-col border-l border-slate-200 dark:border-zinc-800">
                    {/* Drawer Header */}
                    <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-950/50 shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="size-10 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-sm flex items-center justify-center shrink-0">
                                {customer.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{customer.name}</h3>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{customer.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Navigation Tabs matching admincn */}
                    <div className="flex border-b border-slate-200 dark:border-zinc-800 px-6 bg-slate-50/30 dark:bg-zinc-950/30 shrink-0 gap-1">
                        <button
                            onClick={() => setActiveTab('subscriptions')}
                            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                                activeTab === 'subscriptions'
                                    ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                                    : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                            }`}
                        >
                            <CreditCard className="w-3.5 h-3.5" />
                            Workspaces & Plans ({customer.workspaces?.length || 0})
                        </button>
                        <button
                            onClick={() => setActiveTab('payments')}
                            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                                activeTab === 'payments'
                                    ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                                    : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                            }`}
                        >
                            <Receipt className="w-3.5 h-3.5" />
                            Payment History
                        </button>
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                                activeTab === 'activity'
                                    ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                                    : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                            }`}
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Activity & Audit
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                        {/* Status Alert Banner */}
                        {isSuspended ? (
                            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50">
                                <div className="flex items-start gap-2.5">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-rose-900 dark:text-rose-300">Account is Suspended</p>
                                        <p className="text-xs text-rose-800 dark:text-rose-400 mt-0.5">
                                            Reason: <span className="font-medium italic">{customer.suspension_reason || 'Policy hold'}</span>
                                        </p>
                                        {customer.suspended_at && (
                                            <p className="text-[10px] text-rose-700 dark:text-rose-500 mt-1 font-mono">
                                                Date: {formatDateTime(customer.suspended_at)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {/* TAB 1: WORKSPACES & SUBSCRIPTIONS */}
                        {activeTab === 'subscriptions' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                                        Workspace-Wise Subscriptions & Quota
                                    </h4>
                                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                                        {customer.workspaces?.length || 0} active affiliations
                                    </span>
                                </div>

                                {customer.workspaces && customer.workspaces.length > 0 ? (
                                    customer.workspaces.map((ws) => {
                                        const plan = ws.plan || {};
                                        const sub = ws.subscription || {};
                                        const quota = ws.quota || {};
                                        const isWsSuspended = ws.status === 'suspended';
                                        const isPaidPlan = plan.price > 0;
                                        const isUnlimited = quota.is_unlimited || plan.monthly_scan_allowance === -1;
                                        const usedCredits = quota.used_credits ?? 0;
                                        const allowance = isUnlimited ? 'Unlimited' : (quota.monthly_allowance ?? plan.monthly_scan_allowance ?? 50);
                                        const remaining = isUnlimited ? 'Unlimited' : (quota.remaining_credits ?? Math.max(0, allowance - usedCredits));

                                        const usagePercent = isUnlimited
                                            ? 0
                                            : Math.min(100, Math.round((usedCredits / (allowance || 1)) * 100));

                                        const isHistoryExpanded = expandedHistoryWsId === ws.id;
                                        const histories = wsHistoryData[ws.id] || [];

                                        return (
                                            <div
                                                key={ws.id}
                                                className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-xs space-y-3.5 transition-colors"
                                            >
                                                {/* Workspace Top Row */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="size-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0 border border-slate-200/70 dark:border-zinc-700">
                                                            <Building2 className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                                {ws.name}
                                                            </h5>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                                                                    {ws.role || (ws.is_owner ? 'owner' : 'member')}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                                                                    id: {ws.id}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {isWsSuspended ? (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                                                                Workspace Suspended
                                                            </span>
                                                        ) : (
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                                                sub.status === 'active'
                                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                                                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                                                            }`}>
                                                                {sub.status === 'active' ? 'Active' : (sub.status || 'Active')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Subscription Plan & Billing Card */}
                                                <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-zinc-900/70 border border-slate-200/60 dark:border-zinc-800/80 space-y-2">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                                isPaidPlan
                                                                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                                                                    : 'bg-slate-200/60 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-300/50 dark:border-zinc-700'
                                                            }`}>
                                                                {plan.name || 'Free Plan'}
                                                            </span>
                                                            <span className="font-extrabold text-slate-900 dark:text-white">
                                                                {isPaidPlan ? `₹${Number(plan.price).toLocaleString('en-IN')}` : '₹0.00'}
                                                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal ml-0.5">/ mo</span>
                                                            </span>
                                                        </div>

                                                        {sub.assignment_source && (
                                                            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
                                                                Source: {sub.assignment_source === 'admin_assigned' ? 'Admin Assigned' : sub.assignment_source === 'system_free' ? 'Free Tier' : 'Checkout'}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Billing Period Dates */}
                                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-200/50 dark:border-zinc-800/50">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3 text-slate-400" />
                                                            Billing Cycle
                                                        </span>
                                                        <span className="font-mono text-slate-700 dark:text-zinc-300">
                                                            {formatDate(sub.current_period_starts_at)} — {formatDate(sub.current_period_ends_at)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Quota Progress Bar */}
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                                                            Monthly Scans Used
                                                        </span>
                                                        <span className="font-semibold text-slate-800 dark:text-zinc-200 text-xs">
                                                            {usedCredits} / {allowance} {isUnlimited ? '' : `(${remaining} remaining)`}
                                                        </span>
                                                    </div>

                                                    {!isUnlimited && (
                                                        <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden border border-slate-200/50 dark:border-zinc-700">
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
                                                    )}
                                                </div>

                                                {/* Action Buttons: Manage Plan & Subscription History */}
                                                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => onManageWorkspacePlan?.(ws.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-400 text-xs font-semibold border border-orange-200 dark:border-orange-900/50 transition-colors cursor-pointer"
                                                    >
                                                        <Zap className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                                                        Manage Plan
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleSubscriptionHistory(ws.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold border border-slate-200 dark:border-zinc-700 transition-colors cursor-pointer"
                                                    >
                                                        <History className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>History</span>
                                                        {isHistoryExpanded ? (
                                                            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                                        ) : (
                                                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                                        )}
                                                    </button>
                                                </div>

                                                {/* Expandable Subscription History Section */}
                                                {isHistoryExpanded && (
                                                    <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                                Immutable Plan Audit History
                                                            </p>
                                                            {isHistoryLoading && (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                                                            )}
                                                        </div>

                                                        {histories.length === 0 ? (
                                                            <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-zinc-900/50 border border-slate-200/50 dark:border-zinc-800 text-center text-xs text-slate-400 dark:text-zinc-500">
                                                                No prior subscription change logs for this workspace.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                                                {histories.map((h) => {
                                                                    const sourceLabel =
                                                                        h.assignment_source === 'admin_assigned'
                                                                            ? 'Platform Admin'
                                                                            : h.assignment_source === 'system_free'
                                                                            ? 'System Free'
                                                                            : 'Online Checkout';

                                                                    return (
                                                                        <div
                                                                            key={h.id}
                                                                            className="p-2.5 rounded-lg border border-slate-200/70 dark:border-zinc-800/80 bg-slate-50/40 dark:bg-zinc-900/50 space-y-1 text-xs"
                                                                        >
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                                                                                    {h.previous_plan_name ? (
                                                                                        <>
                                                                                            <span className="line-through text-slate-400 dark:text-zinc-500 font-normal">
                                                                                                {h.previous_plan_name}
                                                                                            </span>
                                                                                            <ArrowRight className="w-3 h-3 text-slate-400" />
                                                                                        </>
                                                                                    ) : null}
                                                                                    <span>{h.plan_name || 'Free Plan'}</span>
                                                                                </div>
                                                                                <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500">
                                                                                    {formatDateTime(h.created_at)}
                                                                                </span>
                                                                            </div>

                                                                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                                                                                <span>Source: {sourceLabel}</span>
                                                                                {h.assigned_by_admin?.name && (
                                                                                    <span className="text-[10px] text-slate-600 dark:text-zinc-400">
                                                                                        by {h.assigned_by_admin.name}
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            {h.reason && (
                                                                                <p className="text-[11px] text-slate-600 dark:text-zinc-300 italic bg-white dark:bg-zinc-950 p-1.5 rounded border border-slate-100 dark:border-zinc-800/60">
                                                                                    "{h.reason}"
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center">
                                        <Building2 className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
                                        <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">No workspaces affiliated</p>
                                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">This customer has not created or joined any workspaces yet.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 2: PAYMENT TRANSACTIONS */}
                        {activeTab === 'payments' && (
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                    <div>
                                        <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                                            Payment Transactions
                                        </h4>
                                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                                            Recorded gateway purchases and payment history
                                        </p>
                                    </div>

                                    {/* Status Filter */}
                                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5 border border-slate-200/70 dark:border-zinc-700 shrink-0">
                                        {['all', 'successful', 'pending', 'failed', 'refunded'].map((status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => setPaymentStatusFilter(status)}
                                                className={`px-2.5 py-1 rounded-md text-[10px] font-medium capitalize transition-all cursor-pointer ${
                                                    paymentStatusFilter === status
                                                        ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                                                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                                                }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {isPaymentsLoading ? (
                                    <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-500 mb-2" />
                                        Loading payment transactions...
                                    </div>
                                ) : paymentTransactions.length === 0 ? (
                                    <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center space-y-2">
                                        <Receipt className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-700" />
                                        <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                            No payment transactions recorded
                                        </p>
                                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 max-w-xs mx-auto">
                                            No payment transactions match this filter for {customer.name}. Online checkouts will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {paymentTransactions.map((tx) => {
                                            const statusClass =
                                                tx.status === 'successful'
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                                                    : tx.status === 'pending'
                                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                                                    : tx.status === 'refunded'
                                                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/50'
                                                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50';

                                            return (
                                                <div
                                                    key={tx.id}
                                                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2 shadow-xs text-xs"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                                                                {tx.formatted_amount || `₹${Number(tx.amount).toFixed(2)}`}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-mono">
                                                                {tx.currency || 'INR'}
                                                            </span>
                                                        </div>

                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize border ${statusClass}`}>
                                                            {tx.status}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-zinc-400 pt-1.5 border-t border-slate-100 dark:border-zinc-800/80">
                                                        <div>
                                                            <span className="block text-[10px] text-slate-400 dark:text-zinc-500">Workspace / Plan</span>
                                                            <span className="font-medium text-slate-800 dark:text-zinc-200">
                                                                {tx.workspace_name || '—'} · {tx.plan_name || '—'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-[10px] text-slate-400 dark:text-zinc-500">Gateway / Date</span>
                                                            <span className="font-medium text-slate-800 dark:text-zinc-200 capitalize">
                                                                {tx.gateway} · {formatDate(tx.paid_at || tx.created_at)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Reference IDs */}
                                                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 font-mono bg-slate-50 dark:bg-zinc-900 p-1.5 rounded">
                                                        <span className="truncate">Ref: {tx.gateway_payment_id || tx.gateway_order_id || `#TXN-${tx.id}`}</span>
                                                        {tx.safe_metadata?.card_last4 && (
                                                            <span className="shrink-0 ml-2">•••• {tx.safe_metadata.card_last4}</span>
                                                        )}
                                                    </div>

                                                    {tx.error_message && (
                                                        <p className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded border border-rose-200 dark:border-rose-900/50">
                                                            {tx.error_message}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 3: ACTIVITY & AUDIT */}
                        {activeTab === 'activity' && (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2.5">
                                        Account Activity Metrics
                                    </h4>
                                    <div className="grid grid-cols-3 gap-2.5">
                                        <div className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50">
                                            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium block">Total Cards</span>
                                            <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
                                                {customer.activity?.cards_count ?? customer.cards_count ?? 0}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50">
                                            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium block">Total Scans</span>
                                            <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
                                                {customer.activity?.scans_count ?? customer.scans_count ?? 0}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50">
                                            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium block">Bulk Batches</span>
                                            <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
                                                {customer.activity?.bulk_batches_count ?? 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Metadata Details */}
                                <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2 text-xs">
                                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800">
                                        <span className="text-slate-500 dark:text-zinc-400">Customer ID</span>
                                        <span className="font-mono text-slate-800 dark:text-zinc-200">#{customer.id}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800">
                                        <span className="text-slate-500 dark:text-zinc-400">Registration Date</span>
                                        <span className="font-mono text-slate-800 dark:text-zinc-200">
                                            {formatDate(customer.created_at)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-slate-500 dark:text-zinc-400">Current Status</span>
                                        <span className={`font-semibold capitalize ${isSuspended ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            {customer.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Audit Trail Logs */}
                                {customer.audit_history && customer.audit_history.length > 0 && (
                                    <div>
                                        <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                                            Administrative Audit Trail
                                        </h4>
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                            {customer.audit_history.map((log) => (
                                                <div
                                                    key={log.id}
                                                    className="p-2.5 rounded-lg border border-slate-200/70 dark:border-zinc-800/80 bg-slate-50/40 dark:bg-zinc-900/50 text-xs"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                                                            {log.action}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                                                            {formatDateTime(log.created_at)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                                        by {log.admin_name}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 flex items-center justify-between shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        >
                            Close
                        </button>
                        <div>
                            {isSuspended ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onActivateClick(customer);
                                    }}
                                    className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                                >
                                    <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                                    Activate Account
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onSuspendClick(customer);
                                    }}
                                    className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
                                >
                                    <UserX className="w-3.5 h-3.5 mr-1.5" />
                                    Suspend Account
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
