'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type OtpChallenge, otpCodeSchema } from '@ruet-chottor/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormError } from '@/components/form/FormError';
import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/button';
import { authApi } from '../api';
import { help } from '../help';
import { SESSION_QUERY_KEY } from '../hooks/use-session';

const codeFormSchema = z.object({ code: otpCodeSchema });
type CodeForm = z.infer<typeof codeFormSchema>;

type OtpStepProps = {
  challenge: OtpChallenge;
  /** Back to roll + password, e.g. when the code expired. */
  onRestart: () => void;
};

export function OtpStep({ challenge, onRestart }: OtpStepProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [resendIn, setResendIn] = useState(challenge.resendInSeconds);
  const form = useForm<CodeForm>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const verify = useMutation({
    mutationFn: ({ code }: CodeForm) => authApi.verifyOtp(challenge.challengeId, code),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
      router.push('/');
    },
  });
  const resend = useMutation({
    mutationFn: () => authApi.resendOtp(challenge.challengeId),
    onSuccess: (next) => {
      setResendIn(next.resendInSeconds);
      form.reset({ code: '' });
      verify.reset();
    },
  });

  const expired = verify.error && 'code' in verify.error && verify.error.code === 'OTP_EXPIRED';

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => verify.mutate(values))}
    >
      <div>
        <h2 className="text-lg font-medium">{help.otp.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {help.otp.sentTo(challenge.destination)} {help.otp.expiry}
        </p>
      </div>
      <FormField
        id="code"
        label={help.fields.code}
        tip={help.tips.code}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        className="h-12 text-center text-2xl tracking-[0.5em]"
        error={form.formState.errors.code?.message}
        {...form.register('code')}
      />

      <FormError message={verify.error?.message ?? resend.error?.message} />
      {resend.isSuccess && !verify.error ? (
        <p role="status" className="text-sm text-muted-foreground">
          {help.otp.resent}
        </p>
      ) : null}

      {expired ? (
        <Button type="button" size="lg" onClick={onRestart}>
          {help.login.title}
        </Button>
      ) : (
        <Button type="submit" size="lg" disabled={verify.isPending}>
          {verify.isPending ? help.otp.submitting : help.otp.submit}
        </Button>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={resendIn > 0 || resend.isPending}
          onClick={() => resend.mutate()}
        >
          {resendIn > 0 ? help.otp.resendIn(resendIn) : help.otp.resend}
        </Button>
        <Button type="button" variant="ghost" onClick={onRestart}>
          {help.otp.otherAccount}
        </Button>
      </div>
    </form>
  );
}
