// filename: lib/config.ts
import { z } from "zod";
import { ensure } from "./errors";
export function applicationEnvironment() {
  const value = z
    .enum(["development", "preview", "production"])
    .parse(
      process.env.APP_ENV ||
        (process.env.NODE_ENV === "production" ? "production" : "development"),
    );
  return process.env.NODE_ENV === "production" && value === "development"
    ? "production"
    : value;
}
export function aiMode() {
  const mode = z
    .enum(["disabled", "live", "demo"])
    .parse(process.env.AI_MODE || "disabled");
  if (mode === "demo")
    ensure(
      process.env.ALLOW_DEMO_AI === "1" &&
        applicationEnvironment() !== "production",
      503,
      "Demonstration AI requires explicit non-production configuration.",
    );
  return mode;
}
