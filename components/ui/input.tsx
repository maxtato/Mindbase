"use client";

// Input / Textarea / Select unifiés.
// Utilisation : <Input placeholder="…" /> · <Textarea rows={4} /> · <Select options={…} />
// Les 3 utilisent le même style de base (focus ring mauve, border subtle, hover état).

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";

const baseStyle = {
  width: "100%",
  background: "var(--mb-s1)",
  border: "1px solid var(--mb-border-subtle)",
  borderRadius: "var(--mb-radius-md)",
  padding: "8px 12px",
  fontSize: "13.5px",
  color: "var(--mb-text-primary)",
  fontFamily: "inherit",
  lineHeight: 1.4,
  outline: "none",
  transition: "border-color 120ms var(--mb-ease), box-shadow 120ms var(--mb-ease)",
} as const;

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, style, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={`mb-input ${invalid ? "mb-input-invalid" : ""} ${className ?? ""}`.trim()}
      style={{ ...baseStyle, ...style }}
      {...rest}
    />
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ invalid, className, style, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={`mb-input ${invalid ? "mb-input-invalid" : ""} ${className ?? ""}`.trim()}
      style={{ ...baseStyle, resize: "vertical", minHeight: 80, ...style }}
      {...rest}
    />
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ invalid, className, style, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={`mb-input ${invalid ? "mb-input-invalid" : ""} ${className ?? ""}`.trim()}
      style={{
        ...baseStyle,
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23a1a1aa' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: 30,
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, htmlFor, children, className }: FieldProps) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label
          htmlFor={htmlFor}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--mb-text-secondary)",
            letterSpacing: 0,
          }}
        >
          {label}
          {required && <span style={{ color: "var(--mb-status-red-text)", marginLeft: 3 }}>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p style={{ fontSize: 11, color: "var(--mb-status-red-text)", margin: 0, lineHeight: 1.4 }}>{error}</p>
      ) : hint ? (
        <p style={{ fontSize: 11, color: "var(--mb-text-muted)", margin: 0, lineHeight: 1.4 }}>{hint}</p>
      ) : null}
    </div>
  );
}
