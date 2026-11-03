import React from 'react';
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
    User
} from 'lucide-react';

export default function WorkspaceDetailDrawer({
    workspace,
    isOpen,
    onClose,
    onSuspendClick,
    onActivateClick
}) {
    if (!isOpen || !workspace) return null;

    const isSuspended = workspace.status === 'suspended';

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
