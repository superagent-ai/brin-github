import type { Octokit } from "octokit";
import { loadConfig } from "../services/config.js";
import { runPrScan } from "../services/prScan.js";
import { runContributorTrust } from "../services/contributorTrust.js";
import { childLogger } from "../lib/logger.js";

const HANDLED_ACTIONS = new Set([
  "opened",
  "reopened",
  "synchronize",
  "ready_for_review",
]);

export async function handlePullRequest({
  octokit,
  payload,
}: {
  octokit: Octokit;
  payload: Record<string, any>;
}) {
  const action = payload.action as string;
  if (!HANDLED_ACTIONS.has(action)) return;

  const owner = payload.repository.owner.login as string;
  const repo = payload.repository.name as string;
  const pr = payload.pull_request;
  const log = childLogger({
    event: "pull_request",
    action,
    owner,
    repo,
    pr: pr.number,
  });

  if (pr.draft && action !== "ready_for_review") {
    log.info("Skipping draft PR");
    return;
  }

  log.info("Processing PR event");

  const config = await loadConfig(octokit, owner, repo);

  const results = await Promise.allSettled([
    runPrScan(octokit, {
      owner,
      repo,
      prNumber: pr.number,
      headSha: pr.head.sha,
      config,
    }),
    runContributorTrust(octokit, {
      owner,
      repo,
      prNumber: pr.number,
      headSha: pr.head.sha,
      authorLogin: pr.user.login,
      config,
    }),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      log.error({ err: r.reason }, "Scan failed");
    }
  }
}
