// filename: lib/onyx/store.ts
import "server-only";
import { onyx, asc, eq, type IOnyxDatabase } from "@onyx.dev/onyx-database";
import { AppError } from "../errors";
import { schemas, type Rows, type Table } from "../../modules/models";
export interface Store {
  get<K extends Table>(table: K, id: string): Promise<Rows[K] | null>;
  insert<K extends Table>(table: K, row: Rows[K]): Promise<void>;
  update<K extends Table>(table: K, row: Rows[K]): Promise<void>;
  remove(table: Table, id: string): Promise<void>;
  page<K extends Table>(
    table: K,
    where: Partial<Rows[K]>,
    limit?: number,
    cursor?: string,
  ): Promise<{ items: Rows[K][]; cursor?: string }>;
  saveDocument(id: string, mimeType: string, content: Buffer): Promise<void>;
  document(id: string): Promise<Buffer>;
  deleteDocument(id: string): Promise<void>;
  search(
    workspaceId: string,
    ownerUid: string,
    query: string,
  ): Promise<Rows["KnowledgeArticle"][]>;
}
function storageError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 409
  )
    throw new AppError(
      409,
      "Another operation already claimed this identifier. Refresh and retry.",
    );
  throw new AppError(
    503,
    "Onyx is unavailable or not configured. Check the existing downloaded configuration and application schema.",
  );
}
export function database(): IOnyxDatabase<Rows> {
  return onyx.init<Rows>({
    wireFormat: "json",
    requestLoggingEnabled: false,
    responseLoggingEnabled: false,
    retry: { enabled: false },
    fetch: async (input, init) =>
      fetch(input, {
        ...init,
        body:
          init?.body instanceof Uint8Array
            ? new Uint8Array(init.body).buffer
            : (init?.body ?? null),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }),
  });
}
export function createStore(db = database()): Store {
  return {
    async get<K extends Table>(table: K, id: string) {
      try {
        const row = await db.findById(table, id);
        return row == null ? null : (schemas[table].parse(row) as Rows[K]);
      } catch (error) {
        return storageError(error);
      }
    },
    async insert<K extends Table>(table: K, row: Rows[K]) {
      try {
        await db.insert(table, schemas[table].parse(row) as Rows[K]);
      } catch (error) {
        storageError(error);
      }
    },
    async update<K extends Table>(table: K, row: Rows[K]) {
      try {
        const valid = schemas[table].parse(row) as Rows[K];
        const count = await db
          .from(table)
          .where(eq("id", valid.id))
          .setUpdates(valid)
          .update();
        if (count !== 1)
          throw new AppError(
            409,
            "Record changed or missing; refresh before retrying.",
          );
      } catch (error) {
        storageError(error);
      }
    },
    async remove(table, id) {
      try {
        await db.delete(table, id);
      } catch (error) {
        storageError(error);
      }
    },
    async page<K extends Table>(
      table: K,
      where: Partial<Rows[K]>,
      limit = 20,
      cursor?: string,
    ) {
      try {
        if (limit < 1 || limit > 100 || (cursor && cursor.length > 4096))
          throw new AppError(422, "Invalid page.");
        let query = db.from(table);
        let filtered = false;
        for (const [field, value] of Object.entries(where)) {
          query = filtered
            ? query.and(eq(field, value))
            : query.where(eq(field, value));
          filtered = true;
        }
        const page = await query
          .orderBy(asc("id"))
          .page({ pageSize: limit, ...(cursor ? { nextPage: cursor } : {}) });
        return {
          items: page.records.map(
            (row) => schemas[table].parse(row) as Rows[K],
          ),
          ...(page.nextPage ? { cursor: page.nextPage } : {}),
        };
      } catch (error) {
        return storageError(error);
      }
    },
    async saveDocument(id, mimeType, content) {
      try {
        await db.saveDocument({
          documentId: id,
          path: `/chat-attachments/${id}`,
          mimeType,
          content: content.toString("base64"),
        });
      } catch (error) {
        storageError(error);
      }
    },
    async document(id) {
      try {
        const value = await db.getDocument(id);
        if (
          !value ||
          typeof value !== "object" ||
          !("content" in value) ||
          typeof value.content !== "string"
        )
          throw new AppError(503, "Unexpected document response.");
        return Buffer.from(value.content, "base64");
      } catch (error) {
        return storageError(error);
      }
    },
    async deleteDocument(id) {
      try {
        await db.deleteDocument(id);
      } catch (error) {
        storageError(error);
      }
    },
    async search(workspaceId, ownerUid, query) {
      try {
        const mode = process.env.ONYX_SEARCH_MODE || "lexical";
        if (!["lexical", "semantic", "hybrid"].includes(mode))
          throw new AppError(503, "Invalid Onyx search mode.");
        const results = await db
          .from("KnowledgeArticle")
          .search(query, {
            mode: mode as "lexical" | "semantic" | "hybrid",
            match: "any",
            maxCandidates: 100,
          })
          .and(eq("workspaceId", workspaceId))
          .and(eq("ownerUid", ownerUid))
          .limit(5)
          .list();
        return results.map((row) => schemas.KnowledgeArticle.parse(row));
      } catch (error) {
        return storageError(error);
      }
    },
  };
}
export async function collect<K extends Table>(
  store: Store,
  table: K,
  where: Partial<Rows[K]>,
  maximum = 1000,
) {
  const rows: Rows[K][] = [];
  let cursor: string | undefined;
  do {
    const page = await store.page(table, where, 100, cursor);
    rows.push(...page.items);
    if (rows.length > maximum)
      throw new AppError(
        503,
        "This conversation exceeds the bounded history budget. Start a new conversation.",
      );
    cursor = page.cursor;
  } while (cursor);
  return rows;
}
