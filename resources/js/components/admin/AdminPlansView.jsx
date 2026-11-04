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
    AlertCircle,
    Users,
    Calendar,
    Layers,
    FileSpreadsheet,
    HelpCircle,
    CheckSquare,
    Square,
    Info,
    Crown
} from 'lucide-react';
import {
    fetchAdminPlans,
    createAdminPlan,
    updateAdminPlan,
    toggleAdminPlanStatus
} from '../../services/platformAdminApi';

// Default static fallback catalog matching Plan::FEATURE_CATALOG
const FALLBACK_CATALOG = {
    scanning_ai: {
        category: 'Scanning & AI',
        features: {
            single_card_scan: {
                name: 'Single Card Scanning',
                description: 'Fast camera capture & Gemini Vision AI extraction',
            },
            high_accuracy_ocr: {
                name: 'Multilingual & Regional OCR',
                description: 'High-accuracy OCR for Gujarati, Hindi, Arabic, Japanese, etc.',
            },
            auto_crop_enhancement: {
                name: 'Auto Crop & Enhancement',
                description: 'Automatic border detection, perspective skew correction, and lighting tuning',
            },
            reverse_card_scan: {
                name: 'Back-of-Card Capture',
                description: 'Scan and link reverse side of business cards for complete notes',
            },
        },
    },
    contact_management: {
        category: 'Contact Management',
        features: {
            duplicate_detection: {
                name: 'Smart Duplicate Detection',
                description: 'Live phone, email, and name+company collision protection',
            },
            contact_notes_history: {
                name: 'Notes & Scan History',
                description: 'Track multiple booth interactions and conversation notes',
            },
            contact_enrichment: {
                name: 'Smart Contact Enrichment',
                description: 'Auto-generate social links, WhatsApp shortcuts, and website lookups',
            },
            custom_tags: {
                name: 'Custom Tags & Badges',
                description: 'Tag contacts by interest, product lines, or priority status',
            },
        },
    },
    exhibition_management: {
        category: 'Exhibition Management',
        features: {
            exhibition_tracking: {
                name: 'Exhibition Event Tracking',
                description: 'Tag cards with active trade shows and booth locations',
            },
            multi_exhibition_link: {
                name: 'Cross-Exhibition Linking',
                description: 'Connect repeat contacts across multiple expos with separate scan history',
            },
            exhibition_analytics: {
                name: 'Exhibition Lead Analytics',
                description: 'Visitor metrics and top scanning performance reports',
            },
        },
    },
    team_workspace: {
        category: 'Team & Workspace',
        features: {
            shared_workspace: {
                name: 'Shared Team Directory',
                description: 'Centralized card library accessible to all authorized team members',
            },
            member_privacy: {
                name: 'Member Card Privacy',
                description: 'Staff members only see their own scanned contacts until shared',
            },
            role_permissions: {
                name: 'Role-Based Access Control',
                description: 'Owner, Admin, and Member permissions',
            },
            audit_logging: {
                name: 'Security Audit Logs',
                description: 'Track team actions, logins, exports, and security events',
            },
        },
    },
    import_export: {
        category: 'Import & Export',
        features: {
            bulk_import: {
                name: 'Bulk Multi-Photo Import',
                description: 'Upload and process batches of card images at once',
            },
            export_csv: {
                name: 'Export to CSV',
                description: 'Download contacts spreadsheet compatible with Google Sheets & CRM',
            },
            export_excel: {
                name: 'Export to Excel (.xlsx)',
                description: 'Download structured Microsoft Excel formatted workbooks',
            },
            api_access: {
                name: 'Developer API Access',
                description: 'Access REST endpoints for custom CRM and webhook integrations',
            },
        },
    },
    support: {
        category: 'Support',
        features: {
            community_support: {
                name: 'Standard Email Support',
                description: 'Response within 48 business hours',
            },
            priority_support: {
                name: 'Priority Support',
                description: 'Fast-track email and WhatsApp support within 4 hours',
            },
            dedicated_account_manager: {
                name: 'Dedicated Account Manager',
                description: 'Direct phone assistance and exhibition onboarding SLA',
            },
        },
    },
};

const CATEGORY_ICONS = {
    scanning_ai: Zap,
    contact_management: Users,
    exhibition_management: Calendar,
    team_workspace: Building2,
    import_export: FileSpreadsheet,
    support: HelpCircle,
};

