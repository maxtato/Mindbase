"use client";

import type { Workspace as WorkspaceType } from "../../../../lib/workspace";
import { FormActionButton } from "../../../../components/ui/form-action-button";

export function SubmitButton({ workspace }: { workspace: WorkspaceType }) {
  return (
    <FormActionButton
      idleLabel="Créer le projet"
      pendingLabel="Création..."
      tone="workspace"
      workspace={workspace}
    />
  );
}
