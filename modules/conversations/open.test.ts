// filename: modules/conversations/open.test.ts
import { expect, it, vi } from "vitest";
import { MemoryStore } from "../../tests/fixture/memory";
import { Access } from "./access";
import { openChat } from "./open";
it("opens chat directly and reuses it across duplicate entry requests without crossing owners", async () => {
  vi.stubEnv("AI_MODE", "disabled");
  const access = new Access(new MemoryStore()),
    actor = {
      uid: "owner",
      email: "owner@example.test",
      emailVerified: true,
      name: "Owner",
    };
  try {
    const [a, b] = await Promise.all([
      openChat(access, actor),
      openChat(access, actor),
    ]);
    expect(a.id).toBe(b.id);
    const other = await openChat(access, { ...actor, uid: "other" });
    expect(other.id).not.toBe(a.id);
    await expect(
      openChat(access, { ...actor, emailVerified: false }),
    ).rejects.toThrow("verified");
  } finally {
    vi.unstubAllEnvs();
  }
});
