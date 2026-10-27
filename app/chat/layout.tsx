// filename: app/chat/layout.tsx
import { requireActor } from "@/modules/auth/session";
import { services } from "@/lib/api";
import { Shell } from "@/components/chat/shell";
import { Setup } from "@/components/chat/setup";
import { attempt } from "@/lib/errors";
import { aiMode } from "@/lib/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireActor();
  const result = await attempt(async () => {
    const access = services(),
      workspaces = await access.workspaces(actor),
      workspace = workspaces[0] || null,
      initial = workspace
        ? await access.list(actor, workspace.id)
        : { items: [] };
    return { workspace, initial, mode: aiMode() };
  });
  if (result.error) return <Setup message={result.error.message} />;
  return (
    <Shell {...result.data} name={actor.name}>
      {children}
    </Shell>
  );
}
