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

const registerSchema = z
  .object({
    displayName: z.string().min(2, SoteriaStrings.errors.validation),
    email: z.string().email(SoteriaStrings.errors.validation),
    password: z.string().min(8, SoteriaStrings.errors.validation),
    confirmPassword: z.string().min(8, SoteriaStrings.errors.validation),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: SoteriaStrings.errors.validation,
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { registerEmail } = useAuth();
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const goDashboard = () => router.replace('/dashboard');

  async function onSubmit(values: RegisterForm) {
    setAuthError(null);
    try {
      await registerEmail(values.email, values.password, values.displayName);
      goDashboard();
    } catch {
      setAuthError(SoteriaStrings.errors.generic);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-md">
        <h2 className="font-display text-xl font-semibold text-text-primary">
          Create your account
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-md">
          <Input
            id="register-name"
            label="Full name"
            autoComplete="name"
            error={errors.displayName?.message}
            {...register('displayName')}
          />
          <Input
            id="register-email"
            type="email"
            label={SoteriaStrings.auth.emailLabel}
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            id="register-password"
            type="password"
            label={SoteriaStrings.auth.passwordLabel}
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            id="register-confirm"
            type="password"
            label="Confirm password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          {authError ? <p className="text-sm text-major-nc">{authError}</p> : null}
          <Button type="submit" loading={isSubmitting}>
            {SoteriaStrings.common.confirm}
          </Button>
        </form>

        <div className="flex items-center gap-md">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-text-muted">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleButton onAuthenticated={goDashboard} />

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary-500 hover:underline">
            {SoteriaStrings.auth.signInButton}
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
