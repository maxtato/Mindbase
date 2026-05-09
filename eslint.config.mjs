import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    ".claude/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Hydration mismatch handling intentionally uses useState in effects
      "react-hooks/set-state-in-effect": "warn",
      // French text with apostrophes is acceptable
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
