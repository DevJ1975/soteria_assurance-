'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Surface container styled from tokens (surface bg, border, card shadow). */
export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface shadow-card',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: CardProps) {
  return (
    <div className={cn('border-b border-border px-lg py-md', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('font-display text-lg font-semibold text-text-primary', className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardBody({ className, children, ...rest }: CardProps) {
  return (
    <div className={cn('px-lg py-md', className)} {...rest}>
      {children}
    </div>
  );
}
