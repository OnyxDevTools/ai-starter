// filename: vitest.config.ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
const root = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "modules/**/*.test.ts",
      "components/**/*.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": root,
      "server-only": fileURLToPath(
        new URL("./tests/fixture/server-only.ts", import.meta.url),
      ),
    },
  },
});
