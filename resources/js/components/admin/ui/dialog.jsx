import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';

const DialogContext = React.createContext({
    open: false,
    onOpenChange: () => {},
});

const Dialog = ({ open, onOpenChange, children }) => {
    React.useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onOpenChange?.(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onOpenChange]);

    return (
        <DialogContext.Provider value={{ open, onOpenChange }}>
            {children}
        </DialogContext.Provider>
    );
};

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => {
    const { onOpenChange } = React.useContext(DialogContext);
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
DialogOverlay.displayName = 'DialogOverlay';

const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(DialogContext);
    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <DialogOverlay />
            <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                className={cn(
                    'relative z-50 w-full max-w-lg rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl animate-tab-fade text-slate-900 dark:text-zinc-100',
                    className
                )}
                {...props}
            >
                {children}
                <button
                    type="button"
                    onClick={() => onOpenChange?.(false)}
                    className="absolute right-4 top-4 rounded-sm p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>
            </div>
        </div>,
        document.body
    );
});
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({ className, ...props }) => (
    <div
        className={cn('flex flex-col space-y-1.5 text-left mb-4', className)}
        {...props}
    />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }) => (
    <div
        className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-5 pt-3 border-t border-slate-100 dark:border-zinc-800', className)}
        {...props}
    />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
    <h2
        ref={ref}
        className={cn('text-sm font-bold text-slate-900 dark:text-white tracking-tight', className)}
        {...props}
    />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn('text-xs text-slate-500 dark:text-zinc-400', className)}
        {...props}
    />
));
DialogDescription.displayName = 'DialogDescription';

const DialogClose = ({ className, children, ...props }) => {
    const { onOpenChange } = React.useContext(DialogContext);
    return (
        <button
            type="button"
            onClick={() => onOpenChange?.(false)}
            className={className}
            {...props}
        >
            {children}
        </button>
    );
};
DialogClose.displayName = 'DialogClose';

export {
    Dialog,
    DialogOverlay,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
    DialogClose,
};