export default function AdminPlansView() {
    const [plans, setPlans] = useState([]);
    const [featureCatalog, setFeatureCatalog] = useState(FALLBACK_CATALOG);
    const [isLoading, setIsLoading] = useState(false);
    const [actionToast, setActionToast] = useState(null);

    // Edit/Create Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [activeSection, setActiveSection] = useState('all'); // all | basic | pricing | limits | features

    // Form data with Section 1-4 fields
    const [formData, setFormData] = useState({
        // Section 1: Basic
        name: '',
        slug: '',
        description: '',
        is_active: true,
        is_default: false,

        // Section 2: Pricing & Billing
        price: 0,
        currency: 'INR',
        invoice_interval: 'month',

        // Section 3: Limits
        monthly_scan_allowance: 100,
        unlimited_scans: false,
        max_team_members: 1,
        unlimited_team: false,
        max_workspaces: 1,
        unlimited_workspaces: false,
        max_active_exhibitions: 1,
        unlimited_exhibitions: false,

        // Section 4: Features
        features: [],
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
                if (res.feature_catalog) {
                    setFeatureCatalog(res.feature_catalog);
                }
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
            description: '',
            is_active: true,
            is_default: false,
            price: 0,
            currency: 'INR',
            invoice_interval: 'month',
            monthly_scan_allowance: 100,
            unlimited_scans: false,
            max_team_members: 2,
            unlimited_team: false,
            max_workspaces: 1,
            unlimited_workspaces: false,
            max_active_exhibitions: 1,
            unlimited_exhibitions: false,
            features: [
                'single_card_scan',
                'auto_crop_enhancement',
                'contact_notes_history',
                'shared_workspace',
                'export_csv',
                'community_support'
            ],
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (plan) => {
        setEditingPlan(plan);
        const scansUnlimited = plan.monthly_scan_allowance === -1;
        const teamUnlimited = plan.max_team_members === -1;
        const wsUnlimited = plan.max_workspaces === -1;
        const expoUnlimited = plan.max_active_exhibitions === -1;

        setFormData({
            name: plan.name || '',
            slug: plan.slug || '',
            description: plan.description || '',
            is_active: Boolean(plan.is_active),
            is_default: Boolean(plan.is_default),
            price: plan.price || 0,
            currency: 'INR',
            invoice_interval: plan.invoice_interval === 'year' ? 'year' : 'month',
            monthly_scan_allowance: scansUnlimited ? 1000 : plan.monthly_scan_allowance,
            unlimited_scans: scansUnlimited,
            max_team_members: teamUnlimited ? 10 : (plan.max_team_members ?? 1),
            unlimited_team: teamUnlimited,
            max_workspaces: wsUnlimited ? 3 : (plan.max_workspaces ?? 1),
            unlimited_workspaces: wsUnlimited,
            max_active_exhibitions: expoUnlimited ? 5 : (plan.max_active_exhibitions ?? 1),
            unlimited_exhibitions: expoUnlimited,
            features: Array.isArray(plan.features) ? plan.features : [],
        });
        setFormError('');
        setIsModalOpen(true);
    };

    // Auto-generate slug when name changes for new plan
    const handleNameChange = (val) => {
        const updated = { ...formData, name: val };
        if (!editingPlan) {
            updated.slug = val
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }
        setFormData(updated);
    };

    const toggleFeatureKey = (key) => {
        setFormData((prev) => {
            const has = prev.features.includes(key);
            const next = has
                ? prev.features.filter((k) => k !== key)
                : [...prev.features, key];
            return { ...prev, features: next };
        });
    };

    const toggleAllCategoryFeatures = (catKey, selectAll) => {
        const catFeatures = Object.keys(featureCatalog[catKey]?.features || {});
        setFormData((prev) => {
            let next;
            if (selectAll) {
                next = Array.from(new Set([...prev.features, ...catFeatures]));
            } else {
                next = prev.features.filter((k) => !catFeatures.includes(k));
            }
            return { ...prev, features: next };
        });
    };

    const handleSavePlan = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!formData.name.trim()) {
            setFormError('Plan name is required.');
            return;
        }

        const priceNum = parseFloat(formData.price) || 0;
        if (priceNum < 0) {
            setFormError('Price cannot be negative.');
            return;
        }

        if (formData.is_default && priceNum > 0) {
            setFormError('Default plan for new workspaces must be a Free Plan (₹0).');
            return;
        }

        const payload = {
            name: formData.name.trim(),
            slug: formData.slug.trim() || undefined,
            description: formData.description.trim() || null,
            price: priceNum,
            currency: 'INR',
            invoice_interval: formData.invoice_interval,
            monthly_scan_allowance: formData.unlimited_scans ? -1 : (parseInt(formData.monthly_scan_allowance, 10) || 0),
            max_team_members: formData.unlimited_team ? -1 : (parseInt(formData.max_team_members, 10) || 1),
            max_workspaces: formData.unlimited_workspaces ? -1 : (parseInt(formData.max_workspaces, 10) || 1),
            max_active_exhibitions: formData.unlimited_exhibitions ? -1 : (parseInt(formData.max_active_exhibitions, 10) || 1),
            features: formData.features,
            is_active: Boolean(formData.is_active),
            is_default: Boolean(formData.is_default),
        };

        setIsSaving(true);
        try {
            if (editingPlan) {
                const res = await updateAdminPlan(editingPlan.id, payload);
                if (res.success) {
                    showToast(`Plan '${payload.name}' updated successfully in ₹ (INR).`, 'success');
                    setIsModalOpen(false);
                    loadPlans();
                } else {
                    setFormError(res.message || 'Failed to update plan.');
                }
            } else {
                const res = await createAdminPlan(payload);
                if (res.success) {
                    showToast(`Plan '${payload.name}' created successfully in ₹ (INR).`, 'success');
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
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                            SaaS Plans & Pricing
                        </h1>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                            INR (₹) Standard
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        Configure Indian Rupee pricing tiers, monthly scan credits, team limits, and feature entitlements.
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
                        {plans.filter((p) => p.is_active).length} active tiers in ₹ (INR)
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
                        Across customer workspaces
                    </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                        <span className="text-xs font-medium">Currency & Billing</span>
                        <span className="text-base font-bold text-orange-500">₹ INR</span>
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                        Indian Rupee Default
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                        Consistent decimal storage & ₹ formatting
                    </div>
                </div>
            </div>

            {/* Plans List Table */}
            <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                            Configured SaaS Tiers
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            Real-time workspace adoption and entitlements
                        </p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                        <p className="text-xs">Loading plans...</p>
                    </div>
                ) : plans.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
                        <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No plans configured yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/75 dark:bg-zinc-900/90 text-slate-500 dark:text-zinc-400 border-b border-slate-200/80 dark:border-zinc-800/80 uppercase text-[10px] tracking-wider font-semibold">
                                <tr>
                                    <th className="px-4 py-3">Plan Details</th>
                                    <th className="px-4 py-3">Price (₹ INR)</th>
                                    <th className="px-4 py-3">Scan Quota</th>
                                    <th className="px-4 py-3">Limits (Team / WS / Expo)</th>
                                    <th className="px-4 py-3">Features</th>
                                    <th className="px-4 py-3">Active Subscribers</th>
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
                                            <div className="flex items-center gap-2.5">
                                                <div className="size-8 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-xs shrink-0">
                                                    {plan.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold">{plan.name}</span>
                                                        {plan.is_default && (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                                <Crown className="w-2.5 h-2.5" />
                                                                Default Free
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">
                                                        {plan.slug}
                                                    </div>
                                                    {plan.description && (
                                                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 max-w-xs truncate mt-0.5">
                                                            {plan.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="font-bold text-slate-900 dark:text-white">
                                                {plan.price === 0 ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400">₹0 (Free)</span>
                                                ) : (
                                                    `₹${Number(plan.price).toLocaleString('en-IN')}`
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 capitalize">
                                                per {plan.invoice_interval || 'month'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {plan.monthly_scan_allowance === -1 ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                                    <Zap className="w-3 h-3" />
                                                    Unlimited
                                                </span>
                                            ) : (
                                                <div>
                                                    <span className="font-bold text-slate-900 dark:text-white">
                                                        {plan.monthly_scan_allowance.toLocaleString()}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                                                        scans / month
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-[11px] space-y-0.5 font-mono text-slate-600 dark:text-zinc-400">
                                            <div>
                                                Team: <strong className="text-slate-900 dark:text-white">{plan.max_team_members === -1 ? '∞' : plan.max_team_members}</strong>
                                            </div>
                                            <div>
                                                WS: <strong className="text-slate-900 dark:text-white">{plan.max_workspaces === -1 ? '∞' : plan.max_workspaces}</strong>
                                            </div>
                                            <div>
                                                Expos: <strong className="text-slate-900 dark:text-white">{plan.max_active_exhibitions === -1 ? '∞' : plan.max_active_exhibitions}</strong>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                                                <Layers className="w-3 h-3 text-slate-400" />
                                                {(plan.features || []).length} features
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
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
                                                Edit Plan
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

            {/* Structured 4-Section Plan Editor Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-3xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-950/50">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    {editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New SaaS Plan'}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                    Configured in Indian Rupee (₹ INR) with structured limit and feature gates.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSavePlan} className="flex-1 overflow-y-auto p-6 space-y-6">
                            {formError && (
                                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                                    <span>{formError}</span>
                                </div>
                            )}

                            {/* Section 1: Basic Details */}
                            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800/80 pb-2">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        <span className="size-5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center text-[10px]">1</span>
                                        Basic Details
                                    </h4>
                                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Identity & Default Assignment</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                                            Plan Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => handleNameChange(e.target.value)}
                                            placeholder="e.g. Pro, Growth, Enterprise"
                                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                                            Unique Slug *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.slug}
                                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                            placeholder="pro, business, free"
                                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                                        Short Description
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Target audience and tier summary..."
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                    <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="rounded border-slate-300 dark:border-zinc-700 text-orange-500 focus:ring-orange-500"
                                        />
                                        <div>
                                            <div className="text-xs font-semibold text-slate-900 dark:text-white">Active Plan</div>
                                            <div className="text-[10px] text-slate-500 dark:text-zinc-400">Available for customer selection/assignment</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_default}
                                            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked, price: e.target.checked ? 0 : formData.price })}
                                            className="rounded border-slate-300 dark:border-zinc-700 text-orange-500 focus:ring-orange-500"
                                        />
                                        <div>
                                            <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                                <Crown className="w-3 h-3 text-amber-500" /> Default Free Plan
                                            </div>
                                            <div className="text-[10px] text-slate-500 dark:text-zinc-400">Auto-assigned to new customer workspaces (₹0)</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Section 2: Pricing & Billing */}
                            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800/80 pb-2">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        <span className="size-5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center text-[10px]">2</span>
                                        Pricing & Billing (₹ INR)
                                    </h4>
                                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Decimal Amount in Rupees</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                                            Price (₹ INR) *
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-sm pointer-events-none">
                                                ₹
                                            </span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                required
                                                disabled={formData.is_default}
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-60"
                                            />
                                        </div>
                                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
                                            {formData.is_default ? 'Locked at ₹0.00 for default Free tier' : 'Store as decimal amount in INR'}
                                        </span>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                                            Billing Interval *
                                        </label>
                                        <select
                                            value={formData.invoice_interval}
                                            onChange={(e) => setFormData({ ...formData, invoice_interval: e.target.value })}
                                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                        >
                                            <option value="month">Monthly (per month)</option>
                                            <option value="year">Yearly (per year)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Plan Limits */}
                            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800/80 pb-2">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        <span className="size-5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center text-[10px]">3</span>
                                        Plan Limits & Capacity
                                    </h4>
                                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Validated by Backend</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Scan Allowance */}
                                    <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                                Monthly Scans
                                            </label>
                                            <label className="flex items-center gap-1.5 text-[11px] font-medium text-orange-600 dark:text-orange-400 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.unlimited_scans}
                                                    onChange={(e) => setFormData({ ...formData, unlimited_scans: e.target.checked })}
                                                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                                />
                                                Unlimited (∞)
                                            </label>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            disabled={formData.unlimited_scans}
                                            value={formData.unlimited_scans ? '' : formData.monthly_scan_allowance}
                                            onChange={(e) => setFormData({ ...formData, monthly_scan_allowance: e.target.value })}
                                            placeholder={formData.unlimited_scans ? 'Unlimited scans' : 'e.g. 500'}
                                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                                        />
                                    </div>

                                    {/* Team Members */}
                                    <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                                Max Team Members
                                            </label>
                                            <label className="flex items-center gap-1.5 text-[11px] font-medium text-orange-600 dark:text-orange-400 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.unlimited_team}
                                                    onChange={(e) => setFormData({ ...formData, unlimited_team: e.target.checked })}
                                                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                                />
                                                Unlimited (∞)
                                            </label>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            disabled={formData.unlimited_team}
                                            value={formData.unlimited_team ? '' : formData.max_team_members}
                                            onChange={(e) => setFormData({ ...formData, max_team_members: e.target.value })}
                                            placeholder={formData.unlimited_team ? 'Unlimited members' : 'e.g. 5'}
                                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                                        />
                                    </div>

                                    {/* Workspaces */}
                                    <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                                Max Workspaces
                                            </label>
                                            <label className="flex items-center gap-1.5 text-[11px] font-medium text-orange-600 dark:text-orange-400 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.unlimited_workspaces}
                                                    onChange={(e) => setFormData({ ...formData, unlimited_workspaces: e.target.checked })}
                                                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                                />
                                                Unlimited (∞)
                                            </label>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            disabled={formData.unlimited_workspaces}
                                            value={formData.unlimited_workspaces ? '' : formData.max_workspaces}
                                            onChange={(e) => setFormData({ ...formData, max_workspaces: e.target.value })}
                                            placeholder={formData.unlimited_workspaces ? 'Unlimited workspaces' : 'e.g. 3'}
                                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                                        />
                                    </div>

                                    {/* Active Exhibitions */}
                                    <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                                Max Active Expos
                                            </label>
                                            <label className="flex items-center gap-1.5 text-[11px] font-medium text-orange-600 dark:text-orange-400 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.unlimited_exhibitions}
                                                    onChange={(e) => setFormData({ ...formData, unlimited_exhibitions: e.target.checked })}
                                                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                                />
                                                Unlimited (∞)
                                            </label>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            disabled={formData.unlimited_exhibitions}
                                            value={formData.unlimited_exhibitions ? '' : formData.max_active_exhibitions}
                                            onChange={(e) => setFormData({ ...formData, max_active_exhibitions: e.target.value })}
                                            placeholder={formData.unlimited_exhibitions ? 'Unlimited expos' : 'e.g. 5'}
                                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Categorized Included Features Library */}
                            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800/80 pb-2">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        <span className="size-5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center text-[10px]">4</span>
                                        Included Features Library ({formData.features.length} selected)
                                    </h4>
                                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Checked keys saved as structured JSON</span>
                                </div>

                                <div className="space-y-4">
                                    {Object.entries(featureCatalog).map(([catKey, cat]) => {
                                        const CatIcon = CATEGORY_ICONS[catKey] || Layers;
                                        const catFeatures = Object.entries(cat.features || {});
                                        const allCatSelected = catFeatures.every(([k]) => formData.features.includes(k));

                                        return (
                                            <div
                                                key={catKey}
                                                className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <CatIcon className="w-4 h-4 text-orange-500" />
                                                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                            {cat.category}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAllCategoryFeatures(catKey, !allCatSelected)}
                                                        className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline font-medium cursor-pointer"
                                                    >
                                                        {allCatSelected ? 'Clear All' : 'Select All'}
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {catFeatures.map(([featKey, feat]) => {
                                                        const isChecked = formData.features.includes(featKey);
                                                        return (
                                                            <div
                                                                key={featKey}
                                                                onClick={() => toggleFeatureKey(featKey)}
                                                                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                                                                    isChecked
                                                                        ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800/60'
                                                                        : 'bg-slate-50/50 dark:bg-zinc-950/30 border-slate-200/80 dark:border-zinc-800/80 opacity-70 hover:opacity-100'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {}} // Handled by div onClick
                                                                    className="mt-0.5 rounded border-slate-300 text-orange-500 focus:ring-orange-500 shrink-0 pointer-events-none"
                                                                />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                                                            {feat.name}
                                                                        </span>
                                                                        <code className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono">
                                                                            {featKey}
                                                                        </code>
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                                                                        {feat.description}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800 sticky bottom-0 bg-white dark:bg-zinc-900">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    {editingPlan ? 'Save Plan Changes' : 'Create Plan in ₹'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
