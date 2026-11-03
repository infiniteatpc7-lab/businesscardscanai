import React, { useState, useEffect } from 'react';
import {
    Search,
    Filter,
    Building2,
    CheckCircle2,
    AlertTriangle,
    Eye,
    UserX,
    UserCheck,
    Users,
    CreditCard,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Loader2
} from 'lucide-react';
import {
    fetchAdminWorkspaces,
    fetchAdminWorkspaceDetails,
    suspendWorkspace,
    activateWorkspace
} from '../../services/platformAdminApi';
import WorkspaceDetailDrawer from './WorkspaceDetailDrawer';

export default function AdminWorkspacesView() {
    const [workspaces, setWorkspaces] = useState([]);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | active | suspended
    const [isLoading, setIsLoading] = useState(false);

    // Detail drawer state
    const [selectedWorkspace, setSelectedWorkspace] = useState(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);

    // Suspend modal state
    const [suspendingWorkspace, setSuspendingWorkspace] = useState(null);
    const [suspendReason, setSuspendReason] = useState('');
    const [isActionPending, setIsActionPending] = useState(false);
    const [actionToast, setActionToast] = useState(null);

    const showToast = (message, type = 'info') => {
        setActionToast({ message, type });
        setTimeout(() => setActionToast(null), 4000);
    };

    const loadWorkspaces = async (page = 1) => {
        setIsLoading(true);
        try {
            const res = await fetchAdminWorkspaces({
                page,
                search: searchQuery.trim(),
                status: statusFilter,
            });
            if (res.success && Array.isArray(res.workspaces)) {
                setWorkspaces(res.workspaces);
                setPagination(res.pagination || { current_page: 1, last_page: 1, total: 0 });
            }
        } catch (err) {
            console.error('Failed to load workspaces:', err);
            showToast('Failed to load workspaces', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            loadWorkspaces(1);
        }, 250);
        return () => clearTimeout(timer);
    }, [searchQuery, statusFilter]);

    const handleOpenWorkspaceDetails = async (id) => {
        setIsDetailLoading(true);
        try {
            const res = await fetchAdminWorkspaceDetails(id);
            if (res.success && res.workspace) {
                setSelectedWorkspace(res.workspace);
            }
        } catch (err) {
            console.error('Workspace details error:', err);
            showToast('Unable to load workspace details', 'error');
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleConfirmSuspend = async () => {
        if (!suspendingWorkspace || !suspendReason.trim()) return;
        setIsActionPending(true);
        try {
            const res = await suspendWorkspace(suspendingWorkspace.id, suspendReason.trim());
            if (res.success) {
                showToast(`Workspace "${suspendingWorkspace.name}" has been suspended`, 'success');
                setSuspendingWorkspace(null);
                setSuspendReason('');
                loadWorkspaces(pagination.current_page);
                if (selectedWorkspace?.id === suspendingWorkspace.id) {
                    setSelectedWorkspace(null);
                }
            } else {
                showToast(res.message || 'Suspension failed', 'error');
            }
        } catch (err) {
            console.error('Suspend error:', err);
            showToast('Failed to suspend workspace', 'error');
        } finally {
            setIsActionPending(false);
        }
    };

    const handleConfirmActivate = async (ws) => {
        if (!confirm(`Are you sure you want to reactivate the workspace "${ws.name}"?`)) {
            return;
        }
        setIsActionPending(true);
        try {
            const res = await activateWorkspace(ws.id);
            if (res.success) {
                showToast(`Workspace "${ws.name}" is now active`, 'success');
                loadWorkspaces(pagination.current_page);
                if (selectedWorkspace?.id === ws.id) {
                    setSelectedWorkspace(null);
                }
            } else {
                showToast(res.message || 'Activation failed', 'error');
            }
        } catch (err) {
            console.error('Activate error:', err);
            showToast('Failed to activate workspace', 'error');
        } finally {
            setIsActionPending(false);
        }
    };

    return (
        <div className="space-y-5 select-none transition-colors">
            {/* Notification Toast */}
            {actionToast && (
                <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
                    actionToast.type === 'error'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-400'
                        : actionToast.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200'
                }`}>
                    <span>{actionToast.message}</span>
                    <button onClick={() => setActionToast(null)} className="font-bold ml-4 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200">✕</button>
                </div>
            )}

            {/* Filter & Search Bar */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Workspaces Directory</h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                            Multi-tenant workspaces, team allocations, and event archives
                        </p>
                    </div>

                    {/* Segmented Filter Buttons */}
                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5 border border-slate-200/70 dark:border-zinc-700">
                        {['all', 'active', 'suspended'].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setStatusFilter(filter)}
                                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all cursor-pointer ${
                                    statusFilter === filter
                                        ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Search Input */}
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search workspaces by name, slug, owner name or email..."
                        className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    />
                </div>
            </div>

            {/* Workspaces Table Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/90 text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                <th className="py-3 px-4">Workspace</th>
                                <th className="py-3 px-4">Owner</th>
                                <th className="py-3 px-4 text-center">Members</th>
                                <th className="py-3 px-4 text-center">Cards</th>
                                <th className="py-3 px-4 text-center">Events</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-xs text-slate-700 dark:text-zinc-300">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-slate-400 dark:text-zinc-500">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-500 mb-2" />
                                        Loading workspaces...
                                    </td>
                                </tr>
                            ) : workspaces.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-slate-400 dark:text-zinc-500">
                                        <Building2 className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto mb-2" />
                                        No workspaces found matching your query.
                                    </td>
                                </tr>
                            ) : (
                                workspaces.map((ws) => {
                                    const isSuspended = ws.status === 'suspended';
                                    return (
                                        <tr key={ws.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center border border-slate-200 dark:border-zinc-700 shrink-0">
                                                        <Building2 className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-slate-900 dark:text-white truncate">{ws.name}</p>
                                                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">/{ws.slug}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                {ws.owner ? (
                                                    <div>
                                                        <p className="font-semibold text-slate-900 dark:text-white">{ws.owner.name}</p>
                                                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">{ws.owner.email}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-zinc-500 italic text-[11px]">None</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center font-bold text-slate-900 dark:text-white">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px]">
                                                    <Users className="w-3 h-3 text-slate-400" />
                                                    {ws.members_count}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center font-bold text-slate-900 dark:text-white">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px]">
                                                    <CreditCard className="w-3 h-3 text-slate-400" />
                                                    {ws.cards_count}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center font-bold text-slate-900 dark:text-white">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px]">
                                                    <Calendar className="w-3 h-3 text-slate-400" />
                                                    {ws.exhibitions_count}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                                                    isSuspended
                                                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                                                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                                                }`}>
                                                    <span className={`size-1.5 rounded-full ${isSuspended ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                                    {isSuspended ? 'Suspended' : 'Active'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleOpenWorkspaceDetails(ws.id)}
                                                        title="View details"
                                                        className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {isSuspended ? (
                                                        <button
                                                            onClick={() => handleConfirmActivate(ws)}
                                                            title="Reactivate workspace"
                                                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            <UserCheck className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setSuspendingWorkspace(ws);
                                                                setSuspendReason('');
                                                            }}
                                                            title="Suspend workspace"
                                                            className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            <UserX className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 border-t border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                    <div>
                        Showing <span className="font-semibold text-slate-800 dark:text-zinc-200">
                            {workspaces.length > 0 ? (pagination.current_page - 1) * 15 + 1 : 0}
                        </span> to <span className="font-semibold text-slate-800 dark:text-zinc-200">
                            {Math.min(pagination.current_page * 15, pagination.total)}
                        </span> of <span className="font-semibold text-slate-800 dark:text-zinc-200">{pagination.total}</span> workspaces
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            disabled={pagination.current_page <= 1 || isLoading}
                            onClick={() => loadWorkspaces(pagination.current_page - 1)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-slate-800 dark:text-zinc-200 font-medium px-2">
                            {pagination.current_page} / {pagination.last_page || 1}
                        </span>
                        <button
                            disabled={pagination.current_page >= pagination.last_page || isLoading}
                            onClick={() => loadWorkspaces(pagination.current_page + 1)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Suspend Confirmation Modal */}
            {suspendingWorkspace && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Suspend Workspace</h3>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">Workspace data hold</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                            You are about to suspend <span className="font-semibold text-slate-900 dark:text-white">{suspendingWorkspace.name}</span>.
                            Team members will be restricted from scanning cards or modifying workspace entries until reactivated.
                            Customer data is safely preserved.
                        </p>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                                Reason for suspension <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                rows={3}
                                placeholder="E.g., Payment dispute, terms violation, requested hold..."
                                className="w-full p-2.5 text-xs border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-slate-900 dark:text-white"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setSuspendingWorkspace(null)}
                                disabled={isActionPending}
                                className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSuspend}
                                disabled={!suspendReason.trim() || isActionPending}
                                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                                {isActionPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                                Suspend Workspace
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Workspace Detail Drawer */}
            <WorkspaceDetailDrawer
                workspace={selectedWorkspace}
                isOpen={Boolean(selectedWorkspace)}
                onClose={() => setSelectedWorkspace(null)}
                onSuspendClick={(ws) => {
                    setSuspendingWorkspace(ws);
                    setSuspendReason('');
                }}
                onActivateClick={(ws) => handleConfirmActivate(ws)}
            />
        </div>
    );
}
