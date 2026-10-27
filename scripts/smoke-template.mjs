// filename: scripts/smoke-template.mjs
import { cp, mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { execFileSync } from "node:child_process";
const source = process.cwd(),
  destination = await mkdtemp(join(tmpdir(), "ai-template-smoke-"));
try {
  await cp(source, destination, {
    recursive: true,
    filter: (path) => {
      const name = basename(path),
        local = relative(source, path);
      return (
        ![
          ".git",
          "node_modules",
          ".next",
          ".next-build",
          ".cache",
          ".react-email",
          "reports",
          "playwright-report",
          "test-results",
        ].includes(name) &&
        local !== "config" &&
        !name.startsWith("onyx-database") &&
        !(name.startsWith(".env") && name !== ".env.example") &&
        !name.endsWith(".tsbuildinfo")
      );
    },
  });
  const run = (args) =>
    execFileSync("npm", args, {
      cwd: destination,
      stdio: "inherit",
      timeout: 240000,
    });
  run(["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
  run([
    "run",
    "template:init",
    "--",
    "--name",
    "Smoke Chat",
    "--slug",
    "smoke-team",
  ]);
  const identity = JSON.parse(
    await readFile(join(destination, "project.json"), "utf8"),
  );
  if (identity.slug !== "smoke-team")
    throw new Error("Identity initialization failed");
  run(["run", "check"]);
  run(["run", "schema:validate"]);
  console.log(
    "Independent clean install, identity initialization, all checks, schema validation, and production build passed without live services.",
  );
} finally {
  await rm(destination, { recursive: true, force: true });
}
