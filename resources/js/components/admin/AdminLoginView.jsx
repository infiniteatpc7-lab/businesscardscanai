import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, AlertCircle, Sun, MoonStar } from 'lucide-react';
import AdminCnLogo from './AdminCnLogo';
import { loginAdmin } from '../../services/platformAdminApi';

export default function AdminLoginView({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isDark, setIsDark] = useState(() => {
        return localStorage.getItem('admin_theme') === 'dark' || document.documentElement.classList.contains('dark');
    });

    const toggleTheme = () => {
        const nextDark = !isDark;
        setIsDark(nextDark);
        if (nextDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('admin_theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('admin_theme', 'light');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        if (!email.trim() || !password) {
            setErrorMessage('Please enter both email and password.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await loginAdmin(email.trim(), password);
            if (res.success && res.admin) {
                onLoginSuccess(res.admin);
            } else {
                setErrorMessage(res.message || 'Invalid administrator credentials.');
            }
        } catch (err) {
            console.error('Admin login error:', err);
            setErrorMessage('Unable to connect to administration server.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col justify-center items-center p-4 sm:p-6 select-none transition-colors relative`}>
            {/* Top Right Theme Toggle */}
            <div className="absolute top-4 right-4">
                <button
                    type="button"
                    onClick={toggleTheme}
                    className="size-9 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                    {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <MoonStar className="w-4 h-4 text-slate-700" />}
                </button>
            </div>

            <div className="w-full max-w-sm space-y-6">
                {/* Brand & Title matching admincn */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                        <AdminCnLogo className="size-10 text-slate-900 dark:text-white" />
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            AdminCN
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Platform Administration & Workspace Security
                    </p>
                </div>

                {/* Form Card matching admincn login card */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-6 shadow-xs space-y-5">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Sign in to AdminCN</h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Enter your administrator credentials below</p>
                    </div>

                    {errorMessage && (
                        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 text-rose-800 dark:text-rose-400 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                            <span className="flex-1 font-medium">{errorMessage}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@businesscardscan.ai"
                                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-9 pr-10 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="p-1 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Verifying Credentials...</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign in to Dashboard</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-[11px] text-slate-400 dark:text-zinc-500">
                    AdminCN &copy; {new Date().getFullYear()} • Powered by BusinessCardScanAI
                </p>
            </div>
        </div>
    );
}
