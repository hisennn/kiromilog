"use client";

import type { ReactNode } from "react";

import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";

import { authClient } from "@/lib/auth/client";

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <NeonAuthUIProvider authClient={authClient} redirectTo="/home">
      {children}
    </NeonAuthUIProvider>
  );
}
