// Stable surface tokens — always inline styles, never dynamic Tailwind classes.
// Values are CSS variables so the same components can switch dark/light/system themes.

// ─── Spacing scale (4px grid) ────────────────────────────────────────────────
export const space = {
  s1: "var(--mb-space-1)", // 4
  s2: "var(--mb-space-2)", // 8
  s3: "var(--mb-space-3)", // 12
  s4: "var(--mb-space-4)", // 16
  s5: "var(--mb-space-5)", // 20
  s6: "var(--mb-space-6)", // 24
  s8: "var(--mb-space-8)", // 32
  s10: "var(--mb-space-10)", // 40
  s12: "var(--mb-space-12)", // 48
  s16: "var(--mb-space-16)", // 64
} as const;

// ─── Border radius scale ─────────────────────────────────────────────────────
export const radius = {
  xs: "var(--mb-radius-xs)", // 4
  sm: "var(--mb-radius-sm)", // 6
  md: "var(--mb-radius-md)", // 10
  lg: "var(--mb-radius-lg)", // 14
  xl: "var(--mb-radius-xl)", // 20
  xl2: "var(--mb-radius-2xl)", // 28
  pill: "var(--mb-radius-pill)", // 999
} as const;

// ─── Shadow scale ────────────────────────────────────────────────────────────
export const shadow = {
  xs: "var(--mb-shadow-xs)",
  sm: "var(--mb-shadow-sm)",
  md: "var(--mb-shadow-md)",
  lg: "var(--mb-shadow-lg)",
} as const;

// ─── Typography scale ────────────────────────────────────────────────────────
export const fontSize = {
  xs2: "var(--mb-text-2xs)", // 11
  xs: "var(--mb-text-xs)", // 12
  sm: "var(--mb-text-sm)", // 13
  base: "var(--mb-text-base)", // 14
  md: "var(--mb-text-md)", // 15
  lg: "var(--mb-text-lg)", // 16
  xl: "var(--mb-text-xl)", // 18
  xl2: "var(--mb-text-2xl)", // 22
  xl3: "var(--mb-text-3xl)", // 28
  xl4: "var(--mb-text-4xl)", // 36
} as const;

export const fontWeight = {
  regular: "var(--mb-font-regular)", // 400
  medium: "var(--mb-font-medium)", // 500
  semibold: "var(--mb-font-semibold)", // 600
  bold: "var(--mb-font-bold)", // 700
} as const;

export const leading = {
  tight: "var(--mb-leading-tight)",
  snug: "var(--mb-leading-snug)",
  normal: "var(--mb-leading-normal)",
  relaxed: "var(--mb-leading-relaxed)",
} as const;

// ─── Motion ──────────────────────────────────────────────────────────────────
export const motion = {
  durationFast: "var(--mb-duration-fast)",
  durationBase: "var(--mb-duration-base)",
  ease: "var(--mb-ease)",
} as const;

export const surface = {
  bg: "var(--mb-bg)",
  s1: "var(--mb-s1)",
  s2: "var(--mb-s2)",
  s3: "var(--mb-s3)",
  s4: "var(--mb-s4)",
  sidebar: "var(--mb-sidebar)",
  sidebarPanel: "var(--mb-sidebar-panel)",
  sidebarPanelActive: "var(--mb-sidebar-panel-active)",
  sidebarBorder: "var(--mb-sidebar-border)",
  logoPlate: "var(--mb-logo-plate)",
  logoPlateBorder: "var(--mb-logo-plate-border)",
  onColor: "var(--mb-on-color)",
  onColorDim: "var(--mb-on-color-dim)",
  metricIconBg: "var(--mb-metric-icon-bg)",
  metricIconBorder: "var(--mb-metric-icon-border)",
  metricIconColor: "var(--mb-metric-icon-color)",
  border: "var(--mb-border)",
  borderSubtle: "var(--mb-border-subtle)",
  borderHover: "var(--mb-border-hover)",
  topHighlight: "var(--mb-top-highlight)",
} as const;

export const text = {
  primary: "var(--mb-text-primary)",
  secondary: "var(--mb-text-secondary)",
  muted: "var(--mb-text-muted)",
  dim: "var(--mb-text-dim)",
  ghost: "var(--mb-text-ghost)",
  sidebar: "var(--mb-sidebar-text)",
  sidebarMuted: "var(--mb-sidebar-text-muted)",
  sidebarDim: "var(--mb-sidebar-text-dim)",
} as const;

// ─── Palette sémantique unifiée ───────────────────────────────────────────────
// 🟢 vert   = actif / ok / validé
// 🟡 jaune  = en pause / planifié / en attente
// 🔴 rouge  = bloqué / alerte / urgent
// 🔵 bleu   = terminé / info / lié

export const statusColor = {
  green:  { bg: "var(--mb-status-green-bg)",  text: "var(--mb-status-green-text)",  dot: "var(--mb-status-green-text)" },
  yellow: { bg: "var(--mb-status-yellow-bg)", text: "var(--mb-status-yellow-text)", dot: "var(--mb-status-yellow-text)" },
  orange: { bg: "var(--mb-status-orange-bg)", text: "var(--mb-status-orange-text)", dot: "var(--mb-status-orange-text)" },
  red:    { bg: "var(--mb-status-red-bg)",    text: "var(--mb-status-red-text)",    dot: "var(--mb-status-red-text)" },
  blue:   { bg: "var(--mb-status-blue-bg)",   text: "var(--mb-status-blue-text)",   dot: "var(--mb-status-blue-text)" },
  gray:   { bg: "var(--mb-status-gray-bg)",   text: "var(--mb-status-gray-text)",   dot: "var(--mb-text-ghost)" },
} as const;

// ─── Statuts projet ───────────────────────────────────────────────────────────
// 🟢 vert   = actif       🟡 jaune = en pause
// 🔵 bleu   = terminé     ⬛ gris  = archivé
export const status = {
  preparing: statusColor.gray,    // À préparer
  active:    statusColor.green,   // En cours
  paused:    statusColor.yellow,  // En pause
  "on-hold": statusColor.yellow,  // En pause
  completed: statusColor.blue,    // Terminé
  archived:  statusColor.gray,    // Archivé
} as const;

// ─── Priorités ────────────────────────────────────────────────────────────────
// Rouge = haute, bleu = moyenne, gris = faible.
export const priorityColor = {
  high:   statusColor.red,
  medium: statusColor.blue,
  low:    statusColor.gray,
} as const;

// ─── Sévérité (bloqueurs, risques) ────────────────────────────────────────────
// Aligne avec priorityColor pour cohérence visuelle
export const severity = {
  high:   { bg: statusColor.red.bg,    text: statusColor.red.text },
  medium: { bg: statusColor.orange.bg, text: statusColor.orange.text },
  low:    { bg: statusColor.green.bg,  text: statusColor.green.text },
} as const;

export const decision = {
  decided:    { bg: statusColor.green.bg,  text: statusColor.green.text },
  pending:    { bg: statusColor.yellow.bg, text: statusColor.yellow.text },
  revisiting: { bg: statusColor.blue.bg,   text: statusColor.blue.text },
} as const;

export const error = {
  bg: "var(--mb-error-bg)",
  border: "var(--mb-error-border)",
  text: "var(--mb-error-text)",
  dot: "var(--mb-error-text)",
} as const;

export const mauve = {
  DEFAULT: "var(--mb-mauve)",
  bg: "var(--mb-mauve-bg)",
  text: "var(--mb-mauve-text)",
  onMauve: "var(--mb-mauve-on)",
} as const;

export type SurfaceKey = keyof typeof surface;
export type StatusKey = keyof typeof status;
