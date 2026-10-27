// filename: tests/fixture/memory.ts
// Test double only. Application code always uses the Onyx SDK.
import { AppError } from "../../lib/errors";
import type { Store } from "../../lib/onyx/store";
import type { Rows, Table } from "../../modules/models";
export class MemoryStore implements Store {
  tables = new Map<Table, Map<string, unknown>>();
  documents = new Map<string, Buffer>();
  searches = 0;
  table(name: Table) {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }
  async get<K extends Table>(name: K, id: string) {
    return structuredClone(this.table(name).get(id) ?? null) as Rows[K] | null;
  }
  async insert<K extends Table>(name: K, row: Rows[K]) {
    if (this.table(name).has(row.id)) throw new AppError(409, "Duplicate id");
    this.table(name).set(row.id, structuredClone(row));
  }
  async update<K extends Table>(name: K, row: Rows[K]) {
    if (!this.table(name).has(row.id)) throw new AppError(409, "Missing id");
    this.table(name).set(row.id, structuredClone(row));
  }
  async remove(name: Table, id: string) {
    this.table(name).delete(id);
  }
  async page<K extends Table>(
    name: K,
    where: Partial<Rows[K]>,
    limit = 20,
    cursor?: string,
  ) {
    const rows = ([...this.table(name).values()] as Rows[K][])
      .filter((row) =>
        Object.entries(where).every(
          ([key, value]) => Reflect.get(row, key) === value,
        ),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const start = Number(cursor || 0);
    return {
      items: structuredClone(rows.slice(start, start + limit)),
      ...(start + limit < rows.length ? { cursor: String(start + limit) } : {}),
    };
  }
  async saveDocument(id: string, _mime: string, content: Buffer) {
    this.documents.set(id, content);
  }
  async document(id: string) {
    const value = this.documents.get(id);
    if (!value) throw new AppError(404, "No document");
    return value;
  }
  async deleteDocument(id: string) {
    this.documents.delete(id);
  }
  async search(workspaceId: string, ownerUid: string, query: string) {
    this.searches++;
    return (
      await this.page("KnowledgeArticle", { workspaceId, ownerUid }, 100)
    ).items.filter((row) =>
      (row.title + row.body).toLowerCase().includes(query.toLowerCase()),
    );
  }
}
