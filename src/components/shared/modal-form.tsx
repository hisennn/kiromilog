"use client";

import { ComponentProps } from "react";

type ModalFormProps = ComponentProps<"form"> & {
  action: (formData: FormData) => void | Promise<void>;
};

export function ModalForm({ action, children, ...props }: ModalFormProps) {
  return (
    <form
      action={async (formData) => {
        await action(formData);
        window.location.hash = "";
      }}
      {...props}
    >
      {children}
    </form>
  );
}
