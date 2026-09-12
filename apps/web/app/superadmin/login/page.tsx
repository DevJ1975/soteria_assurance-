'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@/components/shadcn';
import { useAuth } from '@/lib/auth-context';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Enter your password.'),
});

type FormValues = z.infer<typeof schema>;

export default function SuperadminLoginPage() {
  const { signInEmail, user, claims, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!loading && user !== null && claims?.role === 'super_admin') router.replace('/superadmin');
  }, [claims, loading, router, user]);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await signInEmail(values.email, values.password);
      router.replace('/superadmin');
    } catch {
      setError('Invalid administrator credentials.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="border-white/10 shadow-overlay">
          <CardHeader className="space-y-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary-800">
              <ShieldCheck className="size-6 text-gold-400" aria-hidden />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-2xl text-primary-800">Superadmin Console</CardTitle>
              <CardDescription>Soteria Assurance platform administration</CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="superadmin-email">Administrator email</Label>
                <Input
                  id="superadmin-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@example.com"
                  aria-invalid={errors.email !== undefined}
                  {...register('email')}
                />
                {errors.email ? (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="superadmin-password">Password</Label>
                <Input
                  id="superadmin-password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors.password !== undefined}
                  {...register('password')}
                />
                {errors.password ? (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                ) : null}
              </div>

              {error !== null ? (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {isSubmitting ? 'Signing in…' : 'Sign in to console'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-white/70">
          <Link href="/login" className="font-medium text-white hover:underline">
            Return to auditor sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
