import React from 'react';
import {
    X,
    User,
    Mail,
    Building2,
    Calendar,
    CheckCircle2,
    AlertTriangle,
    CreditCard,
    Shield,
    Clock,
    UserX,
    UserCheck
} from 'lucide-react';

export default function CustomerDetailDrawer({
    customer,
    isOpen,
    onClose,
    onSuspendClick,
    onActivateClick
}) {
    if (!isOpen || !customer) return null;

    const isSuspended = customer.status === 'suspended';

    return (
        <div className="fixed inset-0 z-50 overflow-hidden select-none transition-colors">
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div className="w-screen max-w-md bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xl flex flex-col border-l border-slate-200 dark:border-zinc-800">
                    {/* Drawer Header */}
                    <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-950/50">
                        <div className="flex items-center gap-3">
                            <div className="size-9 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center">
                                {customer.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{customer.name}</h3>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">{customer.email}</p>
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
                                        <p className="text-xs font-bold text-rose-900 dark:text-rose-300">Account is Suspended</p>
                                        <p className="text-xs text-rose-800 dark:text-rose-400 mt-0.5">
                                            Reason: <span className="font-medium italic">{customer.suspension_reason || 'Policy hold'}</span>
                                        </p>
                                        {customer.suspended_at && (
                                            <p className="text-[10px] text-rose-700 dark:text-rose-500 mt-1 font-mono">
                                                Date: {new Date(customer.suspended_at).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/50 flex items-center gap-2.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">Account is Active</p>
                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">All customer services operate normally.</p>
                                </div>
                            </div>
                        )}

                        {/* Customer Overview Grid */}
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2.5">
                                Account Overview
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50">
                                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block">Total Cards</span>
                                    <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">{customer.cards_count ?? 0}</span>
                                </div>
                                <div className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50">
                                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block">Workspaces</span>
                                    <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">{customer.workspaces?.length || 0}</span>
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
                                    {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '—'}
                                </span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-slate-500 dark:text-zinc-400">Current Status</span>
                                <span className={`font-semibold capitalize ${isSuspended ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {customer.status}
                                </span>
                            </div>
                        </div>

                        {/* Workspaces List */}
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2.5">
                                Workspaces ({customer.workspaces?.length || 0})
                            </h4>
                            <div className="space-y-2">
                                {customer.workspaces && customer.workspaces.length > 0 ? (
                                    customer.workspaces.map((ws) => (
                                        <div
                                            key={ws.id}
                                            className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="size-7 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                                                    <Building2 className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{ws.name}</p>
                                                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">slug: {ws.slug}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                                                {ws.role || 'Member'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-400 dark:text-zinc-500 italic">No workspaces linked.</p>
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
