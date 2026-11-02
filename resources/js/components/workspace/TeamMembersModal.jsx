import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Users,
    UserPlus,
    X,
    Mail,
    Shield,
    Trash2,
    Copy,
    RefreshCw,
    Check,
    AlertCircle
} from 'lucide-react';
import {
    fetchWorkspaceMembers,
    inviteWorkspaceMember,
    resendInvitation,
    revokeInvitation,
    updateMemberRole,
    removeMember
} from '../../services/cardApi';
import { useToast } from '../../context/ToastContext';

export default function TeamMembersModal({
    isOpen,
    onClose,
    workspace,
    currentUser
}) {
    if (!isOpen || !workspace) return null;

    const { showToast } = useToast();
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Invite Form
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('member');
    const [isInviting, setIsInviting] = useState(false);
    const [copiedInviteId, setCopiedInviteId] = useState(null);

    const userRole = workspace.role || 'member';
    const isOwner = userRole === 'owner';
    const isAdmin = userRole === 'admin';
    const canManageTeam = isOwner || isAdmin;

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await fetchWorkspaceMembers(workspace.id);
            if (res.success) {
                setMembers(res.members || []);
                setInvitations(res.invitations || []);
            } else {
                showToast(res.message || 'Failed to load team members', 'error');
            }
        } catch (err) {
            console.error('Load members error:', err);
            showToast('Failed to load team data', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [workspace.id]);

    const handleInvite = async (e) => {
        e.preventDefault();
        const email = inviteEmail.trim();
        if (!email) return;

        setIsInviting(true);
        try {
            const res = await inviteWorkspaceMember(workspace.id, email, inviteRole);
            if (res.success) {
                showToast(res.message || 'Invitation created!', 'success');
                setInviteEmail('');
                setInviteRole('member');
                loadData();
            } else {
                showToast(res.message || 'Failed to send invitation', 'error');
            }
        } catch (err) {
            console.error('Invite error:', err);
            showToast('Failed to send invitation', 'error');
        } finally {
            setIsInviting(false);
        }
    };

    const handleCopyLink = async (invite) => {
        const fullLink = `${window.location.origin}/invitations/${invite.token || ''}`;
        try {
            await navigator.clipboard.writeText(fullLink);
            setCopiedInviteId(invite.id);
            showToast('Invitation link copied to clipboard!', 'info');
            setTimeout(() => setCopiedInviteId(null), 3000);
        } catch {
            showToast('Could not copy link to clipboard', 'error');
        }
    };

    const handleResend = async (inviteId) => {
        try {
            const res = await resendInvitation(workspace.id, inviteId);
            if (res.success) {
                showToast(res.message || 'Invitation resent successfully!', 'success');
                loadData();
            } else {
                showToast(res.message || 'Failed to resend invitation', 'error');
            }
        } catch (err) {
            console.error('Resend error:', err);
            showToast('Failed to resend invitation', 'error');
        }
    };

    const handleRevoke = async (inviteId) => {
        try {
            const res = await revokeInvitation(workspace.id, inviteId);
            if (res.success) {
                showToast('Invitation revoked', 'info');
                loadData();
            } else {
                showToast(res.message || 'Failed to revoke invitation', 'error');
            }
        } catch (err) {
            console.error('Revoke error:', err);
            showToast('Failed to revoke invitation', 'error');
        }
    };

    const handleRemoveMember = async (member) => {
        if (!window.confirm(`Remove ${member.name} from "${workspace.name}"? Their account and cards will remain safe.`)) {
            return;
        }

        try {
            const res = await removeMember(workspace.id, member.id);
            if (res.success) {
                showToast(`${member.name} removed from workspace`, 'info');
                loadData();
            } else {
                showToast(res.message || 'Failed to remove member', 'error');
            }
        } catch (err) {
            console.error('Remove member error:', err);
            showToast('Failed to remove member', 'error');
        }
    };

    const handleRoleChange = async (member, newRole) => {
        if (member.role === newRole) return;

        try {
            const res = await updateMemberRole(workspace.id, member.id, newRole);
            if (res.success) {
                showToast(`Updated ${member.name} to ${newRole}`, 'success');
                loadData();
            } else {
                showToast(res.message || 'Failed to update member role', 'error');
            }
        } catch (err) {
            console.error('Update role error:', err);
            showToast('Failed to update member role', 'error');
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="fixed inset-0 -z-10" onClick={onClose} />

            <div className="relative bg-white rounded-t-[32px] sm:rounded-3xl p-6 pb-8 w-full max-w-md shadow-2xl space-y-4 z-10 max-h-[88vh] overflow-y-auto animate-tab-fade">
                {/* Mobile grabber */}
                <div
                    onClick={onClose}
                    className="w-10 h-1 bg-zinc-300 rounded-full mx-auto sm:hidden mb-2 -mt-1 cursor-pointer"
                />

                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 font-bold">
                            <Users className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold text-zinc-950">Team & Booth Staff</h3>
                            <p className="text-[11px] text-zinc-400">{workspace.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition-colors active:scale-95"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Invite Form (Owner / Admin only) */}
                {canManageTeam && (
                    <form onSubmit={handleInvite} className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                            <UserPlus className="w-3.5 h-3.5 text-zinc-600" />
                            <span>Invite Collaborator</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="colleague@company.com"
                                className="sm:col-span-2 px-3 py-2 text-xs rounded-xl bg-white border border-zinc-200 focus:outline-none focus:border-black font-medium"
                                required
                            />
                            <select
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value)}
                                className="px-2 py-2 text-xs rounded-xl bg-white border border-zinc-200 focus:outline-none focus:border-black font-bold uppercase tracking-wider text-zinc-700"
                            >
                                <option value="member">Member</option>
                                {isOwner && <option value="admin">Admin</option>}
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={isInviting || !inviteEmail.trim()}
                            className="w-full py-2 rounded-xl bg-black text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isInviting ? 'Sending Invite...' : 'Send Invitation'}
                        </button>
                    </form>
                )}

                {/* Active Members List */}
                <div className="space-y-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Active Members ({members.length})
                    </span>

                    {members.map((member) => {
                        const isSelf = member.id === currentUser?.id;
                        const canModifyThisMember =
                            (isOwner && member.role !== 'owner') ||
                            (isAdmin && member.role === 'member' && !isSelf);

                        return (
                            <div
                                key={member.id}
                                className="p-3 rounded-2xl bg-zinc-50/60 border border-zinc-200/60 flex items-center justify-between gap-3 text-xs"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-zinc-900 truncate">{member.name}</span>
                                        {isSelf && (
                                            <span className="text-[9px] bg-zinc-200 text-zinc-700 px-1.5 py-0.2 rounded font-bold">
                                                You
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-zinc-400 font-mono block truncate">
                                        {member.email}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {isOwner && member.role !== 'owner' ? (
                                        <select
                                            value={member.role}
                                            onChange={(e) => handleRoleChange(member, e.target.value)}
                                            className="px-2 py-1 rounded-lg bg-white border border-zinc-200 text-[11px] font-bold uppercase text-zinc-800 focus:outline-none"
                                        >
                                            <option value="member">Member</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    ) : (
                                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-800">
                                            {member.role}
                                        </span>
                                    )}

                                    {canModifyThisMember && (
                                        <button
                                            onClick={() => handleRemoveMember(member)}
                                            className="w-7 h-7 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                                            title="Remove member"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Pending Invitations */}
                {invitations.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-100">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Pending Invitations ({invitations.length})
                        </span>

                        {invitations.map((inv) => (
                            <div
                                key={inv.id}
                                className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/50 flex items-center justify-between gap-3 text-xs"
                            >
                                <div className="min-w-0 flex-1">
                                    <span className="font-semibold text-zinc-900 block truncate">{inv.email}</span>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                                        <span className="font-bold uppercase font-mono text-amber-700">{inv.role}</span>
                                        <span>•</span>
                                        <span>{inv.is_expired ? 'Expired' : 'Pending'}</span>
                                    </div>
                                </div>

                                {canManageTeam && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => handleResend(inv.id)}
                                            className="w-7 h-7 rounded-lg hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors"
                                            title="Resend invitation"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleRevoke(inv.id)}
                                            className="w-7 h-7 rounded-lg hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors"
                                            title="Revoke invitation"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
