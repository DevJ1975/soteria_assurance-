'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Surface container per the design-system card recipe: 12px radius
 * (rounded-lg token), 1px soft border (#E6EBF2) and the
 * `0 2px 8px rgba(10,38,71,.06)` elevation.
 */
export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border-soft bg-surface shadow-card-soft',
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
    <div className={cn('border-b border-border-soft px-lg py-md', className)} {...rest}>
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
