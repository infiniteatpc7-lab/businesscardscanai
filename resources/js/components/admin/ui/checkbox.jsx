import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../../lib/utils';

const Checkbox = React.forwardRef(({ className, checked = false, onCheckedChange, disabled = false, ...props }, ref) => {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            disabled={disabled}
            ref={ref}
            onClick={() => onCheckedChange && onCheckedChange(!checked)}
            className={cn(
                'peer h-4 w-4 shrink-0 rounded-sm border transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center cursor-pointer',
                checked
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-slate-400 dark:hover:border-zinc-600',
                className
            )}
            {...props}
        >
            {checked && <Check className="h-3 w-3 stroke-[3]" />}
        </button>
    );
});
Checkbox.displayName = 'Checkbox';

export { Checkbox };

