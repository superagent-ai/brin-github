import type { Octokit } from "octokit";
import type { RepoConfig } from "../lib/types.js";
import { CHECK_NAMES, MARKERS, LABEL_DEFS } from "../lib/types.js";
import { scanPr } from "../lib/brinApi.js";
import { evaluatePrScan } from "../lib/policy.js";
import { createInProgressCheck, completeCheck } from "./checkRuns.js";
import {
  upsertComment,
  deleteMarkerComment,
  renderPrScanComment,
} from "./comments.js";
import { clearLabels, ensureLabels, setLabel } from "./labels.js";
import { childLogger } from "../lib/logger.js";

const PR_LABELS = [LABEL_DEFS.PR_VERIFIED, LABEL_DEFS.PR_FLAGGED];
const PR_LABEL_NAMES = PR_LABELS.map((l) => l.name);

async function getGitHubToken(octokit: Octokit): Promise<string | undefined> {
  const auth = await octokit.auth({ type: "installation" });
  if (auth && typeof auth === "object" && "token" in auth && typeof auth.token === "string") {
    return auth.token;
  }
  return undefined;
}

export async function runPrScan(
  octokit: Octokit,
  params: {
    owner: string;
    repo: string;
    prNumber: number;
    headSha: string;
    config: RepoConfig;
  },
): Promise<void> {
  const { owner, repo, prNumber, headSha, config } = params;
  const log = childLogger({ service: "pr-scan", owner, repo, pr: prNumber });

  if (!config.prScan.enabled) {
    log.info("PR scan disabled by repo config");
    return;
  }

  const checkRunId = await createInProgressCheck(
    octokit,
    owner,
    repo,
    headSha,
    CHECK_NAMES.PR_SCAN,
  );

  const githubToken = await getGitHubToken(octokit);
  const result = await scanPr(owner, repo, prNumber, {
    tolerance: config.prScan.tolerance,
    githubToken,
  });
  const { status, shouldFail } = evaluatePrScan(result, config);

  log.info(
    { score: result.score, verdict: result.verdict, status, shouldFail },
    "PR scan evaluated",
  );

  await ensureLabels(octokit, owner, repo, PR_LABELS);

  switch (status) {
    case "blocking": {
      await completeCheck(octokit, owner, repo, checkRunId, "failure", {
        title: `PR flagged as ${result.verdict}`,
        summary: `Score: ${result.score}/100 \u00b7 Verdict: ${result.verdict}`,
      });
      await setLabel(octokit, owner, repo, prNumber, LABEL_DEFS.PR_FLAGGED.name, PR_LABEL_NAMES);
      const body = renderPrScanComment(status, result);
      await upsertComment(octokit, owner, repo, prNumber, MARKERS.PR_SCAN, body);
      break;
    }

    case "review": {
      await completeCheck(octokit, owner, repo, checkRunId, "neutral", {
        title: "PR requires review",
        summary: `Score: ${result.score}/100 \u00b7 Verdict: ${result.verdict}`,
      });
      await setLabel(octokit, owner, repo, prNumber, LABEL_DEFS.PR_FLAGGED.name, PR_LABEL_NAMES);
      const body = renderPrScanComment(status, result);
      await upsertComment(octokit, owner, repo, prNumber, MARKERS.PR_SCAN, body);
      break;
    }

    case "clean": {
      await completeCheck(octokit, owner, repo, checkRunId, "success", {
        title: "PR scan passed",
        summary: `Score: ${result.score}/100 \u00b7 Verdict: ${result.verdict}`,
      });
      await setLabel(octokit, owner, repo, prNumber, LABEL_DEFS.PR_VERIFIED.name, PR_LABEL_NAMES);
      await deleteMarkerComment(octokit, owner, repo, prNumber, MARKERS.PR_SCAN);
      break;
    }

    case "inconclusive": {
      await completeCheck(octokit, owner, repo, checkRunId, "neutral", {
        title: "Scan pending",
        summary: result.pending_deep_scan
          ? "A deep scan is in progress. Results will update automatically."
          : "Unable to determine scan results at this time.",
      });
      await clearLabels(octokit, owner, repo, prNumber, PR_LABEL_NAMES);
      await deleteMarkerComment(octokit, owner, repo, prNumber, MARKERS.PR_SCAN);
      break;
    }
  }
}
