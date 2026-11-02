import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);

    const showToast = useCallback((message, type = 'success', duration = 3500) => {
        setToast({ message, type });
        setTimeout(() => setToast(null), duration);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-bounce duration-300 pointer-events-none">
                    <div
                        className={`px-5 py-3 rounded-full shadow-lg border backdrop-blur-md flex items-center gap-2.5 text-xs font-semibold ${
                            toast.type === 'error'
                                ? 'bg-rose-950/90 text-rose-100 border-rose-800'
                                : toast.type === 'info'
                                ? 'bg-zinc-900/90 text-zinc-100 border-zinc-700'
                                : 'bg-zinc-950/90 text-zinc-100 border-zinc-700'
                        }`}
                    >
                        {toast.type === 'error' ? (
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : toast.type === 'info' ? (
                            <Info className="w-4 h-4 text-sky-400 shrink-0" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        <span>{toast.message}</span>
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

