import * as React from 'react';
import { cn } from '../../../lib/utils';

const DropdownContext = React.createContext({
    open: false,
    setOpen: () => {},
});

const DropdownMenu = ({ open: controlledOpen, onOpenChange, children }) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const ref = React.useRef(null);

    const setOpen = React.useCallback(
        (next) => {
            if (!isControlled) setUncontrolledOpen(next);
            onOpenChange?.(next);
        },
        [isControlled, onOpenChange]
    );

    React.useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, setOpen]);

    return (
        <DropdownContext.Provider value={{ open, setOpen }}>
            <div ref={ref} className="relative inline-block text-left">
                {children}
            </div>
        </DropdownContext.Provider>
    );
};

const DropdownMenuTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
    const { open, setOpen } = React.useContext(DropdownContext);
    return (
        <button
            ref={ref}
            type="button"
            aria-haspopup="true"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className={className}
            {...props}
        >
            {children}
        </button>
    );
});
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

const DropdownMenuContent = React.forwardRef(({ className, align = 'right', children, ...props }, ref) => {
    const { open } = React.useContext(DropdownContext);
    if (!open) return null;

    const alignmentClass = align === 'left' ? 'left-0' : 'right-0';

    return (
        <div
            ref={ref}
            role="menu"
            className={cn(
                'absolute z-50 mt-1.5 min-w-[160px] overflow-hidden rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 text-slate-900 dark:text-zinc-100 shadow-lg animate-tab-fade',
                alignmentClass,
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
});
DropdownMenuContent.displayName = 'DropdownMenuContent';

const DropdownMenuItem = React.forwardRef(({ className, inset, disabled = false, onClick, children, ...props }, ref) => {
    const { setOpen } = React.useContext(DropdownContext);

    return (
        <button
            ref={ref}
            role="menuitem"
            disabled={disabled}
            onClick={(e) => {
                if (disabled) return;
                onClick?.(e);
                setOpen(false);
            }}
            className={cn(
                'relative flex w-full cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 outline-none transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white disabled:pointer-events-none disabled:opacity-50 text-left',
                inset && 'pl-8',
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
});
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuLabel = ({ className, inset, ...props }) => (
    <div
        className={cn(
            'px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500',
            inset && 'pl-8',
            className
        )}
        {...props}
    />
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

const DropdownMenuSeparator = ({ className, ...props }) => (
    <div
        className={cn('-mx-1 my-1 h-px bg-slate-100 dark:bg-zinc-800', className)}
        {...props}
    />
);
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
};

