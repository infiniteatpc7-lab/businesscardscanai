import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

const Select = React.forwardRef(({ className, children, ...props }, ref) => {
    return (
        <div className="relative inline-block w-full">
            <select
                className={cn(
                    'flex h-9 w-full appearance-none rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1.5 pr-8 text-xs text-slate-900 dark:text-zinc-100 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 focus-visible:border-orange-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
                    className
                )}
                ref={ref}
                {...props}
            >
                {children}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
        </div>
    );
});
Select.displayName = 'Select';

export { Select };

