import React, { useState, useEffect, useCallback } from 'react';
import {
    Cpu,
    Search,
    Calendar,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    SlidersHorizontal,
    RotateCcw,
    Loader2,
    Eye,
    X,
    Filter,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Clock,
    DollarSign,
    IndianRupee,
    Layers,
    FileSpreadsheet,
    Zap,
    HelpCircle,
    ExternalLink,
    Sparkles,
    ArrowUpRight,
    Database,
    Tag,
    ShieldAlert
} from 'lucide-react';
import {
    fetchAiCostRequests,
    fetchAiCostDetails,
    fetchAiCostFilterOptions,
    recalculateAiCostRequest
} from '../../services/platformAdminApi';

export default function AdminAiCostsView() {
    // Requests & Summary State
    const [requests, setRequests] = useState([]);
    const [summary, setSummary] = useState(null);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 25 });
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filter Options from Server
    const [filterOptions, setFilterOptions] = useState({
        models: [],
        workspaces: [],
        users: [],
        statuses: ['success', 'failed', 'pending'],
        scan_types: ['single_scan', 'bulk_scan'],
        cost_statuses: ['calculated', 'no_usage', 'usage_metadata_missing', 'pricing_missing', 'exchange_rate_missing', 'pending'],
        date_presets: [
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'all', label: 'All Time' },
        ]
    });

    // Active Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [datePreset, setDatePreset] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedWorkspace, setSelectedWorkspace] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedScanType, setSelectedScanType] = useState('all');
    const [selectedCostStatus, setSelectedCostStatus] = useState('all');

    // Detail Drawer State
    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [inspectRequest, setInspectRequest] = useState(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [actionMessage, setActionMessage] = useState(null);
    const [isFilterExpanded, setIsFilterExpanded] = useState(true);

    // Active filters counting
    const activeFiltersCount = [
        datePreset !== 'all',
        Boolean(startDate || endDate),
        Boolean(selectedWorkspace),
        Boolean(selectedUser),
        Boolean(selectedModel),
        selectedStatus !== 'all',
        selectedScanType !== 'all',
        selectedCostStatus !== 'all',
        Boolean(searchQuery.trim()),
    ].filter(Boolean).length;

    const hasAnyFilter = activeFiltersCount > 0;

    // Load Filter Options Once
    useEffect(() => {
        fetchAiCostFilterOptions().then((res) => {
            if (res.success) {
                setFilterOptions((prev) => ({
                    ...prev,
                    models: res.models || prev.models,
                    workspaces: res.workspaces || prev.workspaces,
                    users: res.users || prev.users,
                }));
            }
        }).catch((err) => console.error('Failed to load AI cost filter options:', err));
    }, []);

    // Load Requests & Metrics
    const loadRequests = useCallback(async (page = 1, showRefreshSpinner = false) => {
        if (showRefreshSpinner) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            const res = await fetchAiCostRequests({
                page,
                perPage: 25,
                search: searchQuery.trim(),
                datePreset,
                startDate: datePreset === 'custom' ? startDate : null,
                endDate: datePreset === 'custom' ? endDate : null,
                workspaceId: selectedWorkspace || null,
                userId: selectedUser || null,
                model: selectedModel || null,
                status: selectedStatus,
                scanType: selectedScanType,
                costStatus: selectedCostStatus,
            });

            if (res.success) {
                setRequests(res.requests || []);
                setSummary(res.summary || null);
                setPagination(res.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 25 });
            }
        } catch (err) {
            console.error('Failed to fetch AI usage and cost requests:', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [
        searchQuery,
        datePreset,
        startDate,
        endDate,
        selectedWorkspace,
        selectedUser,
        selectedModel,
        selectedStatus,
        selectedScanType,
        selectedCostStatus,
    ]);

    // Debounced reload on filter change
    useEffect(() => {
        const timer = setTimeout(() => {
            loadRequests(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [loadRequests]);

    // Load single request detail
    const handleOpenDetail = async (requestId) => {
        setSelectedRequestId(requestId);
        setIsLoadingDetail(true);
        setActionMessage(null);
        try {
            const res = await fetchAiCostDetails(requestId);
            if (res.success && res.request) {
                setInspectRequest(res.request);
            }
        } catch (err) {
            console.error('Failed to fetch AI request detail:', err);
        } finally {
            setIsLoadingDetail(false);
        }
    };

    // Close Detail Drawer
    const handleCloseDetail = () => {
        setSelectedRequestId(null);
        setInspectRequest(null);
        setActionMessage(null);
    };

    // Recalculate Request
    const handleRecalculate = async () => {
        if (!inspectRequest) return;
        setIsRecalculating(true);
        setActionMessage(null);
        try {
            const res = await recalculateAiCostRequest(inspectRequest.id);
            if (res.success) {
                setActionMessage({ type: 'success', text: 'Cost recalculated successfully using applicable pricing & exchange rates.' });
                // Reload single detail
                const refreshed = await fetchAiCostDetails(inspectRequest.id);
                if (refreshed.success && refreshed.request) {
                    setInspectRequest(refreshed.request);
                }
                // Reload list in background
                loadRequests(pagination.current_page, true);
            } else {
                setActionMessage({ type: 'error', text: res.message || 'Failed to recalculate request cost.' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Unexpected error during recalculation.' });
        } finally {
            setIsRecalculating(false);
        }
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setDatePreset('all');
        setStartDate('');
        setEndDate('');
        setSelectedWorkspace('');
        setSelectedUser('');
        setSelectedModel('');
        setSelectedStatus('all');
        setSelectedScanType('all');
        setSelectedCostStatus('all');
    };

    // Status Badge Helper
    const renderStatusBadge = (status) => {
        switch (status) {
            case 'success':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Success
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                        <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        Failed
                    </span>
                );
            case 'pending':
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400 animate-spin" />
                        Pending
                    </span>
                );
        }
    };

    // Cost Status Badge Helper (Critical requirement: Never display null cost as zero)
    const renderCostStatusBadge = (status, costUsd) => {
        switch (status) {
            case 'calculated':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40">
                        Calculated
                    </span>
                );
            case 'no_usage':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                        0 Tokens
                    </span>
                );
            case 'usage_metadata_missing':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" title="Gemini did not return usage metadata">
                        <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Usage Missing
                    </span>
                );
            case 'pricing_missing':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800" title="No matching model pricing found for request timestamp">
                        <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        Pricing Missing
                    </span>
                );
            case 'exchange_rate_missing':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" title="Exchange rate for USD-INR not available for request date">
                        <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        FX Missing
                    </span>
                );
            case 'calculation_failed':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                        Failed
                    </span>
                );
            case 'pending':
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                        Pending
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Title & Notice */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            AI Usage & Costs
                        </h1>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Gemini Vision
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                            Platform Admin Only
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
                        Inspect real-time Google Gemini API requests, actual token usage, and calculated provider costs in USD and INR.
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => loadRequests(pagination.current_page, true)}
                        disabled={isRefreshing || isLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/80 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-orange-500' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Platform Admin Internal Cost Banner */}
            <div className="p-3.5 rounded-xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 text-orange-950 dark:text-orange-200 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                    <p className="font-semibold text-orange-800 dark:text-orange-300">
                        Strictly Confidential Platform Provider Telemetry
                    </p>
                    <p className="text-slate-600 dark:text-zinc-400">
                        Provider costs shown here reflect actual Google Gemini Vision API billing to BusinessCardScanAI. Customer scan credits are isolated and managed independently via the subscription ledger. Provider pricing is never disclosed to customer workspaces.
                    </p>
                </div>
            </div>

            {/* Summary Metrics Cards */}
            {summary && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {/* Total Requests Card */}
                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                Gemini Requests
                            </span>
                            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                <Cpu className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                {summary.total_requests.toLocaleString()}
                            </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {summary.successful_requests.toLocaleString()} success
                            </span>
                            <span>•</span>
                            <span className={summary.failed_requests > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>
                                {summary.failed_requests.toLocaleString()} failed
                            </span>
                        </div>
                    </div>

                    {/* Total Tokens Card */}
                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                Total Tokens
                            </span>
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <Zap className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                {summary.total_tokens.toLocaleString()}
                            </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                            <span>In: {summary.prompt_tokens.toLocaleString()}</span>
                            <span className="mx-1">•</span>
                            <span>Out: {summary.candidates_tokens.toLocaleString()}</span>
                            {summary.cached_tokens > 0 && (
                                <>
                                    <span className="mx-1">•</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">Cached: {summary.cached_tokens.toLocaleString()}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Actual Cost USD */}
                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                Actual Cost (USD)
                            </span>
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <DollarSign className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                                ${summary.total_cost_usd}
                            </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                            {summary.null_cost_count > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                    {summary.null_cost_count} requests pending cost
                                </span>
                            ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    100% cost calculated
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actual Cost INR */}
                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                Actual Cost (INR)
                            </span>
                            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                                <IndianRupee className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                                ₹{summary.total_cost_inr}
                            </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                            <span>FBIL reference & planning rate</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
                {/* Top Control Bar: Search Input, Quick Date Range, Filters Toggle, Reset */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-0">
                        <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search by UUID, workspace, user name or email, model..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Right Action Tools: Date Range Dropdown, Filter Toggle, Reset */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                        {/* Time Period Selector Dropdown (Clean, zero horizontal scrollbar) */}
                        <div className="relative min-w-[145px]">
                            <Calendar className="w-3.5 h-3.5 text-orange-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                                value={datePreset}
                                onChange={(e) => {
                                    setDatePreset(e.target.value);
                                    if (e.target.value !== 'custom') {
                                        setStartDate('');
                                        setEndDate('');
                                    }
                                }}
                                className="w-full appearance-none pl-8 pr-7 py-2 text-xs bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-colors cursor-pointer"
                            >
                                <option value="all">Period: All Time</option>
                                <option value="today">Period: Today</option>
                                <option value="yesterday">Period: Yesterday</option>
                                <option value="7d">Period: Last 7 Days</option>
                                <option value="30d">Period: Last 30 Days</option>
                                <option value="this_month">Period: This Month</option>
                                <option value="custom">Period: Custom Range...</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* Toggle Advanced Filters Button */}
                        <button
                            type="button"
                            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                isFilterExpanded
                                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30'
                                    : 'bg-slate-50/70 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Filters</span>
                            {activeFiltersCount > 0 && (
                                <span className="size-4 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                                    {activeFiltersCount}
                                </span>
                            )}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isFilterExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Reset All Filters Button */}
                        {hasAnyFilter && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                title="Reset all filters"
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 transition-colors cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reset</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Custom Date Pickers (Shown when Custom Range is selected) */}
                {datePreset === 'custom' && (
                    <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-3 text-xs bg-slate-50/50 dark:bg-zinc-950/40 p-3 rounded-lg">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                            Custom Date Range:
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">From</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">To</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button
                                type="button"
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                            >
                                Clear Date Pickers
                            </button>
                        )}
                    </div>
                )}

                {/* Expanded Multi-Filter Controls Grid */}
                {isFilterExpanded && (
                    <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                            {/* Gemini Model */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                    Gemini Model
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full appearance-none pl-3 pr-8 py-2 text-xs bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                                    >
                                        <option value="">All Gemini Models</option>
                                        {filterOptions.models.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>

                            {/* Scan Type */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                    Scan Type
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedScanType}
                                        onChange={(e) => setSelectedScanType(e.target.value)}
                                        className="w-full appearance-none pl-3 pr-8 py-2 text-xs bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                                    >
                                        <option value="all">All Scan Types</option>
                                        <option value="single_scan">Single Card Scan</option>
                                        <option value="bulk_scan">Bulk Batch Scan</option>
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>

                            {/* API Request Status */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                    API Status
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value)}
                                        className="w-full appearance-none pl-3 pr-8 py-2 text-xs bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                                    >
                                        <option value="all">All Request Statuses</option>
                                        <option value="success">Success Only</option>
                                        <option value="failed">Failed Only</option>
                                        <option value="pending">Pending Only</option>
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>

                            {/* Cost Status */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                    Cost Status
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedCostStatus}
                                        onChange={(e) => setSelectedCostStatus(e.target.value)}
                                        className="w-full appearance-none pl-3 pr-8 py-2 text-xs bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                                    >
                                        <option value="all">All Cost Statuses</option>
                                        <option value="calculated">Calculated</option>
                                        <option value="no_usage">0 Tokens (No Usage)</option>
                                        <option value="usage_metadata_missing">Usage Missing</option>
                                        <option value="pricing_missing">Pricing Missing</option>
                                        <option value="exchange_rate_missing">FX Missing</option>
                                        <option value="pending">Pending Cost</option>
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>

                            {/* Workspace */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                    Workspace Tenant
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedWorkspace}
                                        onChange={(e) => setSelectedWorkspace(e.target.value)}
                                        className="w-full appearance-none pl-3 pr-8 py-2 text-xs bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer truncate"
                                    >
                                        <option value="">All Workspaces</option>
                                        {filterOptions.workspaces.map((w) => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>

                            {/* Customer User */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                    Customer User
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedUser}
                                        onChange={(e) => setSelectedUser(e.target.value)}
                                        className="w-full appearance-none pl-3 pr-8 py-2 text-xs bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer truncate"
                                    >
                                        <option value="">All Users</option>
                                        {filterOptions.users.map((u) => (
                                            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Active Filter Chips / Removable Pills */}
                {hasAnyFilter && (
                    <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mr-1">
                            Active Filters:
                        </span>

                        {datePreset !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">
                                Period: {datePreset === 'custom' ? `${startDate || 'Start'} to ${endDate || 'End'}` : (filterOptions.date_presets.find(p => p.id === datePreset)?.label || datePreset)}
                                <button type="button" onClick={() => { setDatePreset('all'); setStartDate(''); setEndDate(''); }} className="hover:text-orange-900 dark:hover:text-white cursor-pointer ml-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}

                        {selectedModel && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">
                                Model: {selectedModel}
                                <button type="button" onClick={() => setSelectedModel('')} className="hover:text-orange-900 dark:hover:text-white cursor-pointer ml-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}

                        {selectedScanType !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">
                                Type: {selectedScanType === 'single_scan' ? 'Single Scan' : 'Bulk Batch'}
                                <button type="button" onClick={() => setSelectedScanType('all')} className="hover:text-orange-900 dark:hover:text-white cursor-pointer ml-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}

                        {selectedStatus !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">
                                Status: {selectedStatus}
                                <button type="button" onClick={() => setSelectedStatus('all')} className="hover:text-orange-900 dark:hover:text-white cursor-pointer ml-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}

                        {selectedCostStatus !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">
                                Cost: {selectedCostStatus}
                                <button type="button" onClick={() => setSelectedCostStatus('all')} className="hover:text-orange-900 dark:hover:text-white cursor-pointer ml-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}

                        {selectedWorkspace && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">
                                Workspace: {filterOptions.workspaces.find(w => String(w.id) === String(selectedWorkspace))?.name || selectedWorkspace}
                                <button type="button" onClick={() => setSelectedWorkspace('')} className="hover:text-orange-900 dark:hover:text-white cursor-pointer ml-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}

                        {selectedUser && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">
                                User: {filterOptions.users.find(u => String(u.id) === String(selectedUser))?.name || selectedUser}
                                <button type="button" onClick={() => setSelectedUser('')} className="hover:text-orange-900 dark:hover:text-white cursor-pointer ml-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}

                        {searchQuery && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">
                                Query: "{searchQuery}"
                                <button type="button" onClick={() => setSearchQuery('')} className="hover:text-orange-900 dark:hover:text-white cursor-pointer ml-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-1 underline cursor-pointer"
                        >
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            {/* Requests Table */}
            <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                        Showing {requests.length} of {pagination.total.toLocaleString()} API Requests
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        Page {pagination.current_page} of {Math.max(1, pagination.last_page)}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/75 dark:bg-zinc-950/60 text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-zinc-800 select-none">
                            <tr>
                                <th className="px-4 py-3">Timestamp / Type</th>
                                <th className="px-4 py-3">Workspace / User</th>
                                <th className="px-4 py-3">Model & Attempt</th>
                                <th className="px-4 py-3">Tokens</th>
                                <th className="px-4 py-3 text-center">Images</th>
                                <th className="px-4 py-3">Request Status</th>
                                <th className="px-4 py-3 text-right">Actual Cost</th>
                                <th className="px-4 py-3 text-right">Est. / Image</th>
                                <th className="px-4 py-3">Cost Status</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="10" className="py-12 text-center text-slate-400 dark:text-zinc-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                                            <span>Loading AI API telemetry...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="py-12 text-center text-slate-400 dark:text-zinc-500">
                                        <div className="flex flex-col items-center justify-center gap-1.5">
                                            <Cpu className="w-8 h-8 text-slate-300 dark:text-zinc-700" />
                                            <p className="font-semibold text-slate-600 dark:text-zinc-400">No AI API requests found</p>
                                            <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                                                Try adjusting your date range, filters, or search terms.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                requests.map((req) => {
                                    const formattedTime = req.started_at
                                        ? new Date(req.started_at).toLocaleString()
                                        : (req.created_at ? new Date(req.created_at).toLocaleString() : '—');

                                    return (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                                        >
                                            {/* Timestamp & Scan Type */}
                                            <td className="px-4 py-3">
                                                <div className="space-y-0.5">
                                                    <div className="font-mono text-[11px] text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                                                        {formattedTime}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`inline-flex px-1.5 py-0.2 rounded text-[10px] font-medium ${
                                                            req.scan_type === 'single_scan'
                                                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50'
                                                                : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/50'
                                                        }`}>
                                                            {req.scan_type === 'single_scan' ? 'Single Scan' : 'Bulk Batch'}
                                                        </span>
                                                        {req.duration_ms && (
                                                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                                                                {req.duration_ms}ms
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Workspace / User */}
                                            <td className="px-4 py-3 max-w-[180px]">
                                                <div className="space-y-0.5">
                                                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                                                        {req.workspace?.name || 'No Workspace'}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                                                        {req.user?.name || req.user?.email || 'System'}
                                                    </p>
                                                </div>
                                            </td>

                                            {/* Model & Attempt */}
                                            <td className="px-4 py-3">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-zinc-200">
                                                            {req.actual_model || req.requested_model}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500">
                                                        <span>Attempt {req.attempt_number}</span>
                                                        {req.is_fallback && (
                                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                                Fallback
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Tokens */}
                                            <td className="px-4 py-3">
                                                <div className="space-y-0.5">
                                                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                                        {req.total_tokens.toLocaleString()}
                                                    </span>
                                                    <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                                                        {req.prompt_tokens} in / {req.candidates_tokens} out
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Image Count */}
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center justify-center size-6 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs">
                                                    {req.image_count}
                                                </span>
                                            </td>

                                            {/* Request Status */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {renderStatusBadge(req.status)}
                                            </td>

                                            {/* Actual Request Cost (Never display NULL as zero) */}
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                {req.cost_usd !== null ? (
                                                    <div className="space-y-0.5">
                                                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                                                            ${req.cost_usd}
                                                        </div>
                                                        <div className="font-mono text-[11px] text-teal-600 dark:text-teal-400">
                                                            {req.cost_inr !== null ? `₹${req.cost_inr}` : <span className="text-amber-500">FX N/A</span>}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="font-mono text-slate-400 dark:text-zinc-500">
                                                        —
                                                    </span>
                                                )}
                                            </td>

                                            {/* Estimated Cost / Image (Explicitly labeled [Est.]) */}
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                {req.estimated_cost_per_image_usd !== null ? (
                                                    <div className="space-y-0.5">
                                                        <div className="font-mono text-[11px] text-slate-700 dark:text-zinc-300">
                                                            ${req.estimated_cost_per_image_usd}
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">
                                                            [Estimate]
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-zinc-500">—</span>
                                                )}
                                            </td>

                                            {/* Cost Calculation Status */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {renderCostStatusBadge(req.cost_calculation_status, req.cost_usd)}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenDetail(req.id)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>Details</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-4 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => loadRequests(pagination.current_page - 1)}
                        disabled={pagination.current_page <= 1 || isLoading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Previous</span>
                    </button>

                    <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                        Page <span className="font-semibold text-slate-900 dark:text-white">{pagination.current_page}</span> of <span className="font-semibold text-slate-900 dark:text-white">{Math.max(1, pagination.last_page)}</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadRequests(pagination.current_page + 1)}
                        disabled={pagination.current_page >= pagination.last_page || isLoading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Request Detail Drawer / Modal */}
            {selectedRequestId && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
                        onClick={handleCloseDetail}
                    />

                    {/* Drawer Content */}
                    <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-2xl z-50 overflow-y-auto flex flex-col h-full border-l border-slate-200 dark:border-zinc-800">
                        {/* Drawer Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs z-10">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                    <Cpu className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                        AI Request Telemetry
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate max-w-xs sm:max-w-md">
                                        {inspectRequest?.request_uuid || `Request #${selectedRequestId}`}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleCloseDetail}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="p-4 sm:p-6 space-y-6 flex-1">
                            {isLoadingDetail ? (
                                <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                                    <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                                    <span className="text-xs">Loading request telemetry...</span>
                                </div>
                            ) : inspectRequest ? (
                                <>
                                    {/* Action Notification */}
                                    {actionMessage && (
                                        <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                                            actionMessage.type === 'success'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                        }`}>
                                            {actionMessage.type === 'success' ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                            ) : (
                                                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                            )}
                                            <span>{actionMessage.text}</span>
                                        </div>
                                    )}

                                    {/* Financial Cost Card */}
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                                Actual Request Cost
                                            </span>
                                            {renderCostStatusBadge(inspectRequest.cost_calculation_status, inspectRequest.cost_usd)}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-[11px] text-slate-400 dark:text-zinc-500 block">Cost in USD</span>
                                                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white">
                                                    {inspectRequest.cost_usd !== null ? `$${inspectRequest.cost_usd}` : '—'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[11px] text-slate-400 dark:text-zinc-500 block">Cost in INR</span>
                                                <span className="text-xl sm:text-2xl font-bold font-mono text-teal-600 dark:text-teal-400">
                                                    {inspectRequest.cost_inr !== null ? `₹${inspectRequest.cost_inr}` : '—'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Estimated per-image Cost (Separately labeled) */}
                                        <div className="pt-3 border-t border-slate-200 dark:border-zinc-800/80">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                        Estimated Cost Per Image
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            ESTIMATE
                                                        </span>
                                                    </span>
                                                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                                                        Derived by allocating total request cost across {inspectRequest.image_count} processed card image(s).
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-mono text-xs font-bold text-slate-800 dark:text-zinc-200">
                                                        {inspectRequest.estimated_cost_per_image_usd !== null ? `$${inspectRequest.estimated_cost_per_image_usd}` : '—'}
                                                    </div>
                                                    <div className="font-mono text-[10px] text-teal-600 dark:text-teal-400">
                                                        {inspectRequest.estimated_cost_per_image_inr !== null ? `₹${inspectRequest.estimated_cost_per_image_inr}` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tokens Breakdown Card */}
                                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                                            Token Usage Accounting
                                        </span>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">Total Tokens</span>
                                                <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                                                    {inspectRequest.tokens?.total_tokens.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">Prompt / Input</span>
                                                <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                                                    {inspectRequest.tokens?.prompt_tokens.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">Candidates / Output</span>
                                                <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                                                    {inspectRequest.tokens?.candidates_tokens.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">Cached Input</span>
                                                <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                                    {inspectRequest.tokens?.cached_tokens.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">Thinking Tokens</span>
                                                <span className="text-base font-bold font-mono text-purple-600 dark:text-purple-400">
                                                    {inspectRequest.tokens?.thoughts_tokens.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">Billable Base Prompt</span>
                                                <span className="text-base font-bold font-mono text-slate-700 dark:text-zinc-300">
                                                    {inspectRequest.tokens?.non_cached_prompt_tokens.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Raw Usage Metadata (Collapsible) */}
                                        {inspectRequest.raw_usage_metadata && (
                                            <details className="mt-2 text-xs">
                                                <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 text-[11px] font-semibold select-none">
                                                    View Raw Gemini usageMetadata Payload
                                                </summary>
                                                <pre className="mt-2 p-3 rounded-lg bg-slate-100 dark:bg-zinc-950 font-mono text-[10px] text-slate-800 dark:text-zinc-200 overflow-x-auto border border-slate-200 dark:border-zinc-800">
                                                    {JSON.stringify(inspectRequest.raw_usage_metadata, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>

                                    {/* Pricing & FX Rate Traceability */}
                                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                                            Pricing Version & Exchange Rate Traceability
                                        </span>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                            {/* Pricing Version */}
                                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 space-y-1">
                                                <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">
                                                    Pricing Model Applied
                                                </span>
                                                <p className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                                                    {inspectRequest.applied_pricing?.model_identifier || inspectRequest.actual_model}
                                                </p>
                                                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                                                    Version: <span className="font-semibold">{inspectRequest.applied_pricing?.pricing_version || inspectRequest.pricing_version || 'None'}</span>
                                                </p>
                                                {inspectRequest.applied_pricing && (
                                                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                                                        Rates: ${inspectRequest.applied_pricing.input_token_price_per_million}/M in, ${inspectRequest.applied_pricing.output_token_price_per_million}/M out
                                                    </p>
                                                )}
                                            </div>

                                            {/* Exchange Rate */}
                                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 space-y-1">
                                                <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">
                                                    USD to INR Rate Applied
                                                </span>
                                                <p className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                                                    {inspectRequest.exchange_rate ? `₹${inspectRequest.exchange_rate}` : 'Missing Rate'}
                                                </p>
                                                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                                                    Source: <span className="font-semibold">{inspectRequest.applied_exchange_rate?.source || 'system'}</span>
                                                </p>
                                                {inspectRequest.applied_exchange_rate?.effective_date && (
                                                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                                                        Effective: {inspectRequest.applied_exchange_rate.effective_date}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Fallback Chain & Retries */}
                                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                                            Routing, Attempts & Diagnostics
                                        </span>

                                        <div className="space-y-1.5 text-xs">
                                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-850">
                                                <span className="text-slate-500 dark:text-zinc-400">Attempt Number</span>
                                                <span className="font-semibold text-slate-800 dark:text-zinc-200">{inspectRequest.attempt_number}</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-850">
                                                <span className="text-slate-500 dark:text-zinc-400">Is Fallback Attempt</span>
                                                <span className="font-semibold text-slate-800 dark:text-zinc-200">{inspectRequest.is_fallback ? 'Yes' : 'No'}</span>
                                            </div>
                                            {inspectRequest.fallback_reason && (
                                                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-850">
                                                    <span className="text-slate-500 dark:text-zinc-400">Fallback Trigger Reason</span>
                                                    <span className="font-mono text-slate-800 dark:text-zinc-200 text-[11px]">{inspectRequest.fallback_reason}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-850">
                                                <span className="text-slate-500 dark:text-zinc-400">HTTP Status Code</span>
                                                <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">{inspectRequest.http_status || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-850">
                                                <span className="text-slate-500 dark:text-zinc-400">Execution Duration</span>
                                                <span className="font-mono text-slate-800 dark:text-zinc-200">{inspectRequest.duration_ms ? `${inspectRequest.duration_ms} ms` : '—'}</span>
                                            </div>
                                            {inspectRequest.error_message && (
                                                <div className="py-2">
                                                    <span className="text-rose-600 dark:text-rose-400 font-semibold block mb-1">Safe Diagnostic Error:</span>
                                                    <p className="p-2 rounded bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 font-mono text-[11px]">
                                                        {inspectRequest.error_code && `[${inspectRequest.error_code}] `}{inspectRequest.error_message}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Attributed Context & Entities */}
                                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                                            Workspace & Customer Attribution
                                        </span>

                                        <div className="space-y-1.5 text-xs">
                                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-850">
                                                <span className="text-slate-500 dark:text-zinc-400">Workspace</span>
                                                <span className="font-semibold text-slate-800 dark:text-zinc-200">{inspectRequest.workspace?.name || 'Unassigned'}</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-850">
                                                <span className="text-slate-500 dark:text-zinc-400">Customer User</span>
                                                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                                                    {inspectRequest.user ? `${inspectRequest.user.name} (${inspectRequest.user.email})` : 'System Task'}
                                                </span>
                                            </div>
                                            {inspectRequest.card_scan_id && (
                                                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-850">
                                                    <span className="text-slate-500 dark:text-zinc-400">Card Scan ID</span>
                                                    <span className="font-mono text-slate-800 dark:text-zinc-200">#{inspectRequest.card_scan_id}</span>
                                                </div>
                                            )}
                                            {inspectRequest.bulk_import_id && (
                                                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-850">
                                                    <span className="text-slate-500 dark:text-zinc-400">Bulk Batch ID</span>
                                                    <span className="font-mono text-slate-800 dark:text-zinc-200">#{inspectRequest.bulk_import_id} (Item #{inspectRequest.bulk_import_item_id})</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>

                        {/* Drawer Footer Actions */}
                        {inspectRequest && (
                            <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/60 flex items-center justify-between gap-3 sticky bottom-0 z-10">
                                <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                                    Audited AI Request #{inspectRequest.id}
                                </span>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleRecalculate}
                                        disabled={isRecalculating}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                                        <span>Recalculate Cost</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleCloseDetail}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

