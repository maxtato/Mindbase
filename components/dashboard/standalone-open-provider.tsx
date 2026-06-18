"use client";

// Permet d'ouvrir une tâche libre (hors projet) directement depuis le dashboard
// — par ex. via un popover KPI — sans renvoyer vers l'onglet Tâches. Le drawer
// vit au niveau du provider (un seul) ; les éléments cliquables appellent
// `useOpenStandalone()(taskId)`.

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Task } from "@/lib/mock-data";
import type { StandaloneTask } from "@/lib/standalone-tasks-store";
import type { Workspace } from "@/lib/workspace";
import { StandaloneTaskDrawer } from "@/components/tasks/standalone-task-drawer";

const OpenStandaloneContext = createContext<(taskId: string) => void>(() => {});

export function useOpenStandalone() {
  return useContext(OpenStandaloneContext);
}

export function StandaloneOpenProvider({
  tasks,
  people,
  workspace,
  children,
}: {
  tasks: StandaloneTask[];
  people: Array<{ id: string; name: string }>;
  workspace: Workspace;
  children: ReactNode;
}) {
  const [openTask, setOpenTask] = useState<Task | null>(null);

  function openById(taskId: string) {
    const found = tasks.find((task) => task.id === taskId);
    if (found) setOpenTask(found);
  }

  return (
    <OpenStandaloneContext.Provider value={openById}>
      {children}
      {openTask && (
        <StandaloneTaskDrawer
          key={openTask.id}
          task={openTask}
          workspace={workspace}
          people={people}
          onClose={() => setOpenTask(null)}
          onDeleted={() => setOpenTask(null)}
        />
      )}
    </OpenStandaloneContext.Provider>
  );
}
