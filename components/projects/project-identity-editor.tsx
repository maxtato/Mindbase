"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { updateProjectIdentityAction } from "@/app/dashboard/projects/actions";
import { ProjectCategoryIcon } from "@/components/projects/project-taxonomy-ui";
import { surface, text } from "@/lib/design-tokens";
import {
  getSubcategoryOptions,
  resolveProjectSubcategoryDisplay,
} from "@/lib/project-taxonomy";
import type { Workspace } from "@/lib/workspace";
import { listEnvironmentOptions } from "@/lib/workspace";
import { useEnvironments } from "@/components/environments/environments-provider";

interface ProjectIdentityEditorProps {
  projectId: string;
  workspace: Workspace;
  subcategory: string;
  subcategoryColor: string;
  isCustomSubcategory?: boolean;
  customSubcategoryLabel?: string | null;
  customSubcategoryColor?: string | null;
  size?: "sm" | "md" | "lg";
  onColor?: boolean;
}

export function ProjectIdentityEditor({
  projectId,
  workspace,
  subcategory,
  subcategoryColor,
  isCustomSubcategory,
  customSubcategoryLabel,
  customSubcategoryColor,
  size = "md",
  onColor = false,
}: ProjectIdentityEditorProps) {
  const display = resolveProjectSubcategoryDisplay({
    workspace,
    subcategory,
    subcategoryColor,
    isCustomSubcategory,
    customSubcategoryLabel,
    customSubcategoryColor,
  });
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState(subcategory);
  // Environnement du projet : modifiable ici pour « lier » le projet à un autre
  // environnement (Perso / Pro / personnalisé). Le jeu de sous-catégories
  // dépend de l'environnement, donc on recalcule les options en conséquence.
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace>(workspace);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const environments = useEnvironments();
  const environmentOptions = listEnvironmentOptions(environments);
  const options = getSubcategoryOptions(selectedWorkspace);

  // Si la sous-catégorie sélectionnée n'existe pas dans le nouvel
  // environnement, on retombe sur la première option valide pour garder un
  // pictogramme cohérent.
  function handleWorkspaceChange(nextWorkspace: Workspace) {
    setSelectedWorkspace(nextWorkspace);
    const nextOptions = getSubcategoryOptions(nextWorkspace);
    if (!nextOptions.some((option) => option.key === selectedSubcategory)) {
      const firstReal = nextOptions.find((option) => option.key !== "other") ?? nextOptions[0];
      if (firstReal) setSelectedSubcategory(firstReal.key);
    }
  }
  const dimension = size === "lg" ? 42 : size === "sm" ? 26 : 34;
  const iconSize = size === "lg" ? 25 : size === "sm" ? 16 : 20;
  const menuWidth = 320;

  function updateMenuPosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const left = Math.min(Math.max(12, rect.left), window.innerWidth - menuWidth - 12);
    setMenuPosition({ top: rect.bottom + 10, left });
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const insideTrigger = ref.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);
      if (!insideTrigger && !insideMenu) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  function handleSave() {
    startTransition(async () => {
      await updateProjectIdentityAction({
        projectId,
        workspace: selectedWorkspace,
        subcategory: selectedSubcategory,
      });
      // Force le re-render des composants serveur de la route courante : sans
      // ça, le pilot header (icone + filet d'accent) et tout consommateur de
      // project.subcategoryColor restent figés sur l'ancien thème.
      router.refresh();
      setIsOpen(false);
    });
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen((current) => {
            const next = !current;
            if (next) requestAnimationFrame(updateMenuPosition);
            return next;
          });
        }}
        className="inline-flex items-center justify-center"
        style={{
          width: dimension,
          height: dimension,
          // Sur fond neutre : plate solide en couleur projet, icône blanche → identité forte.
          // Sur un bandeau déjà coloré (`onColor`) : plate blanche, icône en couleur projet
          // → on garde le même picto mais le contraste reste lisible.
          background: onColor ? "#FFFFFF" : display.color,
          color: onColor ? display.color : "#FFFFFF",
          borderRadius: size === "lg" ? 14 : size === "sm" ? 10 : 12,
          border: onColor ? `1px solid rgba(255,255,255,0.4)` : "none",
          cursor: "pointer",
          // Ombre neutre et discrète (plus de halo coloré qui « bavait »).
          boxShadow: "0 1px 3px rgba(16, 24, 40, 0.12)",
          transition: "background-color 180ms var(--mb-ease), box-shadow 180ms var(--mb-ease), transform 120ms var(--mb-ease)",
        }}
        title="Modifier le type et le pictogramme du projet"
      >
        <ProjectCategoryIcon icon={display.icon} color={onColor ? display.color : "#FFFFFF"} size={iconSize} />
      </button>

      {isOpen && menuPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="rounded-2xl p-4"
          style={{
            position: "fixed",
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuWidth,
            background: surface.s1,
            border: `1px solid ${surface.border}`,
            boxShadow: `0 22px 0 -20px ${surface.borderHover}`,
            zIndex: 1000,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
            Identité du projet
          </p>

          <div className="mt-3">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
              Environnement
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {environmentOptions.map((option) => {
                const selected = selectedWorkspace === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleWorkspaceChange(option.value);
                    }}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{
                      background: selected ? display.color : surface.s2,
                      color: selected ? "#FFFFFF" : text.secondary,
                      border: `1px solid ${selected ? display.color : surface.border}`,
                      cursor: "pointer",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
              Pictogramme / thème
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {options.filter((option) => option.key !== "other").map((option) => {
                const selected = selectedSubcategory === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSelectedSubcategory(option.key);
                    }}
                    className="rounded-xl px-3 py-2 text-left flex items-center gap-2"
                    style={{
                      background: selected ? surface.s3 : surface.s2,
                      border: `1px solid ${selected ? option.color : surface.border}`,
                      color: text.primary,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      className="inline-flex items-center justify-center rounded-full shrink-0"
                      style={{ width: 20, height: 20, background: option.color }}
                    >
                      <ProjectCategoryIcon icon={option.icon} color="#FFFFFF" size={11} />
                    </span>
                    <span className="text-xs font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsOpen(false);
              }}
              className="rounded-xl px-3 py-2 text-xs font-medium"
              style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}` }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleSave();
              }}
              disabled={isPending}
              className="rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ background: isPending ? surface.s3 : display.color, color: isPending ? text.dim : "#FFFFFF" }}
            >
              {isPending ? "Mise à jour..." : "Appliquer"}
            </button>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
