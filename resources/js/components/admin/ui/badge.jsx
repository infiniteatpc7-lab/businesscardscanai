import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

const badgeVariants = cva(
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors select-none tracking-tight',
    {
        variants: {
            variant: {
                default:
                    'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900',
                secondary:
                    'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700/60',
                outline:
                    'border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 bg-transparent',
                destructive:
                    'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60',
                success:
                    'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/60',
                warning:
                    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/60',
                info:
                    'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200/80 dark:border-sky-900/60',
                orange:
                    'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200/80 dark:border-orange-900/60',
                'orange-solid':
                    'bg-orange-500 text-white shadow-xs',
            },
            size: {
                default: 'px-2.5 py-0.5 text-[11px]',
                sm: 'px-2 py-0.25 text-[10px]',
                lg: 'px-3 py-1 text-xs',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

function Badge({ className, variant, size, ...props }) {
    return (
        <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
    );
}

export { Badge, badgeVariants };

