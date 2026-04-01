"use client";

import { ComponentProps, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

function ModalFormInner({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      window.location.hash = "";
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <fieldset disabled={pending} style={{ display: "contents" }}>
      {children}
    </fieldset>
  );
}

export function ModalForm({ children, ...props }: ComponentProps<"form">) {
  return (
    <form {...props}>
      <ModalFormInner>{children}</ModalFormInner>
    </form>
  );
}
