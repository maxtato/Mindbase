"use client";

import type { Workspace as WorkspaceType } from "../../../../lib/workspace";
import { FormActionButton } from "../../../../components/ui/form-action-button";
import { useT } from "../../../../components/i18n/locale-provider";

export function SubmitButton({ workspace }: { workspace: WorkspaceType }) {
  const t = useT();
  return (
    <FormActionButton
      idleLabel={t("newProject.create")}
      pendingLabel={t("newProject.creating")}
      tone="workspace"
      workspace={workspace}
    />
  );
}
