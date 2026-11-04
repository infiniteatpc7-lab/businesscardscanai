import * as React from 'react';
import { cn } from '../../../lib/utils';

const Separator = React.forwardRef(
    ({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
        <div
            ref={ref}
            role={decorative ? 'none' : 'separator'}
            aria-orientation={orientation}
            className={cn(
                'shrink-0 bg-slate-200/80 dark:bg-zinc-800',
                orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
                className
            )}
            {...props}
        />
    )
);
Separator.displayName = 'Separator';

export { Separator };

