import type { Octokit } from "octokit";
import { CHECK_NAMES } from "../lib/types.js";
import { loadConfig } from "../services/config.js";
import { runPrScan } from "../services/prScan.js";
import { runContributorTrust } from "../services/contributorTrust.js";
import { childLogger } from "../lib/logger.js";

export async function handleCheckRunRerequested({
  octokit,
  payload,
}: {
  octokit: Octokit;
  payload: Record<string, any>;
}) {
  const owner = payload.repository.owner.login as string;
  const repo = payload.repository.name as string;
  const checkRun = payload.check_run;
  const log = childLogger({
    event: "check_run.rerequested",
    owner,
    repo,
    checkName: checkRun.name,
  });

  const pr = checkRun.pull_requests?.[0];
  if (!pr) {
    log.warn("No pull request associated with re-requested check run");
    return;
  }

  log.info({ pr: pr.number }, "Re-running check");

  const config = await loadConfig(octokit, owner, repo);

  if (checkRun.name === CHECK_NAMES.PR_SCAN) {
    await runPrScan(octokit, {
      owner,
      repo,
      prNumber: pr.number,
      headSha: checkRun.head_sha,
      config,
    });
  } else if (checkRun.name === CHECK_NAMES.CONTRIBUTOR_TRUST) {
    const { data: fullPr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pr.number,
    });
    await runContributorTrust(octokit, {
      owner,
      repo,
      prNumber: pr.number,
      headSha: checkRun.head_sha,
      authorLogin: fullPr.user?.login ?? "",
      config,
    });
  }
}
