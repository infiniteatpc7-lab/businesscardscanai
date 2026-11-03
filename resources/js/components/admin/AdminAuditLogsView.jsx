import React, { useState, useEffect } from 'react';
import {
    FileText,
    Search,
    Shield,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Eye,
    X,
    Filter,
    UserCheck,
    UserX,
    Building2,
    LogIn,
    LogOut,
    Lock
} from 'lucide-react';
import { fetchAdminAuditLogs } from '../../services/platformAdminApi';

export default function AdminAuditLogsView() {
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Detail modal state for inspected log
    const [selectedLog, setSelectedLog] = useState(null);

    const loadAuditLogs = async (page = 1) => {
        setIsLoading(true);
        try {
            const res = await fetchAdminAuditLogs({
                page,
                perPage: 25,
                search: searchQuery.trim(),
                action: actionFilter,
            });
            if (res.success && Array.isArray(res.logs)) {
                setLogs(res.logs);
                setPagination(res.pagination || { current_page: 1, last_page: 1, total: 0 });
            }
        } catch (err) {
            console.error('Failed to load audit logs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            loadAuditLogs(1);
        }, 250);
        return () => clearTimeout(timer);
    }, [searchQuery, actionFilter]);

    const getActionBadge = (action) => {
        switch (action) {
            case 'customer.suspended':
                return {
                    label: 'Customer Suspended',
                    icon: UserX,
                    classes: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
                };
            case 'customer.activated':
                return {
                    label: 'Customer Activated',
                    icon: UserCheck,
                    classes: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
                };
            case 'workspace.suspended':
                return {
                    label: 'Workspace Suspended',
                    icon: Building2,
                    classes: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
                };
            case 'workspace.activated':
                return {
                    label: 'Workspace Activated',
                    icon: Building2,
                    classes: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-900/50',
                };
            case 'admin.login':
                return {
                    label: 'Admin Login',
                    icon: LogIn,
                    classes: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
                };
            case 'admin.logout':
                return {
                    label: 'Admin Logout',
                    icon: LogOut,
                    classes: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
                };
            default:
                return {
                    label: action,
                    icon: Shield,
                    classes: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
                };
        }
    };

    return (
        <div className="space-y-5 select-none transition-colors">
            {/* Header & Immutability Notice */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Platform Audit Trail</h2>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-900/50">
                                <Lock className="w-2.5 h-2.5" />
                                Immutable
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                            Cryptographically logged administrative actions and security events
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-800 dark:text-zinc-200 font-medium"
                        >
                            <option value="">All Actions</option>
                            <option value="customer.suspended">Customer Suspended</option>
                            <option value="customer.activated">Customer Activated</option>
                            <option value="workspace.suspended">Workspace Suspended</option>
                            <option value="workspace.activated">Workspace Activated</option>
                            <option value="admin.login">Admin Login</option>
                            <option value="admin.logout">Admin Logout</option>
                        </select>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search audit trail by admin, action name or IP address..."
                        className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    />
                </div>
            </div>

            {/* Audit Logs Table Card matching admincn */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/90 text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                <th className="py-3 px-4">Timestamp</th>
                                <th className="py-3 px-4">Action</th>
                                <th className="py-3 px-4">Admin</th>
                                <th className="py-3 px-4">Target</th>
                                <th className="py-3 px-4">IP Address</th>
                                <th className="py-3 px-4 text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-xs text-slate-700 dark:text-zinc-300">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-slate-400 dark:text-zinc-500">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-500 mb-2" />
                                        Loading audit log entries...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-slate-400 dark:text-zinc-500">
                                        <Shield className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto mb-2" />
                                        No audit records matching your filter.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => {
                                    const badge = getActionBadge(log.action);
                                    const Icon = badge.icon;
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                                                {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${badge.classes}`}>
                                                    <Icon className="w-3 h-3" />
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                {log.admin ? (
                                                    <div>
                                                        <p className="font-semibold text-slate-900 dark:text-white">{log.admin.name}</p>
                                                        <p className="text-[11px] text-slate-400 dark:text-zinc-500">{log.admin.email}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-zinc-500 italic text-[11px]">System / CLI</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {log.target_type ? (
                                                    <span className="font-mono text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[11px] border border-slate-200/60 dark:border-zinc-700">
                                                        {log.target_type} #{log.target_id}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-zinc-500 italic text-[11px]">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400 text-[11px]">
                                                {log.ip_address || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-[11px] font-medium cursor-pointer"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>View</span>
                                                </button>
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
                            {logs.length > 0 ? (pagination.current_page - 1) * 25 + 1 : 0}
                        </span> to <span className="font-semibold text-slate-800 dark:text-zinc-200">
                            {Math.min(pagination.current_page * 25, pagination.total)}
                        </span> of <span className="font-semibold text-slate-800 dark:text-zinc-200">{pagination.total}</span> logs
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            disabled={pagination.current_page <= 1 || isLoading}
                            onClick={() => loadAuditLogs(pagination.current_page - 1)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-slate-800 dark:text-zinc-200 font-medium px-2">
                            {pagination.current_page} / {pagination.last_page || 1}
                        </span>
                        <button
                            disabled={pagination.current_page >= pagination.last_page || isLoading}
                            onClick={() => loadAuditLogs(pagination.current_page + 1)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Audit Log Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Audit Record #{selectedLog.id}</h3>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-1 rounded-lg cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                                <div>
                                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-semibold">Action</span>
                                    <span className="font-semibold text-slate-800 dark:text-zinc-200">{selectedLog.action}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-semibold">Timestamp</span>
                                    <span className="text-slate-700 dark:text-zinc-300 font-mono text-[11px]">{new Date(selectedLog.created_at).toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-semibold">Administrator</span>
                                    <span className="text-slate-700 dark:text-zinc-300">{selectedLog.admin?.name || 'System / CLI'} ({selectedLog.admin?.email || 'N/A'})</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-semibold">IP Address</span>
                                    <span className="font-mono text-slate-700 dark:text-zinc-300">{selectedLog.ip_address || '—'}</span>
                                </div>
                            </div>

                            {selectedLog.user_agent && (
                                <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-semibold mb-1">User Agent</span>
                                    <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono break-all">{selectedLog.user_agent}</span>
                                </div>
                            )}

                            <div>
                                <span className="text-slate-600 dark:text-zinc-400 block text-xs font-semibold mb-1.5">Action Details & Payload</span>
                                <pre className="p-3 bg-slate-900 dark:bg-black text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-60 leading-relaxed border border-slate-800 dark:border-zinc-800">
                                    {JSON.stringify(selectedLog.details, null, 2)}
                                </pre>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedLog(null)}
                                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
