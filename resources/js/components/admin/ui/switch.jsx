import * as React from 'react';
import { cn } from '../../../lib/utils';

const Switch = React.forwardRef(({ className, checked = false, onCheckedChange, disabled = false, ...props }, ref) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            ref={ref}
            onClick={() => onCheckedChange && onCheckedChange(!checked)}
            className={cn(
                'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50',
                checked ? 'bg-orange-500' : 'bg-slate-200 dark:bg-zinc-800',
                className
            )}
            {...props}
        >
            <span
                className={cn(
                    'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-xs ring-0 transition-transform',
                    checked ? 'translate-x-4' : 'translate-x-0'
                )}
            />
        </button>
    );
});
Switch.displayName = 'Switch';

export { Switch };

