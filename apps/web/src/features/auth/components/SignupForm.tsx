'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type SignupInput, type SignupRequest, signupRequestSchema } from '@ruet-chottor/shared';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { FormError } from '@/components/form/FormError';
import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/button';
import { authApi } from '../api';
import { help } from '../help';

export function SignupForm() {
  const router = useRouter();
  const form = useForm<SignupInput, unknown, SignupRequest>({
    resolver: zodResolver(signupRequestSchema),
    mode: 'onTouched',
  });
  const signup = useMutation({
    mutationFn: authApi.signup,
    onSuccess: ({ user }) => router.push(`/login?created=${encodeURIComponent(user.roll)}`),
  });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => signup.mutate(values))}
    >
      <FormField
        id="name"
        label={help.fields.name}
        autoComplete="name"
        error={errors.name?.message}
        {...form.register('name')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="roll"
          label={help.fields.roll}
          tip={help.tips.roll}
          inputMode="numeric"
          autoComplete="username"
          placeholder={help.placeholders.roll}
          error={errors.roll?.message}
          {...form.register('roll')}
        />
        <FormField
          id="registrationNo"
          label={help.fields.registrationNo}
          tip={help.tips.registrationNo}
          inputMode="numeric"
          error={errors.registrationNo?.message}
          {...form.register('registrationNo')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="email"
          type="email"
          label={help.fields.email}
          tip={help.tips.email}
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <FormField
          id="phone"
          type="tel"
          label={help.fields.phone}
          tip={help.tips.phone}
          autoComplete="tel"
          placeholder={help.placeholders.phone}
          error={errors.phone?.message}
          {...form.register('phone')}
        />
      </div>
      <FormField
        id="dateOfBirth"
        type="date"
        label={help.fields.dateOfBirth}
        tip={help.tips.dateOfBirth}
        autoComplete="bday"
        error={errors.dateOfBirth?.message}
        {...form.register('dateOfBirth')}
      />
      <FormField
        id="password"
        type="password"
        label={help.fields.password}
        tip={help.tips.password}
        passwordToggle={help.passwordToggle}
        autoComplete="new-password"
        error={errors.password?.message}
        {...form.register('password')}
      />

      <FormError message={signup.error?.message} />

      <Button type="submit" size="lg" disabled={signup.isPending}>
        {signup.isPending ? help.signup.submitting : help.signup.submit}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {help.signup.haveAccount}{' '}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {help.signup.loginLink}
        </Link>
      </p>
    </form>
  );
}
