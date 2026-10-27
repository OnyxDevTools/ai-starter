// filename: scripts/init-template.mjs
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: { name: { type: "string" }, slug: { type: "string" } },
  strict: true,
});
const name = values.name?.trim(),
  slug = values.slug;
if (
  !name ||
  name.length > 80 ||
  !slug ||
  slug.length > 63 ||
  !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)
)
  throw new Error("Use --name 'Team Workspace' --slug team-workspace.");
await writeFile("project.json", JSON.stringify({ name, slug }, null, 2) + "\n");
for (const path of ["package.json", "package-lock.json"]) {
  const value = JSON.parse(await readFile(path, "utf8"));
  value.name = slug;
  if (value.packages?.[""]) value.packages[""].name = slug;
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}
