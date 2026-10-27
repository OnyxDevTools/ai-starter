# AI Starter

A private, persistent chat workspace powered by **Onyx agents**, native Onyx table search/RAG, and Onyx document storage. One Next.js application, one Node.js process, no separate backend or vector database. The UI uses a graphite/amber theme with ivory typography, a dark default and a matching parchment light mode.

No direct OpenAI or Anthropic integration, provider keys, paid documentation service, or mandatory hosting vendor. The AI SDK manages browser chat state and the UI stream protocol; the **official Onyx SDK performs all live model calls**. Service usage is subject to your Onyx/Firebase plans; open-source libraries do not imply free hosted inference.

## Start locally

Use Node **24.12+** (`.nvmrc` pins 24.22.1), npm, an application Firebase project, and an Onyx database.

```sh
npm ci
cp .env.example .env.local
# Fill application Firebase settings and ONYX_CONFIG_PATH in .env.local.
# Shell commands need the same server environment; Next loads .env.local itself.
node --env-file=.env.local --import tsx scripts/schema.ts validate
node --env-file=.env.local --import tsx scripts/schema.ts diff
# Review the diff, then explicitly publish the additive application schema:
node --env-file=.env.local --import tsx scripts/schema.ts publish
npm run dev
```

Open http://127.0.0.1:3000. Enable Firebase Email/Password authentication and authorize your local/application domain. Use Application Default Credentials for Firebase Admin, or supply a base64 service-account JSON via `FIREBASE_SERVICE_ACCOUNT_BASE64`. The Firebase project must match the client project. Create an account, verify its email, sign in to open chat immediately. The authenticated chat-entry request creates a private personal workspace and conversation on first use; subsequent visits open an existing conversation. Use **New conversation** in navigation for a blank chat. There is no unverified-user or header-based auth bypass.

Reuse an **existing downloaded Onyx configuration** via `ONYX_CONFIG_PATH`; never put that configuration, API secret, Firebase Admin credentials, or binding files in a public variable or Git. Existing Onyx private-workspace/platform identity configuration remains an SDK concern. Application Firebase sign-in does not grant an Onyx platform identity, and its token is never forwarded as one.

`AI_MODE=disabled` is the default: history, workspace creation and uploads remain usable; generation explains the missing agent configuration. Configure live agents below, or explicitly enable local demo mode:

```dotenv
AI_MODE=demo
ALLOW_DEMO_AI=1
APP_ENV=development
```

Demo output is deterministic, visibly labeled and persisted with `mode: demo`. It uses the configured Onyx database for persistence. Select **Search knowledge** to exercise the application read tool; use the `[demo:error]` example prompt to test a saved error and Retry. Stop interrupts the local demo stream. There is **no automatic demo fallback**. Demo requires explicit non-production configuration; a production Node build requires `APP_ENV=preview` for an intentional test preview.

### Isolated browser preview without external credentials

```sh
npm run test:preview
```

Requires Java 21+ for the official Firebase Auth Emulator. Opens the production app on http://127.0.0.1:3235, Auth Emulator on 9199. Sign in as `owner@example.test` with `development-test-password`. The preview seeds verified emulator identities using Firebase Admin; normal Firebase sign-in and session verification still run. It starts an **explicit test-only Onyx HTTP transport** and local demo AI, with no live database or inference calls. Its in-memory storage is a test fixture and disappears on exit; application modules never select it as a fallback. Stop with Ctrl-C. Do not use emulator credentials in a real deployment.

## Live Onyx agents and built-in RAG

Onyx published agent IDs are accepted as the native chat request's `model`. The selector uses `db.ai.getModels()` and intersects that response with the server binding allowlist. Agents can generate read queries and search/index Onyx tables using Onyx's native facilities. There is no replacement RAG pipeline in this starter.

**Never give a data-aware agent the application's shared persistence key.** That database contains private messages for multiple users. A system prompt or client-supplied workspace ID is not an authorization boundary.

For each supported user/workspace:

