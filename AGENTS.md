# AI Starter engineering rules

Read README.md, modules/models.ts, and the affected module before editing. This is one Node.js Next.js modular monolith. Keep routes thin and application rules in modules. Components must not import privileged SDK instances. Do not add another database, backend, hosting adapter, or mandatory vector service.

- Use native Onyx SDK chat/agents, persistence and documents. Do not add a direct vendor AI provider. Inspect official documentation and installed types before changing streaming contracts.
- Verify Firebase sessions and active workspace membership server-side. Derive trusted owner/workspace IDs; never trust client histories, owner IDs or a confirmation dialog as authorization.
- Keep persistence and agent credentials separate. Data-aware agents need a verified, scoped database and reviewed read-only policies. Fail closed when scope cannot be established. No arbitrary script, SQL or shell tools.
- Preserve stable request/message/tool IDs, durable run states, partial checkpoints, actual provider metadata, duplicate suppression and late-worker fencing. Never interpret EOF or an error followed by DONE as success. Do not replay Onyx-managed tools.
- Keep demo mode explicit, marked in persistence and UI, and unavailable as a production fallback. Test fixtures stay under tests; no runtime auth bypass or memory-storage fallback.
- Validate all external bodies and SDK records with Zod. Bound history, output, tool arguments/results, files, requests and durations. Return safe errors without credentials or raw provider internals.
- Only forward attachment types supported by documented API/model capability. Upload does not imply extraction or indexing. Keep Markdown HTML disabled, URLs constrained and document downloads sandboxed.
- No unsafe lock takeover. Onyx multi-record transactions are not assumed. Unknown write failures require operator reconciliation with writers stopped.
- Strict TypeScript remains enabled. Keep filename comments after required directive prologues; no comments in JSON. Keep theme tokens semantic and both modes accessible. Preserve upstream component attribution.
- Run npm run check and relevant Playwright checks for integration changes. Distinguish mocked transport tests from live provider verification. Never commit credentials, downloaded configs or generated build/test outputs.
