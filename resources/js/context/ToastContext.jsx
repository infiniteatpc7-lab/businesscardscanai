import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, RotateCcw } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);
    const timerRef = useRef(null);

    const showToast = useCallback((message, type = 'success', duration = 3500, action = null) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setToast({ message, type, action });
        timerRef.current = setTimeout(() => setToast(null), duration);
    }, []);

    const hideToast = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setToast(null);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}
            {toast && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-bounce duration-300 w-[92%] max-w-md flex justify-center pointer-events-none">
                    <div
                        className={`pointer-events-auto w-full px-5 py-3 rounded-full shadow-2xl border backdrop-blur-md flex items-center justify-center gap-3 text-xs font-semibold ${
                            toast.type === 'error'
                                ? 'bg-rose-950/95 text-rose-100 border-rose-800'
                                : toast.type === 'info'
                                ? 'bg-zinc-900/95 text-zinc-100 border-zinc-700'
                                : 'bg-zinc-950/95 text-zinc-100 border-zinc-800'
                        }`}
                    >
                        {toast.type === 'error' ? (
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : toast.type === 'info' ? (
                            <Info className="w-4 h-4 text-sky-400 shrink-0" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        <span className="whitespace-nowrap truncate">{toast.message}</span>

                        {toast.action && (
                            <button
                                onClick={() => {
                                    toast.action.onClick();
                                    hideToast();
                                }}
                                className="ml-1 pl-2.5 border-l border-zinc-700 text-amber-400 hover:text-amber-300 font-extrabold uppercase tracking-wider text-[11px] flex items-center gap-1 active:scale-95 transition-all shrink-0 whitespace-nowrap"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span>{toast.action.label || 'UNDO'}</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
