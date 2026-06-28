'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SoteriaStrings } from '@soteria/core';
import { useAuth } from '@/lib/auth-context';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GoogleButton } from '../GoogleButton';
import { PhoneSignIn } from '../PhoneSignIn';
import { cn } from '@/lib/cn';

const loginSchema = z.object({
  email: z.string().email(SoteriaStrings.errors.validation),
  password: z.string().min(6, SoteriaStrings.errors.validation),
});

type LoginForm = z.infer<typeof loginSchema>;

type Method = 'email' | 'phone';

export default function LoginPage() {
  const { signInEmail } = useAuth();
  const router = useRouter();
  const [method, setMethod] = useState<Method>('email');
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const goDashboard = () => router.replace('/dashboard');

  async function onSubmit(values: LoginForm) {
    setAuthError(null);
    try {
      await signInEmail(values.email, values.password);
      goDashboard();
    } catch {
      setAuthError(SoteriaStrings.auth.invalidCredentials);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-md">
        <h2 className="font-display text-xl font-semibold text-text-primary">
          {SoteriaStrings.auth.signInTitle}
        </h2>

        <div className="flex rounded-md border border-border p-1">
          {(['email', 'phone'] as Method[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cn(
                'flex-1 rounded px-md py-1.5 text-sm font-medium capitalize transition-colors',
                method === m ? 'bg-primary-500 text-white' : 'text-text-secondary',
              )}
            >
              {m === 'email' ? 'Email' : 'Phone'}
            </button>
          ))}
        </div>

        {method === 'email' ? (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-md">
            <Input
              id="login-email"
              type="email"
              label={SoteriaStrings.auth.emailLabel}
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              id="login-password"
              type="password"
              label={SoteriaStrings.auth.passwordLabel}
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            {authError ? <p className="text-sm text-major-nc">{authError}</p> : null}
            <Button type="submit" loading={isSubmitting}>
              {SoteriaStrings.auth.signInButton}
            </Button>
          </form>
        ) : (
          <PhoneSignIn onAuthenticated={goDashboard} />
        )}

        <div className="flex items-center gap-md">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-text-muted">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleButton onAuthenticated={goDashboard} />

        <p className="text-center text-sm text-text-secondary">
          No account?{' '}
          <Link href="/register" className="font-medium text-primary-500 hover:underline">
            {SoteriaStrings.common.next}
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
