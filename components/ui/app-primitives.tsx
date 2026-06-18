import Link from "next/link";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import type { Workspace as WorkspaceType } from "@/lib/workspace";
import {
  cx,
  designTokens,
  getButtonToneClass,
  getButtonToneStyle,
  getFieldToneClass,
  getFieldToneStyle,
  getSurfaceToneClass,
  getSurfaceToneStyle,
  getWorkspaceTheme,
  mergeStyles,
  textStyles,
  type ButtonTone,
  type FieldTone,
  type SurfaceTone,
} from "./theme";

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
  tone?: SurfaceTone;
  style?: CSSProperties;
};

type SectionHeadingProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  workspace?: WorkspaceType;
  tone?: "workspace" | "accent" | "muted" | "inverse";
  size?: "xl" | "lg" | "md";
  className?: string;
};

type MetricCardProps = {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  tone?: SurfaceTone;
  captionTone?: "workspace" | "accent" | "muted";
  workspace?: WorkspaceType;
  className?: string;
  style?: CSSProperties;
};

type PillBadgeProps = {
  children: ReactNode;
  tone?: "surface" | "accent" | "workspace";
  workspace?: WorkspaceType;
  className?: string;
  style?: CSSProperties;
};

type ActionLinkProps = {
  href: string;
  children: ReactNode;
  tone?: ButtonTone;
  workspace?: WorkspaceType;
  className?: string;
  style?: CSSProperties;
};

type FieldLabelProps = ComponentPropsWithoutRef<"label"> & {
  tone?: "default" | "inverse";
};

type FieldProps<T extends "input" | "textarea" | "select"> =
  ComponentPropsWithoutRef<T> & {
    tone?: FieldTone;
  };

type InlineNoticeProps = {
  children: ReactNode;
  tone?: "error" | "neutral";
  className?: string;
  style?: CSSProperties;
};

const headingSizes = {
  xl: "mt-4 text-5xl font-semibold tracking-tight",
  lg: "mt-4 text-4xl font-semibold tracking-tight",
  md: "mt-3 text-2xl font-semibold tracking-tight",
} as const;

export function SurfaceCard({
  children,
  className,
  tone = "primary",
  style,
}: SurfaceCardProps) {
  return (
    <div
      className={cx("rounded-[22px] p-6", getSurfaceToneClass(tone), className)}
      style={mergeStyles(getSurfaceToneStyle(tone), style)}
    >
      {children}
    </div>
  );
}

