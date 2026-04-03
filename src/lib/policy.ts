import type { PrScanResult, ContributorResult, RepoConfig, PrStatus } from "./types.js";

export function evaluatePrScan(
  result: PrScanResult,
  config: RepoConfig,
): { status: PrStatus; shouldFail: boolean } {
  if (result.score == null) {
    return { status: "inconclusive", shouldFail: false };
  }
  if (result.pending_deep_scan) {
    return { status: "inconclusive", shouldFail: false };
  }

  const blockBelow = config.prScan.blockBelowScore;

  if (result.verdict === "dangerous" || result.score < blockBelow) {
    return { status: "blocking", shouldFail: true };
  }
  if (config.prScan.suspiciousVerdicts.includes(result.verdict ?? "")) {
    return { status: "review", shouldFail: false };
  }
  return { status: "clean", shouldFail: false };
}

export function evaluateContributor(
  result: ContributorResult,
  config: RepoConfig,
): { isSafe: boolean } {
  if (result.score == null) {
    return { isSafe: true };
  }
  return { isSafe: config.contributorTrust.safeVerdicts.includes(result.verdict ?? "") };
}
