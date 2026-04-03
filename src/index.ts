import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { app as githubApp } from "./app.js";
import { registerEventHandlers } from "./events/index.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";

registerEventHandlers(githubApp);

const server = new Hono();

server.post("/api/github/webhook", async (c) => {
  const id = c.req.header("x-github-delivery") ?? "";
  const name = c.req.header("x-github-event") ?? "";
  const signature = c.req.header("x-hub-signature-256") ?? "";
  const body = await c.req.text();

  try {
    await githubApp.webhooks.verifyAndReceive({
      id,
      name: name as any,
      signature,
      payload: body,
    });
    return c.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("signature")) {
      logger.warn({ deliveryId: id }, "Invalid webhook signature");
      return c.json({ error: "invalid_signature" }, 400);
    }
    logger.error({ err, deliveryId: id }, "Webhook processing error");
    return c.json({ error: "processing_error" }, 500);
  }
});

server.get("/health", (c) => c.json({ status: "ok" }));

serve({ fetch: server.fetch, port: env.port }, () => {
  logger.info({ port: env.port }, "Brin GitHub App listening");
});
