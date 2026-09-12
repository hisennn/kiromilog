"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AuthActionState } from "@/lib/validation/auth";
import { requestPasswordResetAction } from "@/lib/auth-actions";

const initialState: AuthActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <p className="eyebrow">Recovery</p>
        <h1 className="font-display text-4xl text-foreground">Reset your password.</h1>
        <p className="max-w-md text-base text-muted">
          Enter your account email and we send a reset link.
        </p>
      </div>

      <label className="field">
        <span>Email</span>
        <input
          autoComplete="email"
          className="input"
          name="email"
          placeholder="you@example.com"
          type="email"
        />
        {state.fieldErrors?.email ? <small>{state.fieldErrors.email[0]}</small> : null}
      </label>

      {state.error ? <p className="text-sm text-accent">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-foreground">{state.success}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button className="button button-primary sm:min-w-40" disabled={pending} type="submit">
          {pending ? "Sending..." : "Send reset link"}
        </button>
        <Link className="button button-ghost sm:min-w-40" href="/auth/sign-in">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
