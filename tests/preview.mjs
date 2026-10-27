// filename: tests/preview.mjs
// Explicit fixture orchestration only. No application code selects this transport.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "ai-test-"));
const port = Number(process.env.E2E_PORT || 3235),
  origin = `http://127.0.0.1:${port}`;
const documents = new Map();
const tables = new Map();
const table = (name) => {
  if (!tables.has(name)) tables.set(name, new Map());
  return tables.get(name);
};
// Scoped sample knowledge belongs only to the explicit test transport.
for (const ownerUid of ["owner-test", "other-test"]) {
  const hash = createHash("sha256")
    .update(`personal-workspace:${ownerUid}`)
    .digest("hex");
  const workspaceId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const id = `knowledge-${ownerUid}`;
  table("KnowledgeArticle").set(id, {
    id,
    workspaceId,
    ownerUid,
    title:
      ownerUid === "owner-test"
        ? "A simple onboarding checklist"
        : "Private other-user onboarding",
    body: "Define one customer problem. Keep the first workflow small. Review access before adding a data source.",
    createdAt: new Date().toISOString(),
  });
}
function matches(row, c) {
  if (!c || !Object.keys(c).length) return true;
  if (c.condition) return matches(row, c.condition);
  if (c.conditions)
    return c.operator === "OR"
      ? c.conditions.some((child) => matches(row, child))
      : c.conditions.every((child) => matches(row, child));
  const condition = c.criteria || c;
  if (condition.operator === "SEARCH")
    return (row.title + " " + row.body)
      .toLowerCase()
      .includes(
        String(
          condition.value.queryText || condition.value.text || "onboarding",
        ).toLowerCase(),
      );
  if (condition.operator !== "EQUAL")
    throw new Error("Unsupported fixture condition");
  return row[condition.field] === condition.value;
}
const transport = createServer(async (request, response) => {
  const send = (status, value) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(value));
  };
  try {
    if (
      request.headers["x-onyx-key"] !== "fixture-key" ||
      request.headers["x-onyx-secret"] !== "fixture-secret"
    )
      return send(401, {});
    const url = new URL(request.url, "http://fixture"),
      parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent),
      chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString())
      : {};
    if (
      parts[0] === "data" &&
      parts[1] === "fixture" &&
      parts[2] === "document"
    ) {
      const id = parts[3] || body.documentId;
      if (request.method === "PUT") {
        documents.set(id, body);
        return send(200, body);
      }
      if (request.method === "GET")
        return send(documents.has(id) ? 200 : 404, documents.get(id) || {});
      if (request.method === "DELETE") {
        documents.delete(id);
        return send(200, true);
      }
    }
    if (parts[0] !== "data" || parts[1] !== "fixture") return send(404, {});
    if (parts[2] === "query") {
      const update = parts[3] === "update",
        remove = parts[3] === "delete",
        name = parts[update || remove ? 4 : 3],
        rows = table(name);
      const found = [...rows.values()]
        .filter((row) => matches(row, body.conditions))
        .sort((a, b) => a.id.localeCompare(b.id));
      if (update) {
        for (const row of found) rows.set(row.id, { ...row, ...body.updates });
        return send(200, found.length);
      }
      if (remove) {
        for (const row of found) rows.delete(row.id);
        return send(200, found.length);
      }

      const start = Number(url.searchParams.get("nextPage") || 0),
        size = Number(url.searchParams.get("pageSize") || 100);
      return send(200, {
        records: found.slice(start, start + size),
        ...(start + size < found.length
          ? { nextPage: String(start + size) }
          : {}),
      });
    }
    const rows = table(parts[2]),
      id = parts[3] || body.id;
    if (request.method === "GET")
      return send(rows.has(id) ? 200 : 404, rows.get(id) || {});
    if (request.method === "POST") {
      if (rows.has(id)) return send(409, { message: "Duplicate" });
      rows.set(id, body);
      return send(201, body);
    }
    if (request.method === "DELETE") {
      rows.delete(id);
      return send(200, true);
    }
    return send(404, {});
  } catch {
    return send(500, { message: "Test transport error" });
  }
});
await new Promise((resolve, reject) => {
  transport.once("error", reject);
  transport.listen(0, "127.0.0.1", resolve);
});
const config = join(directory, "onyx-database.json");
await writeFile(
  config,
  JSON.stringify({
    baseUrl: `http://127.0.0.1:${transport.address().port}`,
    databaseId: "fixture",
    apiKey: "fixture-key",
    apiSecret: "fixture-secret",
  }),
);
const env = { ...process.env };
for (const key of Object.keys(env))
  if (
    key.startsWith("ONYX_") ||
    key.startsWith("STRIPE_") ||
    key.startsWith("SMTP_") ||
    key.startsWith("FIREBASE_") ||
    key.startsWith("NEXT_PUBLIC_FIREBASE_")
  )
    delete env[key];
