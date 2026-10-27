// filename: lib/locks.test.ts
import { it, expect } from "vitest";
import { locked } from "./locks";
import { AppError } from "./errors";
import { MemoryStore } from "../tests/fixture/memory";
it("serializes competing writers without stealing a lock", async () => {
  const store = new MemoryStore(),
    sequence: number[] = [];
  await Promise.all([
    locked(store, "same", "first", async () => {
      sequence.push(1);
      await new Promise((r) => setTimeout(r, 30));
      sequence.push(2);
    }),
    locked(store, "same", "second", async () => {
      sequence.push(3);
    }),
  ]);
  expect(sequence).toEqual([1, 2, 3]);
  expect(await store.get("MutationLock", "same")).toBeNull();
});
it("retains uncertain write locks and releases known validation failures", async () => {
  const store = new MemoryStore();
  await expect(
    locked(store, "uncertain", "write", async () => {
      throw new Error("Connection lost after write");
    }),
  ).rejects.toThrow();
  expect(await store.get("MutationLock", "uncertain")).not.toBeNull();
  await expect(
    locked(store, "invalid", "validate", async () => {
      throw new AppError(422, "Invalid request");
    }),
  ).rejects.toThrow();
  expect(await store.get("MutationLock", "invalid")).toBeNull();
});
