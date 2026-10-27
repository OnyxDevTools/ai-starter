// filename: scripts/schema.ts
import { readFile } from "node:fs/promises";
import { onyx, type SchemaEntity } from "@onyx.dev/onyx-database";
const local = JSON.parse(
  await readFile(new URL("../api/onyx.schema.json", import.meta.url), "utf8"),
) as { tables: SchemaEntity[] };
async function main() {
  const operation = process.argv[2];
  if (
    !local.tables.length ||
    new Set(local.tables.map((table) => table.name)).size !==
      local.tables.length
  )
    throw new Error("Schema must have unique named tables.");
  if (operation === "validate") {
    for (const table of local.tables) {
      if (!table.identifier || !table.attributes?.length)
        throw new Error("Incomplete schema table.");
    }
    console.log("Local schema valid.");
  } else {
    const db = onyx.init({
      wireFormat: "json",
      requestLoggingEnabled: false,
      responseLoggingEnabled: false,
    });
    const current = await db.getSchema();
    const tables: SchemaEntity[] = [
      ...(Array.isArray(current.tables)
        ? (current.tables as SchemaEntity[])
        : current.entities || []),
    ];
    for (const table of local.tables) {
      const existing = tables.find((row) => row.name === table.name);
      if (!existing) tables.push(table);
      else {
        if (
          existing.identifier?.name !== table.identifier?.name ||
          existing.identifier?.type !== table.identifier?.type
        )
          throw new Error(
            "Existing table identifier differs; review schema manually.",
          );
        const attrs = existing.attributes || [];
        for (const required of table.attributes || []) {
          const actual = attrs.find((row) => row.name === required.name);
          if (
            !actual ||
            actual.type !== required.type ||
            actual.isNullable !== required.isNullable
          )
            throw new Error(
              `Existing ${table.name}.${required.name} is incompatible; review schema manually.`,
            );
        }
      }
    }
    const merged = { ...current, tables, entities: tables };
    if (operation === "diff") {
      console.log(JSON.stringify(await db.diffSchema(merged), null, 2));
    } else if (operation === "publish") {
      const valid = await db.validateSchema(merged);
      if (valid.valid === false)
        throw new Error("Onyx rejected schema validation.");
      await db.updateSchema(merged, { publish: true });
      console.log(
        "Additive schema published using the configured Onyx database.",
      );
    } else throw new Error("Use validate, diff, or publish.");
  }
}
main().catch(() => {
  console.error(
    "Schema operation failed. Check operation, downloaded Onyx configuration, permissions, and existing schema compatibility.",
  );
  process.exitCode = 1;
});
