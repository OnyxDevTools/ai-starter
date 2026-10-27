// filename: scripts/create-schema.ts
import { writeFile } from "node:fs/promises";
import { schemas } from "../modules/models";
const tables = Object.entries(schemas).map(([name, schema]) => ({
  name,
  type: "DEFAULT",
  identifier: { name: "id", type: "String", generator: "None" },
  attributes: Object.entries(schema.shape).map(([key, value]) => {
    const nullable = value.isNullable();
    const meta = ("unwrap" in value ? value.unwrap() : value).toJSONSchema();
    return {
      name: key,
      type:
        meta.type === "boolean"
          ? "Boolean"
          : meta.type === "number" ||
              meta.type === "integer" ||
              (Array.isArray(meta.type) && meta.type.includes("integer"))
            ? "Int"
            : "String",
      isNullable: nullable,
    };
  }),
  indexes: Object.keys(schema.shape)
    .filter(
      (key) =>
        key === "workspaceId" ||
        key === "ownerUid" ||
        key === "conversationId" ||
        key === "userId" ||
        key === "runId" ||
        key === "messageId",
    )
    .map((key) => ({
      name: String(key),
      type: "DEFAULT",
      searchSupport: undefined as "BOTH" | undefined,
    })),
  resolvers: [],
  triggers: [],
}));
for (const table of tables)
  if (table.name === "KnowledgeArticle")
    table.indexes.push(
      { name: "title", type: "SEARCHABLE", searchSupport: "BOTH" },
      { name: "body", type: "SEARCHABLE", searchSupport: "BOTH" },
    );
await writeFile(
  new URL("../api/onyx.schema.json", import.meta.url),
  JSON.stringify({ tables }, null, 2) + "\n",
);
