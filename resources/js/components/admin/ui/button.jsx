import * as React from 'react';
import { cva } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../../lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
    {
        variants: {
            variant: {
                default:
                    'bg-orange-500 text-white shadow-xs hover:bg-orange-600 active:bg-orange-700',
                destructive:
                    'bg-rose-500 text-white shadow-xs hover:bg-rose-600 active:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700',
                outline:
                    'border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs hover:bg-slate-100 dark:hover:bg-zinc-800',
                secondary:
                    'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-700',
                ghost:
                    'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white',
                link:
                    'text-orange-500 underline-offset-4 hover:underline',
                success:
                    'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800',
            },
            size: {
                default: 'h-8.5 px-3.5 py-1.5',
                xs: 'h-7 px-2.5 text-[11px] rounded-md',
                sm: 'h-8 px-3 text-xs',
                lg: 'h-10 px-5 text-sm rounded-lg',
                icon: 'h-8 w-8 p-0',
                'icon-sm': 'h-7 w-7 p-0 rounded-md',
                'icon-xs': 'h-6 w-6 p-0 rounded-md',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
        <Comp
            className={cn(buttonVariants({ variant, size, className }))}
            ref={ref}
            {...props}
        />
    );
});
Button.displayName = 'Button';

const IconButton = React.forwardRef(({ className, variant = 'ghost', size = 'icon', children, ...props }, ref) => {
    return (
        <Button
            ref={ref}
            variant={variant}
            size={size}
            className={cn('shrink-0', className)}
            {...props}
        >
            {children}
        </Button>
    );
});
IconButton.displayName = 'IconButton';

export { Button, IconButton, buttonVariants };

