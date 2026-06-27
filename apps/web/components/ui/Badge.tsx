'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone =
  | 'neutral'
  | 'conforming'
  | 'minor-nc'
  | 'major-nc'
  | 'ofi'
  | 'strong-point'
  | 'warning'
  | 'primary';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-background text-text-secondary border border-border',
  conforming: 'bg-conforming/10 text-conforming border border-conforming/30',
  'minor-nc': 'bg-minor-nc/10 text-minor-nc border border-minor-nc/30',
  'major-nc': 'bg-major-nc/10 text-major-nc border border-major-nc/30',
  ofi: 'bg-ofi/10 text-ofi border border-ofi/30',
  'strong-point': 'bg-strong-point/10 text-strong-point border border-strong-point/30',
  warning: 'bg-warning/10 text-warning border border-warning/30',
  primary: 'bg-primary-50 text-primary-700 border border-primary-200',
};

/** Small status pill styled from semantic finding tokens (RULE 5). */
export function Badge({ tone = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-sm py-0.5 text-xs font-medium font-body',
        TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
