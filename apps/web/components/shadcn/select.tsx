import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A native `<select>` wearing the shadcn field styling.
 *
 * The console needs two short, static dropdowns; a native control keeps the
 * keyboard and mobile behaviour the platform already gets right and avoids
 * pulling in @radix-ui/react-select for it. Swap in the Radix version if a
 * dropdown ever needs search, multi-select, or rich option content.
 */
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full appearance-none rounded-md border border-input bg-surface px-3 py-2 pr-9 text-sm ring-offset-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
        aria-hidden
      />
    </div>
  ),
);
Select.displayName = 'Select';

export { Select };
