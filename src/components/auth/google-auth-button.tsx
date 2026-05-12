"use client";

import { useState, useTransition } from "react";

import { authClient } from "@/lib/auth/client";

type GoogleAuthButtonProps = {
  label: string;
};

export function GoogleAuthButton({ label }: GoogleAuthButtonProps) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError("");
    startTransition(async () => {
      const response = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/home",
      });

      if (response.error) {
        setError("Google login is unavailable right now.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        className="button button-ghost w-full"
        disabled={pending}
        onClick={handleClick}
        type="button"
      >
        {pending ? "Abrindo Google..." : label}
      </button>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}
