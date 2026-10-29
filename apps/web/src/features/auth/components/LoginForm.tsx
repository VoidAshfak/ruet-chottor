'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginRequest, loginRequestSchema, type OtpChallenge } from '@ruet-chottor/shared';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormError } from '@/components/form/FormError';
import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/button';
import { authApi } from '../api';
import { help } from '../help';
import { OtpStep } from './OtpStep';

/** Two steps: roll + password, then the emailed code. Wrap in <Suspense> (reads the URL). */
export function LoginForm() {
  const created = useSearchParams().get('created');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { roll: created ?? '', password: '' },
  });
  const login = useMutation({ mutationFn: authApi.login, onSuccess: setChallenge });
  const { errors } = form.formState;

  if (challenge) {
    return (
      <OtpStep
        challenge={challenge}
        onRestart={() => {
          setChallenge(null);
          login.reset();
          form.resetField('password');
        }}
      />
    );
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => login.mutate(values))}
    >
      {created ? (
        <p role="status" className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
          {help.signup.success}
        </p>
      ) : null}
      <FormField
        id="roll"
        label={help.fields.roll}
        inputMode="numeric"
        autoComplete="username"
        placeholder={help.placeholders.roll}
        error={errors.roll?.message}
        {...form.register('roll')}
      />
      <FormField
        id="password"
        type="password"
        label={help.fields.password}
        passwordToggle={help.passwordToggle}
        autoComplete="current-password"
        error={errors.password?.message}
        {...form.register('password')}
      />

      <FormError message={login.error?.message} />

      <Button type="submit" size="lg" disabled={login.isPending}>
        {login.isPending ? help.login.submitting : help.login.submit}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {help.login.noAccount}{' '}
        <Link
          href="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {help.login.signupLink}
        </Link>
      </p>
    </form>
  );
}
