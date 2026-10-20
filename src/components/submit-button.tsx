"use client";

import clsx from "clsx";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./ui";

export function SubmitButton({
  children,
  pendingText,
  className,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending || props.disabled} className={clsx("w-full", className)} {...props}>
      {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {pending ? (pendingText ?? "Salvando...") : children}
    </Button>
  );
}
