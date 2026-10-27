// filename: eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  eslintConfigPrettier,
  // Official SDK-generated types contain open entity index signatures; validate through Zod at the adapter boundary.
  globalIgnores([".next/**", ".next-build/**", "lib/onyx/generated.ts"]),
]);
