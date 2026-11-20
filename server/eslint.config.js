import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**", "src/generated/**", "coverage/**", "node_modules/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      // Configuration is read in one place only (docs/BACKEND_MASTER_PLAN.md §3.2).
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "Read configuration through src/config/env.ts." },
      ],
      // Unsafe raw SQL is banned (docs/SECURITY_PLAN.md §6).
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name=/^\\$(queryRawUnsafe|executeRawUnsafe)$/]",
          message: "Unsafe raw SQL is banned. Use the Prisma client or a tagged $queryRaw template.",
        },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // The few places allowed to read process.env directly.
    files: ["src/config/env.ts", "prisma.config.ts", "vitest.config.ts", "test/**/*.ts"],
    rules: { "no-restricted-properties": "off" },
  },
]);
