// stemmory-cli/eslint.config.mjs
//
// Workspace-wide lint floor, mirrored from the Stemmory product repo's
// config so the two stay stylistically consistent. This repo is small
// enough that every package (and scripts/) shares this one config directly
// rather than each shipping its own.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.turbo/**", "**/coverage/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "off",
    },
  },
);