1. Provision a **separate Onyx knowledge database**, containing only `KnowledgeArticle`, with rows for that exact owner UID and workspace ID. Keep conversations, credentials, memberships and attachments out of it. Apply the KnowledgeArticle definition from `api/onyx.schema.json` to that database through your normal schema process.
2. Publish a **read-only** Onyx agent constrained to that database and allowed table. Disable writes, scripts with side effects, external data access, cross-database access, and any unrestricted tools. Create a database-scoped read-only key. Review both the key and the published agent's actual permissions in your Onyx environment; a read-only application tool does not restrict an independently privileged agent.
3. Save its downloaded configuration in an ignored server directory. The JSON must provide explicit `baseUrl`, `aiBaseUrl`, `databaseId`, `apiKey` and `apiSecret`. Use trusted HTTPS URLs outside local tests. This avoids inheriting application credentials or accidentally choosing a different AI endpoint.
4. Copy `docs/ai-bindings.example.json` to ignored `config/ai-bindings.json`. Replace every value with the verified actor/workspace IDs, dedicated database ID, absolute config path, published agent allowlist, and a real permission-review reference. The example is documentation, not proof of an access policy.
5. Set `ONYX_AI_BINDINGS_PATH` and `AI_MODE=live`, then create a live conversation. Existing demo conversations retain their mode and cannot be continued using live generation.

The gate verifies identity and active membership, binding IDs, distinct persistence/agent databases, the single allowed table, every row's owner/workspace in a bounded scan (1,000 rows), and the key's available model IDs. Failure leaves history usable and generation disabled with setup guidance. **The SDK does not expose permission introspection**: `readOnlyPolicyReviewed` and `policyEvidence` record an operator's required review, not an automated proof. This starter deliberately does not probe writes to test a key. If your Onyx deployment cannot enforce that reviewed scope, leave live mode disabled. Larger deployments should replace the bounded scan with a proven provider-enforced tenant boundary and suitable permission introspection. Database administrators must preserve the scope when updating knowledge.

### Searchable tables and the application tool

`KnowledgeArticle` has `SEARCHABLE` title/body indexes with `searchSupport: BOTH`. The narrow `app_search_knowledge` tool accepts only `{ query }`. The server derives owner and workspace from verified membership, applies both filters to native Onyx table search, and checks every returned row again. It returns at most five article titles/IDs/excerpts; no arbitrary SQL, scripts or shell commands are exposed. Its results are visible in Tool activity. This tool searches the application database's scoped sample content; an agent's own RAG uses its separate scoped knowledge database.

`ONYX_SEARCH_MODE=lexical` is the default. `hybrid`/`semantic` require Onyx-side embeddings/index configuration. Publishing a SEARCHABLE index does **not** promise that existing rows were backfilled or that semantic search is configured. Use Onyx's supported table indexing/reindexing facilities for your environment, finish that operation, then enable semantic/hybrid mode. Uploading a document is not table indexing.

Optionally seed one example article for an existing verified Firebase user:

```sh
node --env-file=.env.local --conditions=react-server --import tsx scripts/seed.ts
```

Set `SEED_USER_UID` first. This creates the user's personal workspace if needed and inserts one deterministically identified onboarding article only when missing. Repeated runs preserve edits. It does not copy content to agent databases, mutate agent permissions, or publish an index.

## Architecture

| Location                  | Responsibility                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `app/`                    | Server-rendered pages and thin, authenticated Node Route Handlers                                          |
| `components/chat/`        | Responsive workspace shell, composer, `useChat`, file/rename/delete controls                               |
| `components/ai-elements/` | Adapted current AI Elements conversation/message patterns; Streamdown code highlighting and safe rendering |
| `modules/auth/`           | Firebase client sign-in and revoked-session-aware Firebase Admin verification                              |
| `modules/conversations/`  | Owner/membership authorization, conversations, bounded history and interruption recovery                   |
| `modules/generation/`     | Durable run orchestration, native Onyx chat, SSE normalization and UI protocol mapping                     |
| `modules/tools/`          | Explicitly authorized, allowlisted application read tool                                                   |
| `modules/attachments/`    | Content/size/type validation, document storage and context selection                                       |
| `lib/onyx/`               | Official SDK adapter; generated schema types plus Zod runtime boundaries                                   |
| `scripts/`                | Additive schema operations, idempotent seed, template identity and explicit lock recovery                  |

