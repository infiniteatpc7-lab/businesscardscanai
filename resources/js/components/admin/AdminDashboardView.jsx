import React from 'react';
import {
    Users,
    Building2,
    CreditCard,
    AlertTriangle,
    ArrowUpRight,
    TrendingUp,
    Shield,
    Calendar,
    ArrowRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';

export default function AdminDashboardView({
    stats,
    isLoading,
    onNavigateTab,
    onSelectCustomer
}) {
    if (isLoading && !stats) {
        return (
            <div className="space-y-6 select-none">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-80 rounded-xl" />
                    <Skeleton className="h-80 rounded-xl" />
                </div>
            </div>
        );
    }

    const metrics = stats?.metrics || {
        customers: { total: 0, active: 0, suspended: 0, recent_30_days: 0 },
        workspaces: { total: 0, active: 0, suspended: 0 },
        activity: { total_cards: 0, total_scans: 0, bulk_batches: 0 },
    };

    const recentCustomers = stats?.recent_customers || [];
    const recentAuditLogs = stats?.recent_audit_logs || [];

    // Exact statistics cards matching admincn (statistics-card-01.tsx)
    const statCards = [
        {
            title: 'Total Customers',
            value: metrics.customers.total.toLocaleString(),
            icon: Users,
            changePercentage: `${metrics.customers.active} Active`,
            subText: `${metrics.customers.recent_30_days} new in 30 days`,
            tab: 'customers',
        },
        {
            title: 'Active Workspaces',
            value: metrics.workspaces.total.toLocaleString(),
            icon: Building2,
            changePercentage: `${metrics.workspaces.active} Active`,
            subText: `${metrics.workspaces.suspended} suspended`,
            tab: 'workspaces',
        },
        {
            title: 'Cards Processed',
            value: metrics.activity.total_cards.toLocaleString(),
            icon: CreditCard,
            changePercentage: `${metrics.activity.total_scans} Scans`,
            subText: `${metrics.activity.bulk_batches} bulk batches`,
            tab: 'customers',
        },
        {
            title: 'Security Suspensions',
            value: metrics.customers.suspended.toLocaleString(),
            icon: AlertTriangle,
            changePercentage: metrics.customers.suspended > 0 ? 'Action Req' : 'Clear',
            subText: 'Platform policy compliance',
            tab: 'customers',
        },
    ];

    return (
        <div className="space-y-6 select-none transition-colors">
            {/* Top Stat Cards Grid matching admincn statistics-card-01.tsx */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <Card
                            key={idx}
                            onClick={() => onNavigateTab?.(card.tab)}
                            className="p-5 hover:border-orange-500/40 dark:hover:border-orange-500/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                        >
                            {/* CardHeader */}
                            <div className="flex items-center gap-3">
                                <div className="size-8 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                                    <Icon className="w-4 h-4" />
                                </div>
                                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                    {card.value}
                                </span>
                            </div>

                            {/* CardContent */}
                            <div className="mt-4 flex flex-col gap-1">
                                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                    {card.title}
                                </span>
                                <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-500">
                                    <span className="text-orange-600 dark:text-orange-400 font-semibold">
                                        {card.changePercentage}
                                    </span>
                                    <span>•</span>
                                    <span className="truncate">{card.subText}</span>
                                </p>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Platform Insights Bar (matching admincn widget-product-insights.tsx) */}
            <Card className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Card Processing Telemetry</h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">Total volume and workspace utilization metrics</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="orange">
                            Real-time DB Sync
                        </Badge>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                    <div>
                        <span className="text-xs text-slate-500 dark:text-zinc-400">Total Business Cards</span>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{metrics.activity.total_cards}</p>
                        <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden">
                            <div className="bg-orange-500 h-full rounded-full" style={{ width: '100%' }} />
                        </div>
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 dark:text-zinc-400">Total Scan Invocations</span>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{metrics.activity.total_scans}</p>
                        <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: metrics.activity.total_cards ? `${Math.min(100, Math.round((metrics.activity.total_scans / (metrics.activity.total_cards || 1)) * 100))}%` : '50%' }} />
                        </div>
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 dark:text-zinc-400">Bulk Batches Completed</span>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{metrics.activity.bulk_batches}</p>
                        <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full" style={{ width: '75%' }} />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Two-Column Cards: Recent Customers & Recent Audit Trail */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Recent Registered Customers */}
                <Card className="overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Customer Signups</h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">Newly onboarded customer profiles</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigateTab?.('customers')}
                            className="inline-flex items-center text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline gap-1 cursor-pointer"
                        >
                            <span>View All</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="p-2 flex-1">
                        {recentCustomers.length === 0 ? (
                            <div className="py-12 text-center text-xs text-slate-400 dark:text-zinc-500">
                                No registered customers recorded yet.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                                {recentCustomers.map((c) => {
                                    const isSuspended = c.status === 'suspended';
                                    return (
                                        <div
                                            key={c.id}
                                            onClick={() => onSelectCustomer?.(c.id)}
                                            className="p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer flex items-center justify-between gap-3"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="size-9 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center border border-slate-200 dark:border-zinc-700 shrink-0">
                                                    {c.name?.charAt(0)?.toUpperCase() || 'U'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                                        {c.name}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                                                        {c.email}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <Badge variant={isSuspended ? 'destructive' : 'success'} size="sm">
                                                    {isSuspended ? 'Suspended' : 'Active'}
                                                </Badge>
                                                <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                                                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </Card>

                {/* 2. Platform Audit Trail Feed */}
                <Card className="overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Platform Audit Log</h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">Immutable administrative security stream</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigateTab?.('audit')}
                            className="inline-flex items-center text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline gap-1 cursor-pointer"
                        >
                            <span>Full Log</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="p-2 flex-1">
                        {recentAuditLogs.length === 0 ? (
                            <div className="py-12 text-center text-xs text-slate-400 dark:text-zinc-500">
                                No administrative actions recorded yet.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                                {recentAuditLogs.map((log) => {
                                    return (
                                        <div
                                            key={log.id}
                                            className="p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors flex items-start justify-between gap-3 text-xs"
                                        >
                                            <div className="space-y-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-slate-900 dark:text-white">
                                                        {log.action}
                                                    </span>
                                                    {log.target_type && (
                                                        <Badge variant="outline" size="sm" className="font-mono">
                                                            {log.target_type} #{log.target_id}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                                                    By: <span className="font-medium text-slate-700 dark:text-zinc-300">{log.admin_name || 'System / CLI'}</span>
                                                    {log.ip_address && ` • IP: ${log.ip_address}`}
                                                </p>
                                            </div>

                                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono shrink-0 whitespace-nowrap">
                                                {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
