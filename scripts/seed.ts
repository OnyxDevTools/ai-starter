// filename: scripts/seed.ts
import { firebaseAdmin } from "../modules/auth/admin";
import { Access, stableId } from "../modules/conversations/access";
import { createStore } from "../lib/onyx/store";
import { ensure } from "../lib/errors";
async function main() {
  ensure(
    process.env.SEED_USER_UID,
    422,
    "Set SEED_USER_UID to an existing verified Firebase user.",
  );
  const user = await firebaseAdmin().getUser(process.env.SEED_USER_UID);
  ensure(
    user.email && user.emailVerified && !user.disabled,
    422,
    "Seed user must be verified and active.",
  );
  const actor = {
      uid: user.uid,
      email: user.email,
      emailVerified: true,
      name: user.displayName || user.email,
    },
    store = createStore(),
    access = new Access(store),
    workspace = await access.createWorkspace(actor, "My workspace");
  const id = stableId(workspace.id, "onboarding-example");
  if (!(await store.get("KnowledgeArticle", id)))
    await store.insert("KnowledgeArticle", {
      id,
      workspaceId: workspace.id,
      ownerUid: actor.uid,
      title: "A simple onboarding checklist",
      body: "Start by defining one customer problem. Keep the first workflow small. Review access boundaries before adding a new data source. Onyx provides native table search and agents; no separate vector database is required.",
      createdAt: new Date().toISOString(),
    });
  console.log(
    `Seeded one scoped knowledge article for workspace ${workspace.id}. Repeating this command preserves existing content.`,
  );
}
main().catch(() => {
  console.error(
    "Seed failed. Check SEED_USER_UID, verified Firebase account, Onyx schema, credentials and retained locks.",
  );
  process.exitCode = 1;
});