Client state never authorizes access or supplies trusted history. Each submission contains only validated IDs, current user text, selected agent, attachment IDs and a read-tool flag. The server reloads authorized history from Onyx. Shared persistence credentials remain server-only behind owner + active-membership checks. Workspace membership never grants access to another member's private conversations.

### Schema

`Workspace`, `Membership`, `Conversation`, `Message`, `GenerationRun`, `Attachment`, `MessageAttachment`, `ToolActivity`, `Source`, and `KnowledgeArticle` carry explicit IDs and scope fields. `MutationLock` provides insert-only exclusion around short mutations. Runs record `pending`, `streaming`, `completed`, `cancelled`, `interrupted` or `failed`, mode, attempt, selected/actual model, actual provider request ID and nullable actual usage. No fabricated billing or token counts.

`api/onyx.schema.json` is generated from `modules/models.ts` by `node --import tsx scripts/create-schema.ts`. Run `npm run schema:generate` after schema changes. The official generated interfaces are checked against the runtime row types; Zod validates records crossing the SDK boundary. Schema commands merge missing tables additively and reject incompatible existing attributes. Review schema diffs before publication; no automatic destructive migration runs on startup.

### Stream and retry contract

The native Onyx SDK yields chunks, not the AI SDK UI protocol. The server maps them into `createUIMessageStream` / `createUIMessageStreamResponse` chunks consumed by `useChat`:

- Stable assistant message IDs and text start/delta/end events.
- Tool input fragments, stable call IDs, validated arguments, provider-managed results, and durable activity records.
- Actual source URLs/document references when reported; actual usage fields remain null when absent.
- Real terminal finish/error/abort events. EOF, malformed JSON, output limits, unsupported finish reasons and missing terminal events cannot become successful completions.

A small fetch-response normalizer compensates for native SDK 2.8.4's SSE parser dropping named error frames and not handling CRLF consistently. It handles byte-fragmented UTF-8, CR/LF/CRLF and multiline data, bounds frame size, and adds a private sentinel before forwarding a real `[DONE]`. The native SDK still constructs, authenticates and performs every AI call. An error followed by DONE remains an error.

Onyx-managed tool results are displayed and **never executed a second time by this application**. Only the explicitly named application search tool is handled locally when no provider result exists. It supports at most three model steps and sixteen tool calls per step. Script/write approval requests preserve reported IDs/arguments but fail closed; there is no fake Approve button or write tool. Unsupported tools also fail closed.

A deterministic run ID claims `(conversation, requestId)`. Repeating the same submission replays saved terminal text or reports an already-active run; it does not call the provider twice. A new request UUID is an explicit new attempt. Retry reuses the original user message and attachments, keeps partial previous attempts, and reuses completed matching application-search outputs. It is **disabled after Onyx-managed tool activity**, because native server-side tool execution cannot be safely replayed or deduplicated by this app. Review results before making a new request. Distributed exactly-once provider execution is not claimed.

Partial text is checkpointed; the response deadline is 120 seconds and a run is recoverable as interrupted after 180 seconds. Refresh loads saved history, not a claimed resumable provider stream. A stopped process may lose text since the last checkpoint. A late worker cannot finalize an expired/replaced run. Stop persists a cancellation request, polls it across instances, cancels the native iterator and aborts upstream fetch. Cancellation does not reverse already completed Onyx tools, and transport abort does not guarantee a provider stopped remote work.

### Persistence failure and operator recovery

The SDK does not establish multi-record transactions/CAS for these operations. Short insert-only `MutationLock` records serialize cooperating writers. Known validation conflicts release the lock. Unknown storage failures retain it because an operation may have partially committed; there is no unsafe automatic TTL takeover.

