// filename: e2e/chat.spec.ts
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function login(page: Page, email = "owner@example.test") {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("development-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/chat\/[a-f0-9-]+$/);
  await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
}
async function newChat(page: Page) {
  const previous = page.url();
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible())
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(page).not.toHaveURL(previous);
  await expect(page).toHaveURL(/\/chat\/[a-f0-9-]+$/);
  await expect(
    page.getByText("Local demo · simulated generation"),
  ).toBeVisible();
}
test("private conversation, streaming, reload, tool results, attachments, rename and delete", async ({
  page,
}, info) => {
  await login(page);
  await newChat(page);
  const path = new URL(page.url()).pathname;
  await page.getByLabel("Attach file", { exact: true }).setInputFiles({
    name: "context.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("A private onboarding note"),
  });
  await expect(page.getByLabel("Include context.txt")).toBeChecked();
  await page.getByLabel("Search knowledge", { exact: true }).check();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Help me plan a product launch");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Response completed · attempt 1")).toBeVisible();
  await expect(
    page.getByText("app_search_knowledge · Application read tool"),
  ).toBeVisible();
  await expect(
    page.getByText("Deterministic demo. No live AI calls.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Help me plan a product launch", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy message" }),
  ).toBeVisible();
  await page.getByLabel("Attach file", { exact: true }).setInputFiles({
    name: "stored.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7 fixture only"),
  });
  await expect(page.getByText("Stored only", { exact: true })).toBeVisible();
  const download = await page.request.get(
    "/api/attachments/" +
      (
        await page
          .getByRole("link", { name: "stored.pdf" })
          .getAttribute("href")
      )
        ?.split("/")
        .at(-1),
  );
  expect(download.ok()).toBeTruthy();
  expect(download.headers()["content-disposition"]).toContain("attachment");
  await page.getByRole("button", { name: "Rename conversation" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill(`Launch notes ${info.project.name}`);
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(
    page.getByRole("heading", {
      name: `Launch notes ${info.project.name}`,
      exact: true,
    }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({
    path: `test-results/chat-${info.project.name}.png`,
    fullPage: true,
  });
  const stranger = await page.context().browser()!.newContext();
  const other = await stranger.newPage();
  await login(other, "other@example.test");
  await other.goto(path);
  await expect(other.getByRole("status")).toContainText(
    "Conversation unavailable",
  );
  expect(
    (
      await other.request.get(`/api/conversations/${path.split("/").at(-1)}`)
    ).status(),
  ).toBe(404);
  await stranger.close();
  await page
    .getByRole("button", { name: "Delete conversation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete conversation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/chat\/[a-f0-9-]+$/);
  await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
  expect(
    (
      await page.request.get(`/api/conversations/${path.split("/").at(-1)}`)
    ).status(),
  ).toBe(404);
});
test("stop saves cancellation and an explicit retry recovers a demo error without another user turn", async ({
  page,
}) => {
  await login(page);
  await newChat(page);
  await page
    .getByLabel("Message", { exact: true })
    .fill("A long demonstration");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop response" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop response" }).click();
  await expect(page.getByText("Response cancelled · attempt 1")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Response cancelled · attempt 1")).toBeVisible();
  await page
    .getByLabel("Message", { exact: true })
    .fill("[demo:error] Show a recoverable error");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Response failed · attempt 1")).toBeVisible();
  await page
    .getByRole("button", { name: "Retry response", exact: true })
    .click();
  await expect(page.getByText("Response completed · attempt 2")).toBeVisible();
  await expect(
    page.getByText("[demo:error] Show a recoverable error", { exact: true }),
  ).toHaveCount(1);
});
test("conversation pagination, mobile navigation and light theme", async ({
  page,
}, info) => {
  await login(page);
  const origin = String(info.config.projects[0]?.use.baseURL);
  const wsResponse = await page.request.post("/api/workspaces", {
    headers: { Origin: origin },
    data: { name: "My workspace" },
  });
  expect(wsResponse.ok()).toBeTruthy();
  const ws = await wsResponse.json();
  for (let i = 0; i < 22; i++) {
    const r = await page.request.post("/api/conversations", {
      headers: { Origin: origin },
      data: { workspaceId: ws.id },
    });
    expect(r.ok()).toBeTruthy();
  }
  await page.goto("/chat");
  await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible())
    await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Conversations" }).getByRole("link"),
  ).toHaveCount(20);
  await page.getByRole("button", { name: "Load more conversations" }).click();
  await expect
    .poll(() =>
      page
        .getByRole("navigation", { name: "Conversations" })
        .getByRole("link")
        .count(),
    )
    .toBeGreaterThan(20);
  await page.getByRole("button", { name: "Use light theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "New conversation" }),
  ).toHaveCSS("background-color", "rgb(131, 80, 20)");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `test-results/light-${info.project.name}.png`,
    fullPage: true,
  });
});
