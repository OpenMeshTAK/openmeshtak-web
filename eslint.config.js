import eslint from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "openapi/**", "src/generated/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ["**/*.ts", "**/*.vue"],
    rules: {
      // LOGGING.md: all diagnostics go through the sanitizing facade in src/shared/logging.
      "no-console": "error",
      // TypeScript already resolves identifiers, including browser globals.
      "no-undef": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      // One-time secrets and user content must never be rendered as raw HTML.
      "vue/no-v-html": "error",
      // Pure formatting rules that fight short, readable templates.
      "vue/singleline-html-element-content-newline": "off",
      "vue/max-attributes-per-line": "off",
    },
  },
  {
    // The only place allowed to touch the browser console is the logger's output sink.
    files: ["src/shared/logging/console-sink.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["scripts/**/*.ts", "eslint.config.js", "vite.config.ts"],
    languageOptions: {
      globals: { process: "readonly" },
    },
  },
);
