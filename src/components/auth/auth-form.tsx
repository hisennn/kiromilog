"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AuthActionState } from "@/lib/validation/auth";

type AuthFormProps = {
  action: (
    state: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  mode: "sign-in" | "sign-up";
};

const initialState: AuthActionState = {};

export function AuthForm({ action, mode }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignUp = mode === "sign-up";

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <p className="eyebrow">{isSignUp ? "New account" : "Access"}</p>
        <h1 className="font-display text-4xl text-foreground">
          {isSignUp ? "Build your list at your own pace." : "Sign in to see your feed."}
        </h1>
        <p className="max-w-md text-base text-muted">
          {isSignUp
            ? "Create an account to save lists, favorites, and activity on Kiromilog. Before signing in, you confirm your email."
            : "Use email and password to sign in. Your profile is updated on first access."}
        </p>
      </div>

      {isSignUp ? (
        <label className="field">
          <span>Nickname</span>
          <input
            autoComplete="nickname"
            autoCapitalize="none"
            autoCorrect="off"
            className="input"
            maxLength={30}
            name="nickname"
            pattern="[A-Za-z0-9_.-]{3,30}"
            placeholder="letters, numbers, . - _"
            type="text"
          />
          {state.fieldErrors?.nickname ? (
            <small>{state.fieldErrors.nickname[0]}</small>
          ) : null}
        </label>
      ) : null}

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

      <label className="field">
        <span>Password</span>
        <input
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className="input"
          name="password"
          placeholder="At least 8 characters"
          type="password"
        />
        {state.fieldErrors?.password ? (
          <small>{state.fieldErrors.password[0]}</small>
        ) : null}
      </label>

      {state.error ? <p className="text-sm text-accent">{state.error}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button className="button button-primary sm:min-w-40" disabled={pending} type="submit">
          {pending
            ? isSignUp
              ? "Creating..."
              : "Signing in..."
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>
        <Link className="button button-ghost sm:min-w-40" href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}>
          {isSignUp ? "I already have an account" : "Create account"}
        </Link>
      </div>
    </form>
  );
}
