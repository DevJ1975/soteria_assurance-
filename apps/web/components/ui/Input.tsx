'use client';

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const FIELD_BASE =
  'w-full rounded-md border border-border-soft bg-surface px-md py-2 text-md text-text-primary ' +
  'placeholder:text-text-muted focus:border-primary-400 focus:outline-none focus:ring-[3px] ' +
  'focus:ring-focus disabled:cursor-not-allowed disabled:opacity-60';

/** Labeled text input with token styling and inline error display. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...rest },
  ref,
) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={id}
        className={cn(FIELD_BASE, error && 'border-major-nc focus:ring-major-nc/40', className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? <span className="text-xs text-major-nc">{error}</span> : null}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

/** Labeled textarea sharing the Input styling. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className, ...rest },
  ref,
) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={id}
        className={cn(FIELD_BASE, 'min-h-24 resize-y', error && 'border-major-nc', className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? <span className="text-xs text-major-nc">{error}</span> : null}
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

/** Labeled select sharing the Input styling. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className, children, ...rest },
  ref,
) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={id}
        className={cn(FIELD_BASE, error && 'border-major-nc', className)}
        {...rest}
      >
        {children}
      </select>
      {error ? <span className="text-xs text-major-nc">{error}</span> : null}
    </div>
  );
});
