import React, { useState, useEffect } from 'react';
import {
    X,
    Building2,
    CheckCircle2,
    AlertTriangle,
    Users,
    CreditCard,
    Calendar,
    Clock,
    UserX,
    UserCheck,
    Mail,
    User,
    Zap,
    Loader2,
    History,
    ChevronDown,
    ChevronUp,
    ArrowRight
} from 'lucide-react';
import {
    fetchAdminPlans,
    changeWorkspacePlan,
    fetchWorkspaceSubscriptionHistory
} from '../../services/platformAdminApi';

export default function WorkspaceDetailDrawer({
    workspace,
    isOpen,
    onClose,
    onSuspendClick,
    onActivateClick,
    onPlanChanged
}) {
    const [availablePlans, setAvailablePlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [isChangingPlan, setIsChangingPlan] = useState(false);
    const [planChangeMsg, setPlanChangeMsg] = useState(null);

    // Subscription History state
    const [showHistory, setShowHistory] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    useEffect(() => {
        if (isOpen && workspace) {
            setSelectedPlanId(workspace.plan?.id ? String(workspace.plan.id) : '');
            setPlanChangeMsg(null);
            setShowHistory(false);
            setHistoryList([]);
            fetchAdminPlans().then((res) => {
                if (res.success && Array.isArray(res.plans)) {
                    setAvailablePlans(res.plans);
                    if (!workspace.plan?.id && res.plans.length > 0) {
                        setSelectedPlanId(String(res.plans[0].id));
                    }
                }
            });
        }
    }, [isOpen, workspace]);

    const handleToggleHistory = async () => {
        if (showHistory) {
            setShowHistory(false);
            return;
        }

        setShowHistory(true);
        if (workspace?.id) {
            setIsHistoryLoading(true);
            try {
                const res = await fetchWorkspaceSubscriptionHistory(workspace.id);
                if (res.success && Array.isArray(res.history)) {
                    setHistoryList(res.history);
                }
            } catch (err) {
                console.error('Failed to load history:', err);
            } finally {
                setIsHistoryLoading(false);
            }
        }
    };

    if (!isOpen || !workspace) return null;

    const isSuspended = workspace.status === 'suspended';

    const handleSavePlanChange = async () => {
        if (!selectedPlanId || Number(selectedPlanId) === workspace.plan?.id) return;
        setIsChangingPlan(true);
        setPlanChangeMsg(null);
        try {
            const res = await changeWorkspacePlan(workspace.id, Number(selectedPlanId), 'Admin updated plan');
            if (res.success) {
                setPlanChangeMsg({ type: 'success', text: res.message });
                onPlanChanged?.();
            } else {
                setPlanChangeMsg({ type: 'error', text: res.message || 'Failed to change plan.' });
            }
        } catch (err) {
            console.error('Plan change error:', err);
            setPlanChangeMsg({ type: 'error', text: 'Network error occurred.' });
        } finally {
            setIsChangingPlan(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden select-none transition-colors">
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div className="w-screen max-w-md bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xl flex flex-col border-l border-slate-200 dark:border-zinc-800">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-950/50">
                        <div className="flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center border border-slate-200 dark:border-zinc-700">
                                <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{workspace.name}</h3>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">slug: {workspace.slug}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
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
                                        <p className="text-xs font-bold text-rose-900 dark:text-rose-300">Workspace is Suspended</p>
                                        <p className="text-xs text-rose-800 dark:text-rose-400 mt-0.5">
                                            Reason: <span className="font-medium italic">{workspace.suspension_reason || 'Administrative action'}</span>
                                        </p>
                                        {workspace.suspended_at && (
                                            <p className="text-[10px] text-rose-700 dark:text-rose-500 mt-1 font-mono">
                                                Date: {new Date(workspace.suspended_at).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/50 flex items-center gap-2.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">Workspace is Active</p>
                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">All member operations and cards operate normally.</p>
                                </div>
                            </div>
                        )}

                        {/* Owner Profile Card */}
                        <div className="bg-slate-50/70 dark:bg-zinc-950/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-zinc-800">
                            <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Workspace Owner</h4>
                            {workspace.owner ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="size-8 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center">
                                            {workspace.owner.name?.charAt(0)?.toUpperCase() || 'U'}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-900 dark:text-white">{workspace.owner.name}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-zinc-400">{workspace.owner.email}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                        workspace.owner.status === 'suspended'
                                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                                    }`}>
                                        {workspace.owner.status}
                                    </span>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 dark:text-zinc-500 italic">No owner assigned</p>
                            )}
                        </div>

                        {/* Subscription & Quota Card */}
                        <div className="bg-slate-50/70 dark:bg-zinc-950/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-zinc-800 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                                    Subscription & Quota
                                </h4>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                                    {workspace.plan?.name || 'Free Tier'}
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 dark:text-zinc-400">Monthly Scan Allowance</span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {(workspace.plan?.monthly_scan_allowance ?? 50).toLocaleString()} credits / mo
                                </span>
                            </div>

                            {/* Plan Change UI */}
                            <div className="pt-2 border-t border-slate-200/70 dark:border-zinc-800/80">
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
                                    Assign Plan Manually
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedPlanId}
                                        onChange={(e) => setSelectedPlanId(e.target.value)}
                                        className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    >
                                        {availablePlans.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.monthly_scan_allowance === -1 ? 'Unlimited' : p.monthly_scan_allowance.toLocaleString()} scans - {p.price == 0 ? 'Free' : `₹${Number(p.price).toLocaleString('en-IN')}`}/mo)
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleSavePlanChange}
                                        disabled={isChangingPlan || Number(selectedPlanId) === workspace.plan?.id}
                                        className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shrink-0 inline-flex items-center gap-1"
                                    >
                                        {isChangingPlan ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Zap className="w-3.5 h-3.5" />
                                        )}
                                        Apply
                                    </button>
                                </div>
                                {planChangeMsg && (
                                    <p className={`text-[11px] mt-1.5 font-medium ${
                                        planChangeMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                    }`}>
                                        {planChangeMsg.text}
                                    </p>
                                )}
                            </div>

                            {/* View Subscription History Toggle */}
                            <div className="pt-2 border-t border-slate-200/70 dark:border-zinc-800/80">
                                <button
                                    type="button"
                                    onClick={handleToggleHistory}
                                    className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white py-1 transition-colors cursor-pointer"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <History className="w-3.5 h-3.5 text-slate-400" />
                                        Immutable Subscription History
                                    </span>
                                    {showHistory ? (
                                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                </button>

                                {showHistory && (
                                    <div className="mt-2 space-y-2">
                                        {isHistoryLoading ? (
                                            <div className="py-3 text-center text-xs text-slate-400 dark:text-zinc-500">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-orange-500 mb-1" />
                                                Loading subscription history...
                                            </div>
                                        ) : historyList.length === 0 ? (
                                            <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic text-center py-2">
                                                No plan change history found.
                                            </p>
                                        ) : (
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                {historyList.map((h) => (
                                                    <div
                                                        key={h.id}
                                                        className="p-2 rounded border border-slate-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs space-y-1"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-white text-[11px]">
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
                                                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                                                                {new Date(h.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400">
                                                            <span>
                                                                Source: {h.assignment_source === 'admin_assigned' ? 'Admin Assigned' : h.assignment_source === 'system_free' ? 'System Free' : 'Checkout'}
                                                            </span>
                                                            {h.assigned_by_admin?.name && (
                                                                <span>by {h.assigned_by_admin.name}</span>
                                                            )}
                                                        </div>
                                                        {h.reason && (
                                                            <p className="text-[10px] italic text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-950 p-1 rounded">
                                                                "{h.reason}"
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50">
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 mb-1">
                                    <Users className="w-3.5 h-3.5 text-orange-500" />
                                    <span className="text-[11px] font-medium">Team Members</span>
                                </div>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">{workspace.members?.length || 0}</p>
                            </div>
                            <div className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50">
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 mb-1">
                                    <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-[11px] font-medium">Cards Processed</span>
                                </div>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">{workspace.cards_count ?? 0}</p>
                            </div>
                        </div>

                        {/* Members List */}
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                                Team Members ({workspace.members?.length || 0})
                            </h4>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {workspace.members && workspace.members.length > 0 ? (
                                    workspace.members.map((m) => (
                                        <div key={m.id} className="p-2.5 rounded-lg border border-slate-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="size-6 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[10px] font-semibold flex items-center justify-center shrink-0">
                                                    {m.name?.charAt(0)?.toUpperCase() || 'M'}
                                                </div>
                                                <div className="truncate">
                                                    <p className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{m.name}</p>
                                                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{m.email}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                                                {m.role || 'member'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-400 dark:text-zinc-500 italic">No members found</p>
                                )}
                            </div>
                        </div>

                        {/* Exhibitions */}
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                                Exhibitions ({workspace.exhibitions?.length || 0})
                            </h4>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {workspace.exhibitions && workspace.exhibitions.length > 0 ? (
                                    workspace.exhibitions.map((e) => (
                                        <div key={e.id} className="p-2 rounded-lg border border-slate-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-800 dark:text-zinc-200">{e.name}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 capitalize">
                                                {e.status}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-400 dark:text-zinc-500 italic">No exhibitions created</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 flex items-center justify-between">
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
                                        onActivateClick(workspace);
                                    }}
                                    className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                                >
                                    <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                                    Activate Workspace
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onSuspendClick(workspace);
                                    }}
                                    className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
                                >
                                    <UserX className="w-3.5 h-3.5 mr-1.5" />
                                    Suspend Workspace
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
