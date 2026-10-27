// filename: modules/models.ts
import { z } from "zod";
import type { OnyxSchema } from "../lib/onyx/generated";
type CheckedRows<T extends OnyxSchema> = T;
const id = z.string().min(1).max(256),
  date = z.iso.datetime({ offset: true });
export type Actor = {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
};
export const runState = z.enum([
  "pending",
  "streaming",
  "completed",
  "cancelled",
  "interrupted",
  "failed",
]);
export const schemas = {
  Workspace: z.object({
    id,
    name: z.string().min(1).max(80),
    createdBy: id,
    createdAt: date,
  }),
  Membership: z.object({
    id,
    workspaceId: id,
    userId: id,
    active: z.boolean(),
    createdAt: date,
  }),
  Conversation: z.object({
    id,
    workspaceId: id,
    ownerUid: id,
    title: z.string().min(1).max(100),
    mode: z.enum(["live", "demo"]),
    activeRunId: z.string(),
    deleted: z.boolean(),
    createdAt: date,
    updatedAt: date,
  }),
  Message: z.object({
    id,
    conversationId: id,
    workspaceId: id,
    ownerUid: id,
    runId: id,
    role: z.enum(["user", "assistant"]),
    text: z.string().max(100000),
    state: runState,
    createdAt: date,
    updatedAt: date,
  }),
  GenerationRun: z.object({
    id,
    conversationId: id,
    workspaceId: id,
    ownerUid: id,
    userMessageId: id,
    assistantMessageId: id,
    requestedModel: z.string(),
    actualModel: z.string(),
    providerRequestId: z.string(),
    mode: z.enum(["live", "demo"]),
    status: runState,
    cancelRequested: z.boolean(),
    useKnowledge: z.boolean(),
    attempt: z.number().int().min(1),
    errorCode: z.string(),
    promptTokens: z.number().int().nonnegative().nullable(),
    completionTokens: z.number().int().nonnegative().nullable(),
    totalTokens: z.number().int().nonnegative().nullable(),
    createdAt: date,
    updatedAt: date,
    expiresAt: date,
  }),
  Attachment: z.object({
    id,
    conversationId: id,
    workspaceId: id,
    ownerUid: id,
    documentId: id,
    name: z.string().max(120),
    mimeType: z.string(),
    size: z.number().int().min(1),
    status: z.enum(["ready", "deleted"]),
    createdAt: date,
  }),
  MessageAttachment: z.object({
    id,
    messageId: id,
    attachmentId: id,
    conversationId: id,
    workspaceId: id,
    ownerUid: id,
  }),
  ToolActivity: z.object({
    id,
    conversationId: id,
    workspaceId: id,
    ownerUid: id,
    runId: id,
    callId: id,
    name: z.string().max(160),
    managedBy: z.enum(["onyx", "application"]),
    status: z.enum([
      "input",
      "running",
      "completed",
      "failed",
      "approval-required",
    ]),
    argumentsText: z.string().max(20000),
    outputText: z.string().max(20000),
    query: z.string().max(500),
    approvalId: z.string().max(256),
    createdAt: date,
    updatedAt: date,
  }),
  Source: z.object({
    id,
    conversationId: id,
    workspaceId: id,
    ownerUid: id,
    runId: id,
    title: z.string().max(300),
    url: z.string().max(2000),
    documentId: z.string().max(256),
  }),
  KnowledgeArticle: z.object({
    id,
    workspaceId: id,
    ownerUid: id,
    title: z.string().max(160),
    body: z.string().max(12000),
    createdAt: date,
  }),
  MutationLock: z.object({ id, operation: z.string(), acquiredAt: date }),
};
export type Rows = CheckedRows<{
  [K in keyof typeof schemas]: z.infer<(typeof schemas)[K]>;
}>;
export type Table = keyof Rows;
export type RunStatus = z.infer<typeof runState>;
export const submitSchema = z
  .object({
    conversationId: z.uuid(),
    requestId: z.uuid(),
    messageId: z.uuid(),
    text: z.string().trim().min(1).max(12000),
    model: z.string().min(1).max(200),
    attachmentIds: z.array(z.uuid()).max(4),
    useKnowledge: z.boolean(),
    retryRunId: z.uuid().optional(),
  })
  .strict();
export type Submit = z.infer<typeof submitSchema>;
