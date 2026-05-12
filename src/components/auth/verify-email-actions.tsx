"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import {
  resendVerificationEmailAction,
  signOutAction,
  verifyEmailCodeAction,
} from "@/lib/auth-actions";
import type { AuthActionState } from "@/lib/validation/auth";

const initialState: AuthActionState = {};

type VerifyEmailActionsProps = {
  email: string;
  initialCooldownSeconds: number;
};

export function VerifyEmailActions({
  email,
  initialCooldownSeconds,
}: VerifyEmailActionsProps) {
  const [verifyState, verifyFormAction, verifyPending] = useActionState(
    verifyEmailCodeAction,
    initialState,
  );
  const [resendState, setResendState] = useState<AuthActionState>(initialState);
  const [cooldownSeconds, setCooldownSeconds] = useState(initialCooldownSeconds);
  const [resendPending, startResendTransition] = useTransition();

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

      return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  function handleResend() {
    startResendTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      const nextState = await resendVerificationEmailAction(initialState, formData);
      setResendState(nextState);

      if (nextState.cooldownSeconds !== undefined) {
        setCooldownSeconds(nextState.cooldownSeconds);
      }
    });
  }

  return (
    <div className="panel space-y-6">
      <div className="space-y-3">
        <p className="eyebrow">Verification</p>
        <h1 className="font-display text-4xl text-foreground">
          Check your email
        </h1>
        <p className="max-w-xl text-sm leading-7 text-muted">
          We sent a code to <strong>{email}</strong>. Enter it below to confirm your account.
        </p>
      </div>

      <form action={verifyFormAction} className="space-y-4">
        <input name="email" type="hidden" value={email} />
        <label className="field">
          <span>Verification code</span>
          <input
            autoComplete="one-time-code"
            className="input"
            inputMode="numeric"
            maxLength={8}
            name="otp"
            pattern="[0-9]*"
            placeholder="Enter the code"
            type="text"
          />
        </label>

        {verifyState.error ? <p className="text-sm text-accent">{verifyState.error}</p> : null}

        <button className="button button-primary w-full" disabled={verifyPending} type="submit">
          {verifyPending ? "Verifying..." : "Confirm email"}
        </button>
      </form>

      <div className="space-y-3 border-t border-border pt-4">
        {resendState.error ? <p className="text-sm text-accent">{resendState.error}</p> : null}
        {resendState.success ? <p className="text-sm text-primary">{resendState.success}</p> : null}

        <p className="text-sm text-muted">
          Did not receive the code? Check spam and promotions.
        </p>

        <div className="flex items-center gap-3">
          <button
            className="button button-ghost text-sm"
            disabled={resendPending || cooldownSeconds > 0}
            onClick={handleResend}
            type="button"
          >
            {resendPending
              ? "Sending..."
              : cooldownSeconds > 0
                ? `Resend in ${cooldownSeconds}s`
                : "Resend code"}
          </button>
          <span className="text-border">|</span>
          <form action={signOutAction}>
            <button className="button button-ghost text-sm" type="submit">
              Use another account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