export function WorkspacePanel({
  children,
  workspace,
  className,
  style,
}: {
  children: ReactNode;
  workspace: WorkspaceType;
  className?: string;
  style?: CSSProperties;
}) {
  const theme = getWorkspaceTheme(workspace);

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[22px] p-6 text-white",
        theme.panelClassName,
        className
      )}
      style={mergeStyles(theme.panelStyle, style)}
    >
      <div
        aria-hidden="true"
        className="absolute left-6 top-0 h-[3px] w-20 rounded-full"
        style={theme.ruleStyle}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export function SectionHeading({
  title,
  eyebrow,
  description,
  workspace,
  tone = "muted",
  size = "lg",
  className,
}: SectionHeadingProps) {
  const workspaceTheme = workspace ? getWorkspaceTheme(workspace) : null;

  const eyebrowStyle =
    tone === "inverse"
      ? { color: "#4A3C62" }
      : tone === "accent"
        ? textStyles.accent
        : tone === "workspace" && workspaceTheme
          ? workspaceTheme.softTextStyle
          : textStyles.soft;

  const titleStyle = tone === "inverse" ? textStyles.inverse : textStyles.strong;
  const descriptionStyle =
    tone === "inverse" ? { color: "#35294B" } : textStyles.muted;

  return (
    <div className={className}>
      {eyebrow ? (
        <p
          className="text-xs uppercase tracking-[0.24em]"
          style={eyebrowStyle}
        >
          {eyebrow}
        </p>
      ) : null}

      <h3 className={headingSizes[size]} style={titleStyle}>
        {title}
      </h3>

      {description ? (
        <p className="mt-4 text-base leading-8" style={descriptionStyle}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  caption,
  tone = "secondary",
  captionTone = "muted",
  workspace,
  className,
  style,
}: MetricCardProps) {
  const isAccentTone = tone === "accent";
  const workspaceTheme = workspace ? getWorkspaceTheme(workspace) : null;
  const captionStyle =
    isAccentTone
      ? { color: "#3C3050" }
      : captionTone === "accent"
        ? textStyles.accent
        : captionTone === "workspace" && workspaceTheme
          ? workspaceTheme.softTextStyle
          : textStyles.muted;

  return (
    <div
      className={cx(
        "rounded-[22px] p-5",
        getSurfaceToneClass(tone),
        className
      )}
      style={mergeStyles(getSurfaceToneStyle(tone), style)}
    >
      <p
        className="text-xs uppercase tracking-[0.2em]"
        style={isAccentTone ? { color: "#46375D" } : textStyles.soft}
      >
        {label}
      </p>
      <div
        className="mt-3 text-4xl font-semibold"
        style={isAccentTone ? textStyles.inverse : textStyles.strong}
      >
        {value}
      </div>
      {caption ? (
        <p className="mt-2 text-sm" style={captionStyle}>
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function PillBadge({
  children,
  tone = "surface",
  workspace = "personal",
  className,
  style,
}: PillBadgeProps) {
  const workspaceTheme = getWorkspaceTheme(workspace);
  const toneClassName =
    tone === "accent"
      ? "mb-pill mb-pill--accent"
      : tone === "workspace"
        ? workspaceTheme.pillClassName
        : "mb-pill mb-pill--surface";

  const toneStyle =
    tone === "accent"
      ? {
          background: designTokens.colors.accentSoft,
          color: "#ffffff",
          border: `1px solid ${designTokens.colors.personalBorder}`,
        }
      : tone === "workspace"
        ? workspaceTheme.pillStyle
        : {
            background: designTokens.colors.surfaceSecondary,
            color: designTokens.colors.textMuted,
            border: `1px solid ${designTokens.colors.borderSubtle}`,
          };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium",
        toneClassName,
        className
      )}
      style={mergeStyles(toneStyle, style)}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx(
        "rounded-[22px] p-6 text-sm leading-7 mb-text-muted",
        getSurfaceToneClass("secondary"),
        className
      )}
      style={mergeStyles(getSurfaceToneStyle("secondary"), textStyles.muted, style)}
    >
      {children}
    </div>
  );
}

export function ActionLink({
  href,
  children,
  tone = "workspace",
  workspace = "personal",
  className,
  style,
}: ActionLinkProps) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition hover:opacity-95",
        getButtonToneClass(tone, workspace),
        className
      )}
      style={mergeStyles(getButtonToneStyle(tone, workspace), style)}
    >
      {children}
    </Link>
  );
}

export function FieldLabel({
  tone = "default",
  className,
  style,
  ...props
}: FieldLabelProps) {
  return (
    <label
      {...props}
      className={cx("mb-2 block text-sm", className)}
      style={mergeStyles(
        tone === "inverse"
          ? { color: "#302542" }
          : { color: designTokens.colors.textMuted },
        style
      )}
    />
  );
}

export function TextInput({
  tone = "dark",
  className,
  ...props
}: FieldProps<"input">) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-[22px] px-4 py-3 outline-none transition",
        getFieldToneClass(tone),
        className
      )}
      style={getFieldToneStyle(tone)}
    />
  );
}

export function TextArea({
  tone = "dark",
  className,
  ...props
}: FieldProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-[22px] px-4 py-3 outline-none transition",
        getFieldToneClass(tone),
        className
      )}
      style={getFieldToneStyle(tone)}
    />
  );
}

export function SelectField({
  tone = "dark",
  className,
  ...props
}: FieldProps<"select">) {
  return (
    <select
      {...props}
      className={cx(
        "w-full rounded-[22px] px-4 py-3 outline-none transition",
        getFieldToneClass(tone),
        className
      )}
      style={getFieldToneStyle(tone)}
    />
  );
}

export function InlineNotice({
  children,
  tone = "error",
  className,
  style,
}: InlineNoticeProps) {
  return (
    <div
      className={cx(
        "rounded-[22px] px-4 py-3 text-sm",
        tone === "error"
          ? "mb-notice mb-notice--error"
          : "mb-surface-secondary mb-text-muted",
        className
      )}
      style={mergeStyles(
        tone === "error"
          ? {
              background: designTokens.colors.dangerBg,
              color: designTokens.colors.dangerText,
              border: `1px solid ${designTokens.colors.dangerBorder}`,
            }
          : {
              ...getSurfaceToneStyle("secondary"),
              ...textStyles.muted,
            },
        style
      )}
    >
      {children}
    </div>
  );
}
