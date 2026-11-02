import React, { useState } from 'react';
import { Lock, Mail, User, Building, LogIn, UserPlus, AlertCircle, ShieldCheck } from 'lucide-react';
import { loginUser, registerUser } from '../../services/cardApi';

export default function AuthModal({ isOpen, onSuccess }) {
    if (!isOpen) return null;

    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [workspaceName, setWorkspaceName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setIsLoading(true);

        try {
            if (mode === 'login') {
                const res = await loginUser(email, password);
                if (res.success) {
                    onSuccess(res);
                } else {
                    setErrorMessage(res.message || 'Invalid email or password.');
                }
            } else {
                if (password.length < 8) {
                    setErrorMessage('Password must be at least 8 characters.');
                    setIsLoading(false);
                    return;
                }
                const res = await registerUser(name, email, password, workspaceName);
                if (res.success) {
                    onSuccess(res);
                } else {
                    setErrorMessage(res.message || 'Registration failed. Please check inputs.');
                }
            }
        } catch {
            setErrorMessage('Network connection error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-black/10 space-y-5 animate-scale-up">
                {/* Header */}
                <div className="text-center space-y-1.5">
                    <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h2 className="text-lg font-extrabold text-zinc-950">
                        {mode === 'login' ? 'Sign in to CardScan AI' : 'Create Workspace Account'}
                    </h2>
                    <p className="text-xs text-zinc-500 font-medium">
                        {mode === 'login'
                            ? 'Enter your credentials to access your cards & scanner.'
                            : 'Set up your secure business card directory & team workspace.'}
                    </p>
                </div>

                {/* Mode Selector Tabs */}
                <div className="grid grid-cols-2 p-1 bg-zinc-100 rounded-2xl text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => { setMode('login'); setErrorMessage(''); }}
                        className={`py-2 rounded-xl transition-all ${
                            mode === 'login' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                        }`}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode('register'); setErrorMessage(''); }}
                        className={`py-2 rounded-xl transition-all ${
                            mode === 'register' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                        }`}
                    >
                        Register
                    </button>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200/60 rounded-2xl text-red-700 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                    {mode === 'register' && (
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-700 mb-1">Your Full Name</label>
                            <div className="relative">
                                <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Saunak Patel"
                                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-200 focus:outline-none focus:border-black font-medium text-zinc-900"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[11px] font-bold text-zinc-700 mb-1">Email Address</label>
                        <div className="relative">
                            <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-200 focus:outline-none focus:border-black font-medium text-zinc-900"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-zinc-700 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-200 focus:outline-none focus:border-black font-medium text-zinc-900"
                            />
                        </div>
                    </div>

                    {mode === 'register' && (
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-700 mb-1">Workspace Name (Optional)</label>
                            <div className="relative">
                                <Building className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={workspaceName}
                                    onChange={(e) => setWorkspaceName(e.target.value)}
                                    placeholder="e.g. Ceramix Expo Team"
                                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-200 focus:outline-none focus:border-black font-medium text-zinc-900"
                                />
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 rounded-2xl bg-black hover:bg-zinc-800 text-white font-extrabold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                    >
                        {isLoading ? (
                            <span className="animate-pulse">Authenticating...</span>
                        ) : mode === 'login' ? (
                            <>
                                <LogIn className="w-4 h-4" />
                                <span>Sign In to Workspace</span>
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-4 h-4" />
                                <span>Create Workspace Account</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
