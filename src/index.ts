import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { app as githubApp } from "./app.js";
import { registerEventHandlers } from "./events/index.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { queries } from "./lib/db.js";

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

server.post("/api/github/marketplace", async (c) => {
  const signature = c.req.header("x-hub-signature-256") ?? "";
  const body = await c.req.text();

  if (env.marketplaceWebhookSecret) {
    const expected =
      "sha256=" +
      createHmac("sha256", env.marketplaceWebhookSecret)
        .update(body)
        .digest("hex");
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      logger.warn("Invalid Marketplace webhook signature");
      return c.json({ error: "invalid_signature" }, 400);
    }
  }

  const event = JSON.parse(body);
  logger.info(
    {
      action: event.action,
      marketplace_purchase: {
        plan: event.marketplace_purchase?.plan?.name,
        account: event.marketplace_purchase?.account?.login,
      },
      sender: event.sender?.login,
    },
    "Marketplace event received",
  );

  return c.json({ ok: true });
});

server.get("/api/installations", (c) => {
  const all = c.req.query("all") === "true";
  const rows = all
    ? queries.getAllInstallations.all()
    : queries.getActiveInstallations.all();
  const stats = queries.getStats.get() as Record<string, number>;

  const installations = (rows as any[]).map((r) => ({
    ...r,
    repos: r.repos ? r.repos.split(",") : [],
    active: !!r.active,
  }));

  return c.json({ stats, installations });
});

server.get("/health", (c) => c.json({ status: "ok" }));

serve({ fetch: server.fetch, port: env.port }, () => {
  logger.info({ port: env.port }, "Brin GitHub App listening");
});
