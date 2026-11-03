import React, { useState, useEffect } from 'react';
import {
    CreditCard,
    Plus,
    Edit2,
    CheckCircle2,
    XCircle,
    Building2,
    Zap,
    Shield,
    Loader2,
    Sparkles,
    Check,
    X,
    AlertCircle
} from 'lucide-react';
import {
    fetchAdminPlans,
    createAdminPlan,
    updateAdminPlan,
    toggleAdminPlanStatus
} from '../../services/platformAdminApi';

export default function AdminPlansView() {
    const [plans, setPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [actionToast, setActionToast] = useState(null);

    // Edit/Create Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        price: 0,
        currency: 'USD',
        billing_interval: 'monthly',
        monthly_scan_allowance: 100,
        features: '',
        is_active: true,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const showToast = (message, type = 'info') => {
        setActionToast({ message, type });
        setTimeout(() => setActionToast(null), 4000);
    };

    const loadPlans = async () => {
        setIsLoading(true);
        try {
            const res = await fetchAdminPlans();
            if (res.success && Array.isArray(res.plans)) {
                setPlans(res.plans);
            }
        } catch (err) {
            console.error('Failed to load plans:', err);
            showToast('Failed to load plans', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, []);

    const handleOpenCreateModal = () => {
        setEditingPlan(null);
        setFormData({
            name: '',
            slug: '',
            price: 0,
            currency: 'USD',
            billing_interval: 'monthly',
            monthly_scan_allowance: 100,
            features: '50 Scans/Month\nExport to CSV\nStandard OCR',
            is_active: true,
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (plan) => {
        setEditingPlan(plan);
        setFormData({
            name: plan.name,
            slug: plan.slug,
            price: plan.price,
            currency: plan.currency || 'USD',
            billing_interval: plan.billing_interval || 'monthly',
            monthly_scan_allowance: plan.monthly_scan_allowance,
            features: Array.isArray(plan.features) ? plan.features.join('\n') : '',
            is_active: plan.is_active,
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleSavePlan = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!formData.name.trim()) {
            setFormError('Plan name is required.');
            return;
        }

        const featuresArray = formData.features
            .split('\n')
            .map((f) => f.trim())
            .filter(Boolean);

        const payload = {
            name: formData.name.trim(),
            slug: formData.slug.trim() || undefined,
            price: parseFloat(formData.price) || 0,
            currency: formData.currency,
            billing_interval: formData.billing_interval,
            monthly_scan_allowance: parseInt(formData.monthly_scan_allowance, 10) || 0,
            features: featuresArray,
            is_active: Boolean(formData.is_active),
        };

        setIsSaving(true);
        try {
            if (editingPlan) {
                const res = await updateAdminPlan(editingPlan.id, payload);
                if (res.success) {
                    showToast(`Plan '${payload.name}' updated successfully.`, 'success');
                    setIsModalOpen(false);
                    loadPlans();
                } else {
                    setFormError(res.message || 'Failed to update plan.');
                }
            } else {
                const res = await createAdminPlan(payload);
                if (res.success) {
                    showToast(`Plan '${payload.name}' created successfully.`, 'success');
                    setIsModalOpen(false);
                    loadPlans();
                } else {
                    setFormError(res.message || 'Failed to create plan.');
                }
            }
        } catch (err) {
            console.error('Save plan error:', err);
            setFormError('An error occurred while saving the plan.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleStatus = async (plan) => {
        try {
            const res = await toggleAdminPlanStatus(plan.id);
            if (res.success) {
                showToast(res.message, 'success');
                loadPlans();
            } else {
                showToast(res.message || 'Failed to toggle status.', 'error');
            }
        } catch (err) {
            console.error('Toggle status error:', err);
            showToast('Network error while toggling status.', 'error');
        }
    };

    const totalActiveSubs = plans.reduce((acc, p) => acc + (p.active_subscriptions_count || 0), 0);

    return (
        <div className="space-y-6">
            {/* Toast Notification */}
            {actionToast && (
                <div
                    className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200 border ${
                        actionToast.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800'
                            : actionToast.type === 'error'
                            ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800'
                            : 'bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 border-transparent'
                    }`}
                >
                    {actionToast.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <span>{actionToast.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                        SaaS Plans & Quotas
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        Configure subscription tiers, monthly scan allowances, and pricing for all workspaces.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    Create New Plan
                </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                        <span className="text-xs font-medium">Configured Plans</span>
                        <CreditCard className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {plans.length}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                        {plans.filter((p) => p.is_active).length} active for new signups
                    </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                        <span className="text-xs font-medium">Active Subscriptions</span>
                        <Building2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {totalActiveSubs}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                        Across all customer workspaces
                    </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                        <span className="text-xs font-medium">Quota System</span>
                        <Zap className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="mt-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        Idempotent Ledger Active
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                        Atomic reserve & confirm per scan
                    </div>
                </div>
            </div>

            {/* Plans List Table */}
            <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Available Tiers
                    </h2>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                        Real-time workspace counts
                    </span>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                        <p className="text-xs">Loading plans...</p>
                    </div>
                ) : plans.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
                        <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No plans found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/75 dark:bg-zinc-900/90 text-slate-500 dark:text-zinc-400 border-b border-slate-200/80 dark:border-zinc-800/80 uppercase text-[10px] tracking-wider font-semibold">
                                <tr>
                                    <th className="px-4 py-3">Plan Name</th>
                                    <th className="px-4 py-3">Monthly Allowance</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3">Interval</th>
                                    <th className="px-4 py-3">Active Workspaces</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80 dark:divide-zinc-800/80 text-slate-700 dark:text-zinc-300">
                                {plans.map((plan) => (
                                    <tr
                                        key={plan.id}
                                        className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors"
                                    >
                                        <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                <div className="size-7 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-xs shrink-0">
                                                    {plan.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-semibold">{plan.name}</div>
                                                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                                                        {plan.slug}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="font-semibold text-slate-900 dark:text-white">
                                                {plan.monthly_scan_allowance.toLocaleString()}
                                            </span>
                                            <span className="text-slate-400 dark:text-zinc-500 text-[11px] ml-1">
                                                credits / mo
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                                            {plan.price === 0 ? (
                                                <span className="text-emerald-600 dark:text-emerald-400">Free</span>
                                            ) : (
                                                `$${plan.price}`
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 capitalize text-slate-500 dark:text-zinc-400">
                                            {plan.billing_interval}
                                        </td>
                                        <td className="px-4 py-3.5 font-medium">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-[11px]">
                                                <Building2 className="w-3 h-3 text-slate-400" />
                                                {plan.active_subscriptions_count}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {plan.is_active ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
                                                    <XCircle className="w-3 h-3" />
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-right space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditModal(plan)}
                                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(plan)}
                                                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                                    plan.is_active
                                                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400'
                                                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                }`}
                                            >
                                                {plan.is_active ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New Plan'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSavePlan} className="p-5 space-y-4">
                            {formError && (
                                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                                    {formError}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                                        Plan Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Enterprise"
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                                        Slug
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.slug}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                        placeholder="Auto-generated if empty"
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                                        Monthly Allowance (Scans) *
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        value={formData.monthly_scan_allowance}
                                        onChange={(e) => setFormData({ ...formData, monthly_scan_allowance: e.target.value })}
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                                        Price ($ USD) *
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        required
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                                    Features (One per line)
                                </label>
                                <textarea
                                    rows="3"
                                    value={formData.features}
                                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                                    placeholder="50 Scans per month&#10;CSV export&#10;Team sharing"
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none font-mono"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="plan_active_toggle"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="rounded border-slate-300 dark:border-zinc-700 text-orange-500 focus:ring-orange-500"
                                />
                                <label htmlFor="plan_active_toggle" className="text-xs font-medium text-slate-700 dark:text-zinc-300 cursor-pointer">
                                    Active for customer assignment
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    {editingPlan ? 'Save Changes' : 'Create Plan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
