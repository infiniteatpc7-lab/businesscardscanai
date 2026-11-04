import * as React from 'react';
import { cn } from '../../../lib/utils';

const TooltipContext = React.createContext({
    visible: false,
    setVisible: () => {},
});

const TooltipProvider = ({ children }) => children;

const Tooltip = ({ children, delayDuration = 200 }) => {
    const [visible, setVisible] = React.useState(false);
    const timeoutRef = React.useRef(null);

    const show = () => {
        timeoutRef.current = setTimeout(() => setVisible(true), delayDuration);
    };

    const hide = () => {
        clearTimeout(timeoutRef.current);
        setVisible(false);
    };

    return (
        <TooltipContext.Provider value={{ visible, show, hide }}>
            <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
                {children}
            </div>
        </TooltipContext.Provider>
    );
};

const TooltipTrigger = React.forwardRef(({ className, asChild = false, children, ...props }, ref) => {
    return (
        <div ref={ref} className={cn('inline-flex', className)} {...props}>
            {children}
        </div>
    );
});
TooltipTrigger.displayName = 'TooltipTrigger';

const TooltipContent = React.forwardRef(({ className, side = 'top', children, ...props }, ref) => {
    const { visible } = React.useContext(TooltipContext);
    if (!visible) return null;

    const sideClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
        left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
        right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
    }[side] || 'bottom-full left-1/2 -translate-x-1/2 mb-1.5';

    return (
        <div
            ref={ref}
            role="tooltip"
            className={cn(
                'absolute z-50 whitespace-nowrap rounded-md bg-slate-900 dark:bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-white dark:text-zinc-900 shadow-md animate-tab-fade pointer-events-none',
                sideClasses,
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
});
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

