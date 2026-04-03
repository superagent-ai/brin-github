import { App } from "octokit";
import { env } from "./lib/env.js";

export const app = new App({
  appId: env.appId,
  privateKey: env.privateKey,
  webhooks: { secret: env.webhookSecret },
});
