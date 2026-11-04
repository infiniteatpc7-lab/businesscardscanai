import React, { useState, useEffect } from 'react';
import {
    User,
    Sparkles,
    CreditCard,
    Settings,
    FileSpreadsheet,
    Languages,
    ShieldCheck,
    Database,
    CheckCircle2,
    LogOut,
    Briefcase,
    Users,
    ChevronRight,
    Building2,
    Calendar
} from 'lucide-react';
import WorkspaceModal from '../components/workspace/WorkspaceModal';
import TeamMembersModal from '../components/workspace/TeamMembersModal';
import ExhibitionSelectorModal from '../components/exhibition/ExhibitionSelectorModal';
import ExhibitionManageModal from '../components/exhibition/ExhibitionManageModal';
import CustomerSubscriptionDashboard from '../components/subscription/CustomerSubscriptionDashboard';
import { fetchCustomerSubscription } from '../services/cardApi';

export default function MobileProfilePage({
    cardsCount = 0,
    onExportCSV,
    user = null,
    workspace = null,
    workspaces = [],
    onWorkspaceChanged,
    currentExhibition = null,
    onExhibitionChanged,
    onLogout,
    quota = null,
    onQuotaRefresh = null,
}) {
    const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [isExhibitionSelectorOpen, setIsExhibitionSelectorOpen] = useState(false);
    const [isExhibitionManageOpen, setIsExhibitionManageOpen] = useState(false);
    const [isSubscriptionDashboardOpen, setIsSubscriptionDashboardOpen] = useState(false);
    const [localQuota, setLocalQuota] = useState(quota);

    useEffect(() => {
        if (quota) {
            setLocalQuota(quota);
        }
    }, [quota]);

    useEffect(() => {
        let isMounted = true;
        fetchCustomerSubscription().then((res) => {
            if (isMounted && res?.success && res?.quota) {
                setLocalQuota(res.quota);
            }
        }).catch(() => {});
        return () => {
            isMounted = false;
        };
    }, [workspace?.id]);

    const displayName = user?.name || 'Saunak K.';
    const displayEmail = user?.email || 'booth@ceramix.com';
    const displayWorkspace = workspace?.name || 'Ceramix India Expo 2026';
    const displayRole = (workspace?.role || 'owner').toUpperCase();

    const isOwnerOrAdmin = ['owner', 'admin'].includes((workspace?.role || '').toLowerCase());

    const activeQuota = localQuota || quota;
    const planAllowance = activeQuota?.monthly_allowance ?? workspace?.monthly_scan_allowance ?? (workspace?.plan_name === 'Free' || !workspace?.plan_name ? 5 : 500);
    const isUnlimited = activeQuota ? activeQuota.is_unlimited : (planAllowance === -1);
    const usedCredits = activeQuota?.used_credits ?? 0;
    const reservedCredits = activeQuota?.reserved_credits ?? 0;
    const remainingCredits = isUnlimited ? null : (activeQuota ? activeQuota.remaining_credits : Math.max(0, planAllowance - usedCredits));

    const progressPercent = isUnlimited
        ? 0
        : planAllowance > 0
        ? Math.min(100, Math.round((usedCredits / planAllowance) * 100))
        : 0;

    // Get initials for avatar
    const initials = displayName
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'SK';

    return (
        <div className="space-y-4 pb-24">
            {/* Profile Bento Tile with Workspace Switcher */}
            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-white flex items-center justify-center text-lg font-extrabold shadow-sm">
                        {initials}
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-base text-zinc-950 truncate">{displayName}</h3>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                {displayRole}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 font-medium truncate">{displayWorkspace}</p>
                        <p className="text-[10px] text-zinc-400 font-mono truncate">{displayEmail}</p>
                    </div>
                </div>

                {/* Workspace Switcher Trigger Bar */}
                <button
                    onClick={() => setIsWorkspaceModalOpen(true)}
                    className="w-full p-3 rounded-2xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/70 flex items-center justify-between text-left transition-all active:scale-[0.98]"
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-800">
                            <Briefcase className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] uppercase font-bold text-zinc-400 block">Active Workspace</span>
                            <span className="text-xs font-bold text-zinc-900 truncate block">{displayWorkspace}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-zinc-400">
                        <span className="text-[11px] font-semibold text-zinc-500">Switch</span>
                        <ChevronRight className="w-4 h-4" />
                    </div>
                </button>

                {/* Current Active Exhibition Trigger Bar */}
                <button
                    onClick={() => setIsExhibitionSelectorOpen(true)}
                    className="w-full p-3 rounded-2xl bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-200/60 flex items-center justify-between text-left transition-all active:scale-[0.98]"
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-700">
                            <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] uppercase font-bold text-indigo-500 block">Selected Exhibition</span>
                            <span className="text-xs font-bold text-indigo-950 truncate block">
                                {currentExhibition?.name || 'General Exhibition'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-indigo-400">
                        <span className="text-[11px] font-semibold text-indigo-600">Change</span>
                        <ChevronRight className="w-4 h-4" />
                    </div>
                </button>
            </div>

            {/* Exhibition Management (Owner & Admin) */}
            {isOwnerOrAdmin && (
                <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-zinc-800" />
                            <h4 className="text-xs font-bold text-zinc-950">Exhibitions & Shows</h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Lead Capture
                        </span>
                    </div>

                    <p className="text-xs text-zinc-500 leading-relaxed">
                        Create and organize trade fair shows to segment leads and track staff scans.
                    </p>

                    <button
                        onClick={() => setIsExhibitionManageOpen(true)}
                        className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Manage Exhibitions</span>
                    </button>
                </div>
            )}

            {/* Team & Staff Management (Owner & Admin) */}
            {isOwnerOrAdmin && (
                <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-zinc-800" />
                            <h4 className="text-xs font-bold text-zinc-950">Team & Booth Staff</h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                            Collaboration
                        </span>
                    </div>

                    <p className="text-xs text-zinc-500 leading-relaxed">
                        Invite staff members to scan cards under <strong>{displayWorkspace}</strong>.
                    </p>

                    <button
                        onClick={() => setIsTeamModalOpen(true)}
                        className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                        <Users className="w-3.5 h-3.5" />
                        <span>Manage Team & Invitations</span>
                    </button>
                </div>
            )}

            {/* Plan & Usage Bento Tile */}
            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-3.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-zinc-800" />
                        <h4 className="text-xs font-bold text-zinc-950">Subscription & Scan Quota</h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                        {workspace?.plan_name || 'Free'}
                    </span>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                        <span className="text-zinc-600">Scan Credits</span>
                        <span className="font-mono text-zinc-950">
                            {usedCredits}
                            <span className="text-zinc-400 font-normal"> / {isUnlimited ? '∞' : planAllowance} credits used</span>
                        </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-black rounded-full transition-all duration-300"
                            style={{ width: `${usedCredits > 0 ? Math.min(100, Math.max(8, progressPercent)) : 0}%` }}
                        ></div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
                        <span>1 Card = 1 Scan Credit</span>
                        {isUnlimited ? (
                            <span className="text-zinc-600 font-semibold">Unlimited Scans</span>
                        ) : (
                            <div className="flex items-center gap-1.5 font-semibold text-zinc-600">
                                {reservedCredits > 0 && (
                                    <span className="text-amber-600 font-medium">
                                        {reservedCredits} processing ·{' '}
                                    </span>
                                )}
                                <span className={remainingCredits <= 0 ? 'text-amber-600 font-bold' : 'text-zinc-600'}>
                                    {remainingCredits <= 0 ? '0 credits remaining' : `${remainingCredits} available`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => setIsSubscriptionDashboardOpen(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Manage Subscription & Usage</span>
                </button>
            </div>

            {/* Business Preferences Bento Tile */}
            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <Languages className="w-4 h-4 text-zinc-800" />
                    <h4 className="text-xs font-bold text-zinc-950">Scanner Settings</h4>
                </div>

                <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                        <div>
                            <span className="font-bold text-zinc-900 block">Language Support</span>
                            <span className="text-[10px] text-zinc-500">Gujarati, Hindi & English</span>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                        <div>
                            <span className="font-bold text-zinc-900 block">Mobile Optimization</span>
                            <span className="text-[10px] text-zinc-500">Fast Upload & Image Processing</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                        <div>
                            <span className="font-bold text-zinc-900 block">Processing Engine</span>
                            <span className="text-[10px] text-zinc-500">CardScan Neural Processor</span>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-zinc-700">v2.0</span>
                    </div>
                </div>
            </div>

            {/* Data Management & Session Tile */}
            <div className="bg-white rounded-3xl p-5 shadow-behance border border-black/[0.04] space-y-3">
                <h4 className="text-xs font-bold text-zinc-950">Data & Security</h4>

                <div className="space-y-2">
                    <button
                        onClick={onExportCSV}
                        className="w-full py-3 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-zinc-700" />
                        <span>Export All Contacts as CSV</span>
                    </button>

                    {onLogout && (
                        <button
                            onClick={onLogout}
                            className="w-full py-3 px-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 border border-red-200/60"
                        >
                            <LogOut className="w-4 h-4 text-red-600" />
                            <span>Sign Out of Workspace</span>
                        </button>
                    )}
                </div>
            </div>

            {/* App Footer */}
            <div className="text-center pt-2 space-y-1">
                <p className="text-[11px] font-bold text-zinc-400">CardScan AI · SaaS v2.0</p>
                <p className="text-[10px] text-zinc-400">Built for high-velocity trade fair booth lead management</p>
            </div>

            {/* Modals */}
            <WorkspaceModal
                isOpen={isWorkspaceModalOpen}
                onClose={() => setIsWorkspaceModalOpen(false)}
                workspaces={workspaces}
                currentWorkspace={workspace}
                onWorkspaceChanged={onWorkspaceChanged}
            />

            <TeamMembersModal
                isOpen={isTeamModalOpen}
                onClose={() => setIsTeamModalOpen(false)}
                workspace={workspace}
                currentUser={user}
            />

            <ExhibitionSelectorModal
                isOpen={isExhibitionSelectorOpen}
                onClose={() => setIsExhibitionSelectorOpen(false)}
                currentExhibition={currentExhibition}
                onExhibitionChanged={onExhibitionChanged}
                userRole={workspace?.role || 'member'}
                onOpenManage={() => setIsExhibitionManageOpen(true)}
            />

            <ExhibitionManageModal
                isOpen={isExhibitionManageOpen}
                onClose={() => setIsExhibitionManageOpen(false)}
                currentWorkspace={workspace}
                userRole={workspace?.role || 'owner'}
                onExhibitionUpdated={onExhibitionChanged}
            />

            {/* Customer Subscription & Usage Dashboard */}
            <CustomerSubscriptionDashboard
                isOpen={isSubscriptionDashboardOpen}
                onClose={() => setIsSubscriptionDashboardOpen(false)}
                currentWorkspace={workspace}
                userRole={workspace?.role || 'owner'}
                onSwitchWorkspace={onWorkspaceChanged}
                workspaces={workspaces}
            />
        </div>
    );
}
