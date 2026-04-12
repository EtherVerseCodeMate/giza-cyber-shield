import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react"; // Added this import based on the new rules structure

export default [
  { ignores: ["dist"] }, // Retaining the ignores from the original config
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.browser,
        ...globals.es2021, // Added es2021 globals
      },
    },
    plugins: {
      react, // Added react plugin
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules, // Spreading react recommended rules
      ...reactHooks.configs.recommended.rules,
      ...tseslint.configs.recommended.rules, // Spreading tseslint recommended rules
      "react/react-in-jsx-scope": "off", // Added this rule
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];
