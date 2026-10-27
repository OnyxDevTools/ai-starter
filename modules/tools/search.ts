// filename: modules/tools/search.ts
import "server-only";
import { z } from "zod";
import { ensure } from "../../lib/errors";
import { Access } from "../conversations/access";
import type { Actor } from "../models";
export const searchInput = z
  .object({ query: z.string().trim().min(1).max(500) })
  .strict();
export async function searchKnowledge(
  access: Access,
  actor: Actor,
  conversationId: string,
  input: unknown,
) {
  const { query } = searchInput.parse(input),
    conversation = await access.conversation(actor, conversationId);
  const rows = await access.store.search(
    conversation.workspaceId,
    actor.uid,
    query,
  );
  ensure(
    rows.every(
      (r) =>
        r.workspaceId === conversation.workspaceId && r.ownerUid === actor.uid,
    ),
    503,
    "Onyx returned a search result outside the requested scope.",
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    excerpt: row.body.slice(0, 1800),
  }));
}
