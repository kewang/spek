import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dist-demo/**",
      "**/node_modules/**",
      "packages/vscode/webview/**",
      "packages/intellij/**",
      "docs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // A leading underscore is this codebase's existing marker for "deliberately unused" — it is
      // on interface-mandated parameters the implementation does not need (handler.ts) and on
      // destructured fields kept for shape. Teaching the rule the convention, not weakening it.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      // A `let` declared bare and assigned later, whose value a closure defined in between reads,
      // cannot become a `const` without restructuring. schema-order.ts's spawn timeout is exactly
      // that shape, and it guards a process-kill path (DEP0190 / CVE-2024-27980) not worth
      // rewriting for a style rule.
      "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
    },
  },
  {
    files: ["packages/ui/src/**/*.{ts,tsx}", "packages/web/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
