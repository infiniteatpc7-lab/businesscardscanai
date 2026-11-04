import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Briefcase,
    Check,
    Plus,
    X,
    Users,
    CreditCard,
    ArrowRight
} from 'lucide-react';
import { switchWorkspace, createWorkspace } from '../../services/cardApi';
import { useToast } from '../../context/ToastContext';

export default function WorkspaceModal({
    isOpen,
    onClose,
    workspaces = [],
    currentWorkspace,
    onWorkspaceChanged
}) {
    if (!isOpen) return null;

    const { showToast } = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSwitch = async (workspace) => {
        if (workspace.id === currentWorkspace?.id) {
            onClose();
            return;
        }

        try {
            const res = await switchWorkspace(workspace.id);
            if (res.success) {
                showToast(`Switched to "${workspace.name}"`, 'success');
                onWorkspaceChanged?.(res.current_workspace);
                onClose();
            } else {
                showToast(res.message || 'Failed to switch workspace', 'error');
            }
        } catch (err) {
            console.error('Switch workspace error:', err);
            showToast('Failed to switch workspace', 'error');
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const trimmed = newWorkspaceName.trim();
        if (!trimmed) return;

        setIsSubmitting(true);
        try {
            const res = await createWorkspace(trimmed);
            if (res.success && res.workspace) {
                showToast(`Workspace "${res.workspace.name}" created!`, 'success');
                setNewWorkspaceName('');
                setIsCreating(false);
                onWorkspaceChanged?.(res.workspace);
                onClose();
            } else {
                const isPlanError = ['PLAN_LIMIT_EXCEEDED', 'FEATURE_NOT_INCLUDED', 'QUOTA_EXCEEDED'].includes(res?.error_code);
                if (!isPlanError) {
                    showToast(res.message || 'Failed to create workspace', 'error');
                }
            }
        } catch (err) {
            console.error('Create workspace error:', err);
            showToast('Failed to create workspace', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div
                className="fixed inset-0 -z-10"
                onClick={onClose}
            />

            <div className="relative bg-white rounded-t-[32px] sm:rounded-3xl p-6 pb-8 w-full max-w-md shadow-2xl space-y-4 z-10 max-h-[85vh] overflow-y-auto animate-tab-fade">
                {/* Mobile grabber */}
                <div
                    onClick={onClose}
                    className="w-10 h-1 bg-zinc-300 rounded-full mx-auto sm:hidden mb-2 -mt-1 cursor-pointer"
                />

                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 font-bold">
                            <Briefcase className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold text-zinc-950">Switch Workspace</h3>
                            <p className="text-[11px] text-zinc-400">Select active booth or team workspace</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition-colors active:scale-95"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Workspace List */}
                <div className="space-y-2">
                    {workspaces.map((ws) => {
                        const isCurrent = ws.id === currentWorkspace?.id;
                        return (
                            <button
                                key={ws.id}
                                onClick={() => handleSwitch(ws)}
                                className={`w-full p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] flex items-center justify-between gap-3 ${
                                    isCurrent
                                        ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                                        : 'bg-zinc-50/80 hover:bg-zinc-100 text-zinc-900 border-zinc-200/70'
                                }`}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-sm truncate">{ws.name}</span>
                                        <span
                                            className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                                                isCurrent
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-zinc-200/70 text-zinc-700'
                                            }`}
                                        >
                                            {ws.role || 'Member'}
                                        </span>
                                    </div>
                                    <div className={`flex items-center gap-3 text-[11px] mt-1 ${isCurrent ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                        {ws.cards_count !== undefined && (
                                            <span className="flex items-center gap-1">
                                                <CreditCard className="w-3 h-3" />
                                                <span>{ws.cards_count} cards</span>
                                            </span>
                                        )}
                                        {ws.members_count !== undefined && (
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                <span>{ws.members_count} staff</span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {isCurrent && (
                                    <div className="w-6 h-6 rounded-full bg-white text-zinc-950 flex items-center justify-center shrink-0">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Inline Workspace Creation */}
                {isCreating ? (
                    <form onSubmit={handleCreate} className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-900">New Workspace Name</span>
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="text-zinc-400 hover:text-zinc-700 text-xs font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                        <input
                            type="text"
                            value={newWorkspaceName}
                            onChange={(e) => setNewWorkspaceName(e.target.value)}
                            placeholder="e.g. Morbi Expo 2026 Booth"
                            className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-zinc-200 focus:outline-none focus:border-black font-medium"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting || !newWorkspaceName.trim()}
                            className="w-full py-2.5 rounded-xl bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <span>{isSubmitting ? 'Creating...' : 'Create & Switch'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </form>
                ) : (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-200 hover:border-zinc-400 text-zinc-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create New Workspace</span>
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
}

