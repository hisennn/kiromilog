"use client";

import { ComponentProps, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

function ModalFormInner({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    // If it finishes without unmounting
    if (wasPending.current && !pending) {
      window.history.pushState(null, "", window.location.pathname + window.location.search);
    }
    wasPending.current = pending;
  }, [pending]);

  useEffect(() => {
    return () => {
      // If the component unmounts while pending, it means the Server Action succeeded
      // and revalidated the page causing this item to disappear/move.
      if (wasPending.current) {
        window.history.pushState(null, "", window.location.pathname + window.location.search);
      }
    };
  }, []);

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
