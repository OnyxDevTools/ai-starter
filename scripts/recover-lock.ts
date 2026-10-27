// filename: scripts/recover-lock.ts
import { createStore } from "../lib/onyx/store";
// Deliberate operator recovery, never automatic age-based lock stealing.
const id = process.argv[2];
if (!id || process.env.WRITERS_STOPPED !== "yes")
  throw new Error(
    "Stop all application writers, inspect the operation, then set WRITERS_STOPPED=yes and pass the exact lock id.",
  );
const store = createStore();
const row = await store.get("MutationLock", id);
if (!row) throw new Error("Lock not found.");
await store.remove("MutationLock", id);
console.log(
  "Specified lock released. Inspect partially written records before restarting writers.",
);
