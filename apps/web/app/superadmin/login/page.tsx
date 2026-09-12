'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Enter your password.'),
});

export default function SuperadminLoginPage() {
  const { signInEmail, user, claims, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!loading && user !== null && claims?.role === 'super_admin') router.replace('/superadmin');
  }, [claims, loading, router, user]);

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);
    try {
      await signInEmail(values.email, values.password);
      router.replace('/superadmin');
    } catch {
      setError('Invalid administrator credentials.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-md">
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col gap-md">
          <div className="flex items-center gap-sm text-primary-800">
            <ShieldCheck className="h-8 w-8 text-gold-500" aria-hidden />
            <div>
              <h1 className="font-display text-xl font-bold">Superadmin Console</h1>
              <p className="text-sm text-text-secondary">Soteria Assurance administration</p>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-md">
            <Input id="superadmin-email" label="Administrator email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            <Input id="superadmin-password" type="password" label="Password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
            {error ? <p className="text-sm text-major-nc">{error}</p> : null}
            <Button type="submit" loading={isSubmitting}>Sign in to console</Button>
          </form>
          <Link href="/login" className="text-center text-sm text-primary-500 hover:underline">
            Return to auditor sign in
          </Link>
        </CardBody>
      </Card>
    </main>
  );
}
