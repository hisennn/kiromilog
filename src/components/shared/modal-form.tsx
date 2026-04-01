"use client";

import { ComponentProps, useTransition } from "react";

type ModalFormProps = ComponentProps<"form"> & {
  action: (formData: FormData) => void | Promise<void>;
};

export function ModalForm({ action, children, ...props }: ModalFormProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      {...props}
      action={(formData) => {
        startTransition(async () => {
          await action(formData);
          window.location.hash = "";
        });
      }}
    >
      <fieldset disabled={isPending} style={{ display: "contents" }}>
        {children}
      </fieldset>
    </form>
  );
}