Stop all application writers, inspect the lock and affected run/messages, repair partial records if needed, then release the **exact inspected lock**:

```sh
WRITERS_STOPPED=yes node --env-file=.env.local --conditions=react-server --import tsx scripts/recover-lock.ts 'conversation:THE-UUID'
```

If writes fail during finalization, the UI cannot promise a durable success; refresh after storage recovers. Expired runs are reconciled on snapshot/claim. A pending orphan created before its conversation pointer was saved requires operator inspection. For high concurrency, add a provider-supported transactional claim/compare-and-set primitive before expanding the model.

## Attachments and rendering

Uploads are at most **2 MiB each**, up to **four per request**, accepting UTF-8 text/Markdown, PDF, PNG or JPEG. Text is checked for encoding/NUL bytes; binary types require matching signatures. Names are sanitized. Every upload/download/context lookup checks owner, conversation and membership. Onyx stores the bytes and metadata; downloads are attachment-only with `nosniff`, a sandbox CSP and no shared cache.

Only **plain text and Markdown** are included as bounded, explicitly untrusted text excerpts (up to 12,000 characters per file). The current native SDK's chat content is a string and its model list has no binary capability contract. PDF/images are therefore **stored only**, with a visible UI label. There is no automatic OCR, extraction, embedding, indexing or claim that every byte reached the model. Add those capabilities only after verifying an official model/API contract and preserving access checks.

Streamdown renders Markdown and highlighted code with copy controls. Raw HTML is disabled; remote Markdown images are omitted and links permit only HTTP(S), use a new tab and have safe rel attributes. Tool results are React text. Conversation deletion is a soft delete that immediately revokes all application access to its history/files; operators must implement their own retention/purge policy, including orphan-document cleanup after uncertain writes.

## Verification

```sh
npm run check        # lint, strict types, formatting, Vitest, production build
npm run test:e2e     # isolated production preview; desktop + mobile Chromium
npm run schema:validate
npm audit --omit=dev
```

Unit tests exercise native SDK parsing against mocked HTTP bytes, generation idempotency, errors, cancellation, tool identity/approval handling, stale worker fencing, workspace/owner isolation and attachment rules. Browser tests use Firebase Auth Emulator and the test-only Onyx HTTP fixture for sign-in, persistence, sending/stopping/retrying, attachments, tool display, pagination, deletion, responsive navigation and accessibility. They **do not verify live Onyx inference, live RAG/indexing or production permissions**. A live acceptance test requires your scoped agent configuration; no real credentials or paid model calls are included.

## Adapt and deploy

Change semantic color variables in `app/globals.css` to retheme both modes. UI components stay local and editable. `npm run template:init -- --name 'Your App' --slug your-app` updates project/package identity; use the project name in your own copy.

Build/start with `npm run build` and `npm start` on any Node 24 host. Supply runtime server credentials and build-time `NEXT_PUBLIC_FIREBASE_*` settings. Set exact `APP_ORIGIN` (no trailing slash), `APP_ENV=production`, HTTPS, Firebase authorized domains and `AI_MODE=live` with reviewed bindings. Keep streaming/proxy buffering off and allow at least 150 seconds for chat requests. Do not host this as a static export or edge function. No hosting infrastructure is included.

Extension points: provider-supported tenant credentials, larger indexed knowledge sets, supported binary model inputs, application tools with independent authorization, retention cleanup, transactional claims and distributed rate limiting. None is replaced with an unrestricted script executor.

References: [Onyx TypeScript SDK](https://onyx.dev/documentation/sdk-reference/typescript), [Onyx AI API](https://onyx.dev/documentation/api-documentation/ai-endpoint), [AI SDK stream protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol), [AI Elements](https://ui.shadcn.com/docs/ai-elements), [Streamdown](https://streamdown.ai/docs). Component attribution is in [docs/ai-elements.md](docs/ai-elements.md).
