import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Class merger for the shadcn primitives in `components/shadcn/`.
 *
 * Distinct from `lib/cn.ts`, which the hand-rolled `components/ui/` components
 * use: that one is dependency-free and does not de-duplicate conflicting
 * utilities. shadcn's cva variants rely on `tailwind-merge` so a caller's
 * `className` can override a variant's own classes, so it needs this one.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
