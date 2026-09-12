"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AuthActionState } from "@/lib/validation/auth";
import { resetPasswordAction } from "@/lib/auth-actions";

const initialState: AuthActionState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <p className="eyebrow">Recovery</p>
        <h1 className="font-display text-4xl text-foreground">Choose a new password.</h1>
        <p className="max-w-md text-base text-muted">
          At least 8 characters, with a letter and a number.
        </p>
      </div>

      <input name="token" type="hidden" value={token} />

      <label className="field">
        <span>New password</span>
        <input
          autoComplete="new-password"
          className="input"
          name="newPassword"
          placeholder="At least 8 characters"
          type="password"
        />
        {state.fieldErrors?.password ? <small>{state.fieldErrors.password[0]}</small> : null}
      </label>

      {state.error ? <p className="text-sm text-accent">{state.error}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button className="button button-primary sm:min-w-40" disabled={pending} type="submit">
          {pending ? "Updating..." : "Update password"}
        </button>
        <Link className="button button-ghost sm:min-w-40" href="/auth/sign-in">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
