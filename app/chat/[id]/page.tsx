// filename: app/chat/[id]/page.tsx
import { z } from "zod";
import { requireActor } from "@/modules/auth/session";
import { services } from "@/lib/api";
import { snapshot, uiMessages } from "@/modules/conversations/history";
import { liveProvider } from "@/modules/generation/provider";
import { Chat } from "@/components/chat/chat";
import { Setup } from "@/components/chat/setup";
import { aiMode } from "@/lib/config";
import { attempt, safeMessage } from "@/lib/errors";
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  const result = await attempt(async () => {
    const data = await snapshot(
      services(),
      actor,
      z.uuid().parse((await params).id),
    );
    let models: string[] = [],
      configuration = "";
    try {
      if (data.conversation.mode !== aiMode())
        configuration =
          "This conversation’s generation mode is disabled in the current environment.";
      else if (aiMode() === "demo") models = ["demo-local"];
      else
        models = (await liveProvider(actor, data.conversation.workspaceId))
          .models;
    } catch (e) {
      configuration = safeMessage(e);
    }
    return { data, models, configuration };
  });
  if (result.error) return <Setup message={result.error.message} />;
  const { data, models, configuration } = result.data;
  return (
    <Chat
      key={data.conversation.id}
      initial={data}
      initialMessages={uiMessages(data)}
      models={models}
      configuration={configuration}
    />
  );
}