Object.assign(env, {
  APP_ENV: "preview",
  APP_ORIGIN: origin,
  AI_MODE: "demo",
  ALLOW_DEMO_AI: "1",
  ONYX_CONFIG_PATH: config,
  ONYX_DATABASE_ID: "fixture",
  FIREBASE_PROJECT_ID: "demo-ai-starter",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9199",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-ai-starter",
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-ai-starter.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9199",
});
const log = await open(join(directory, "firebase.log"), "w");
const emulator = spawn(
  process.execPath,
  [
    join(root, "node_modules/firebase-tools/lib/bin/firebase.js"),
    "emulators:start",
    "--only",
    "auth",
    "--project",
    "demo-ai-starter",
    "--config",
    join(root, "tests/emulators/firebase.json"),
  ],
  { cwd: directory, env, stdio: ["ignore", log.fd, log.fd] },
);
const children = [emulator];
let stopping = false;
async function cleanup(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 10000);
  timer.unref();
  await Promise.all(
    children.map((child) =>
      child.exitCode !== null || child.signalCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => child.once("exit", resolve)),
    ),
  );
  clearTimeout(timer);
  transport.closeAllConnections();
  await new Promise((resolve) => transport.close(resolve));
  await log.close();
  await rm(directory, { recursive: true, force: true });
  process.exit(code);
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => void cleanup(0));
try {
  let ready = false;
  for (let attempt = 0; attempt < 300; attempt++) {
    if (emulator.exitCode !== null)
      throw new Error(
        "Firebase emulator exited; inspect the local Firebase CLI setup.",
      );
    try {
      const r = await fetch(
        "http://127.0.0.1:9199/emulator/v1/projects/demo-ai-starter/config",
      );
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error("Firebase Auth Emulator did not start.");
  // The Admin SDK creates real emulator identities. No trusted identity headers,
  // hardcoded session cookies, or test-auth bypass exists in the application.
  const seed = spawnSync(
    process.execPath,
    ["--import", "tsx", join(root, "tests/fixture/users.ts")],
    { cwd: root, env, stdio: "inherit" },
  );
  if (seed.status !== 0) throw new Error("Emulator identity setup failed");
  const build = spawnSync(
    process.execPath,
    [join(root, "node_modules/next/dist/bin/next"), "build"],
    { cwd: root, env, stdio: "inherit" },
  );
  if (build.status !== 0) throw new Error("Fixture production build failed");
  const app = spawn(
    process.execPath,
    [
      join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: root, env, stdio: "inherit" },
  );
  children.push(app);
  app.once("error", () => void cleanup(1));
  app.once("exit", (code) => void cleanup(code || 0));
  console.log(
    `Explicit test preview ${origin}: Firebase Auth Emulator + test-only Onyx HTTP transport. No live database or AI requests. Demo AI is explicitly enabled.`,
  );
} catch (error) {
  console.error(error.message);
  const { readFile } = await import("node:fs/promises");
  console.error(
    (await readFile(join(directory, "firebase.log"), "utf8")).slice(-4000),
  );
  await cleanup(1);
}
