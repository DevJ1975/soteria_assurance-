/**
 * Tiny, dependency-free `classNames` helper. Joins the truthy class fragments
 * with a single space so components can compose Tailwind utility strings
 * conditionally, e.g. `cn('p-md', isAlert && 'border-major-nc/30')`.
 *
 * No `tailwind-merge`: conflicting utilities are not de-duplicated, so order
 * classes such that the intended one wins (as the existing components do).
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter((value): value is string | number => Boolean(value)).join(' ');
}
