/**
 * shadcn/ui primitives, scoped to the superadmin console.
 *
 * Deliberately separate from `components/ui/`, which holds the hand-rolled
 * components the rest of the app uses. Two reasons: the migration is scoped
 * rather than wholesale, and this repo sits on a case-insensitive filesystem
 * where `button.tsx` and `Button.tsx` are the same path.
 *
 * Colour comes from the same Soteria tokens as everything else — the shadcn
 * semantic names (bg-card, text-muted-foreground, ring-ring) are aliased onto
 * the token values in `tailwind.config.ts`, so RULE 5 still holds.
 */
export { Button, buttonVariants, type ButtonProps } from './button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card';
export { Input } from './input';
export { Label } from './label';
export { Badge, badgeVariants, type BadgeProps } from './badge';
export { Alert, AlertTitle, AlertDescription } from './alert';
export { Separator } from './separator';
export { Skeleton } from './skeleton';
export {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table';
export { Select } from './select';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
