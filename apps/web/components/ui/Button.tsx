'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary-500 text-white hover:bg-primary-600 disabled:bg-primary-300',
  secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 disabled:opacity-60',
  outline:
    'border border-border bg-surface text-text-primary hover:bg-background disabled:opacity-60',
  ghost: 'bg-transparent text-text-primary hover:bg-background disabled:opacity-60',
  danger: 'bg-major-nc text-white hover:opacity-90 disabled:opacity-60',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-sm text-sm rounded-md',
  md: 'h-10 px-md text-md rounded-md',
  lg: 'h-12 px-lg text-lg rounded-lg',
};

/** Token-styled button primitive (RULE 5 — utilities derived from tokens). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-sm font-medium font-body transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
