"use client";

import { useActionState, useTransition } from "react";

import { toast } from "@/components/app/toaster";
import type { AuthActionState } from "@/lib/validation/auth";
import { changePasswordAction, deleteAccountAction } from "@/lib/auth-actions";

const initialState: AuthActionState = {};

export function AccountSecurityPanel({ username }: { username: string }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete(formData: FormData) {
    startDeleteTransition(async () => {
      const result = await deleteAccountAction(formData);

      if (!result.ok) {
        toast(result.message, "danger");
        return;
      }

    });
  }

  return (
    <div className="space-y-6">
      <section className="panel animate-fade-in-up animate-delay-300 space-y-4">
        <div>
          <p className="eyebrow tracking-widest text-[10px] text-muted">Security</p>
          <h2 className="mt-1 font-display text-2xl text-foreground">Password</h2>
        </div>

        <form action={formAction} className="space-y-4">
          <label className="field">
            <span>Current password</span>
            <input
              autoComplete="current-password"
              className="input"
              name="currentPassword"
              type="password"
            />
          </label>

          <label className="field">
            <span>New password</span>
            <input
              autoComplete="new-password"
              className="input"
              name="newPassword"
              placeholder="At least 8 characters, with a letter and a number"
              type="password"
            />
            {state.fieldErrors?.password ? <small>{state.fieldErrors.password[0]}</small> : null}
          </label>

          {state.error ? <p className="text-sm text-accent">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-foreground">{state.success}</p> : null}

          <div>
            <button className="button button-primary" disabled={pending} type="submit">
              {pending ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel animate-fade-in-up animate-delay-300 space-y-4">
        <div>
          <p className="eyebrow tracking-widest text-[10px] text-muted">Danger zone</p>
          <h2 className="mt-1 font-display text-2xl text-foreground">Delete account</h2>
        </div>

        <details>
          <summary className="cursor-pointer text-xs uppercase tracking-widest text-muted">
            Delete my account
          </summary>
          <form action={handleDelete} className="mt-2 space-y-2">
            <p className="text-xs text-muted">
              This permanently deletes @{username}, lists, favorites, follows, messages, and
              activity. Conversations and messages are also deleted for the other participants. This cannot be undone.
            </p>
            <label className="field">
              <span>Type {username} to confirm</span>
              <input className="input" name="username" required autoComplete="off" />
            </label>
            <label className="field">
              <span>Current password</span>
              <input className="input" name="currentPassword" type="password" maxLength={128} autoComplete="current-password" />
              <small>If you only use Google, leave this empty and sign in again before deleting.</small>
            </label>
            <button
              className="button button-ghost"
              disabled={isDeleting}
              type="submit"
            >
              {isDeleting ? "Deleting..." : "Delete everything"}
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
