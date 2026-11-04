import * as React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

const Toast = React.forwardRef(({ className, variant = 'default', title, description, onClose, ...props }, ref) => {
    const icons = {
        default: null,
        success: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />,
        error: <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />,
        warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
        info: <Info className="h-4 w-4 text-sky-500 shrink-0" />,
    };

    const variantStyles = {
        default: 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100',
        success: 'border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200',
        error: 'border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200',
        warning: 'border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200',
        info: 'border-sky-200/80 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-200',
    }[variant] || variantStyles.default;

    return (
        <div
            ref={ref}
            role="status"
            className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3.5 shadow-lg transition-all animate-tab-fade',
                variantStyles,
                className
            )}
            {...props}
        >
            {icons[variant]}
            <div className="flex-1 min-w-0">
                {title && <h5 className="text-xs font-semibold leading-none tracking-tight">{title}</h5>}
                {description && <p className={cn('text-xs leading-relaxed opacity-90', title && 'mt-1')}>{description}</p>}
            </div>
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 rounded-sm p-0.5 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                >
                    <X className="h-3.5 w-3.5" />
                    <span className="sr-only">Close</span>
                </button>
            )}
        </div>
    );
});
Toast.displayName = 'Toast';

export { Toast };

