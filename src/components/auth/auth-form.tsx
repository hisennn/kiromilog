"use client";

import Link from "next/link";
import { useActionState } from "react";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";        
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
        <p className="eyebrow">{isSignUp ? "New Account" : "Access"}</p>
        <h1 className="font-display text-4xl text-foreground">
          {isSignUp ? "Get into the rhythm of your catalog." : "Head back to your feed."}
        </h1>
        <p className="max-w-md text-base text-muted">
          {isSignUp
            ? "Create an account to build your list, favorites, and track activity on Kiromilog. We will ask you to verify your email before entering the app."
            : "Use your email and password to sign in. Your profile is automatically synced on first access."}
        </p>
      </div>

      {isSignUp ? (
        <label className="field">
          <span>Name</span>
          <input
            autoComplete="name"
            className="input"
            name="name"
            placeholder="How you want to be called"
            type="text"
          />
          {state.fieldErrors?.name ? (
            <small>{state.fieldErrors.name[0]}</small>
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
          placeholder="Minimum 8 characters"
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
              ? "Sign Up"
              : "Log In"}
        </button>
        <Link className="button button-ghost sm:min-w-40" href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}>
          {isSignUp ? "I already have an account" : "Create an account"}
        </Link>
      </div>

      <div className="divider">
        <span>or</span>
      </div>

      <GoogleAuthButton
        label={isSignUp ? "Continue with Google" : "Sign in with Google"}
      />
    </form>
  );
}
