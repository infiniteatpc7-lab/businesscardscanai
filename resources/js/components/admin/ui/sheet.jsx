import * as React from 'react';
import { createPortal } from 'react-dom';
import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';

const SheetContext = React.createContext({
    open: false,
    onOpenChange: () => {},
});

const Sheet = ({ open, onOpenChange, children }) => {
    React.useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onOpenChange?.(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onOpenChange]);

    return (
        <SheetContext.Provider value={{ open, onOpenChange }}>
            {children}
        </SheetContext.Provider>
    );
};

const sheetVariants = cva(
    'fixed z-50 gap-4 bg-white dark:bg-zinc-900 p-6 shadow-2xl transition ease-in-out border-slate-200/80 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 flex flex-col',
    {
        variants: {
            side: {
                top: 'inset-x-0 top-0 border-b',
                bottom: 'inset-x-0 bottom-0 border-t',
                left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-md',
                right: 'inset-y-0 right-0 h-full w-full sm:max-w-xl border-l',
            },
        },
        defaultVariants: {
            side: 'right',
        },
    }
);

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => {
    const { onOpenChange } = React.useContext(SheetContext);
    return (
        <div
            ref={ref}
            onClick={() => onOpenChange?.(false)}
            className={cn(
                'fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in',
                className
            )}
            {...props}
        />
    );
});
SheetOverlay.displayName = 'SheetOverlay';

const SheetContent = React.forwardRef(({ side = 'right', className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(SheetContext);
    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden">
            <SheetOverlay />
            <div
                ref={ref}
                className={cn(sheetVariants({ side }), className)}
                {...props}
            >
                {children}
                <button
                    type="button"
                    onClick={() => onOpenChange?.(false)}
                    className="absolute right-4 top-4 rounded-sm p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>
            </div>
        </div>,
        document.body
    );
});
SheetContent.displayName = 'SheetContent';

const SheetHeader = ({ className, ...props }) => (
    <div
        className={cn('flex flex-col space-y-1 text-left pb-4 border-b border-slate-100 dark:border-zinc-800', className)}
        {...props}
    />
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter = ({ className, ...props }) => (
    <div
        className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-slate-100 dark:border-zinc-800 mt-auto', className)}
        {...props}
    />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn('text-sm font-bold text-slate-900 dark:text-white', className)}
        {...props}
    />
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn('text-xs text-slate-500 dark:text-zinc-400', className)}
        {...props}
    />
));
SheetDescription.displayName = 'SheetDescription';

export {
    Sheet,
    SheetOverlay,
    SheetContent,
    SheetHeader,
    SheetFooter,
    SheetTitle,
    SheetDescription,
};

