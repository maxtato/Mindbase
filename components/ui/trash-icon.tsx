export const deleteTone = {
  bg: "var(--mb-delete-bg)",
  border: "var(--mb-delete-border)",
  text: "var(--mb-delete-text)",
  solid: "var(--mb-delete-solid)",
} as const;

export function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.8h10" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M6 4.8V3.4c0-.35.28-.65.65-.65h2.7c.37 0 .65.3.65.65v1.4" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 6.3l.45 6.25c.04.55.5.98 1.05.98h3c.55 0 1.01-.43 1.05-.98L11 6.3" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8.2v3M9 8.2v3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}
