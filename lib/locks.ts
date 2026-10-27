// filename: lib/locks.ts
import "server-only";
import { AppError } from "./errors";
import type { Store } from "./onyx/store";
export async function locked<T>(
  store: Store,
  id: string,
  operation: string,
  work: () => Promise<T>,
): Promise<T> {
  // Brief contention may wait; a lock is never stolen or deleted by a contender.
  for (let attempt = 0; ; attempt++) {
    try {
      await store.insert("MutationLock", {
        id,
        operation,
        acquiredAt: new Date().toISOString(),
      });
      break;
    } catch (error) {
      if (!(error instanceof AppError) || error.status !== 409 || attempt >= 5)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
  try {
    const result = await work();
    await store.remove("MutationLock", id);
    return result;
  } catch (error) {
    if (error instanceof AppError && error.status < 500)
      await store.remove("MutationLock", id);
    throw error;
  }
}
