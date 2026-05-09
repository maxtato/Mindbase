"use client";

import { useFormStatus } from "react-dom";
import type { Workspace as WorkspaceType } from "@/lib/workspace";
import {
  cx,
  getButtonToneClass,
  getButtonToneStyle,
  mergeStyles,
  type ButtonTone,
} from "./theme";

type FormActionButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  tone?: ButtonTone;
  workspace?: WorkspaceType;
  className?: string;
};

export function FormActionButton({
  idleLabel,
  pendingLabel,
  tone = "workspace",
  workspace = "personal",
  className,
}: FormActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cx(
        "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50",
        getButtonToneClass(tone, workspace),
        className
      )}
      style={mergeStyles(getButtonToneStyle(tone, workspace))}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
