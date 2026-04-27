import { env } from "./env.js";
import { childLogger } from "./logger.js";
import type { PrScanResult, ContributorResult } from "./types.js";

export async function scanPr(
  owner: string,
  repo: string,
  prNumber: number,
  options: { tolerance?: string; githubToken?: string } = {},
): Promise<PrScanResult> {
  const tolerance = options.tolerance ?? "conservative";
  const url = `${env.brinApiBase}/pr/${owner}/${repo}/${prNumber}?details=true&mode=full&tolerance=${tolerance}`;
  const log = childLogger({ service: "brin-api", endpoint: "pr", owner, repo, prNumber });
  const headers = options.githubToken
    ? { "x-github-token": options.githubToken }
    : undefined;

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(300_000),
    });
    if (!res.ok) {
      log.warn({ status: res.status }, "Brin PR API returned non-OK status");
      return {};
    }
    const data = (await res.json()) as PrScanResult;
    log.info({ score: data.score, verdict: data.verdict, pending: data.pending_deep_scan }, "PR scan response");
    return data;
  } catch (err) {
    log.error({ err }, "Brin PR API request failed");
    return {};
  }
}

export async function scanContributor(
  login: string,
  options: { githubToken?: string } = {},
): Promise<ContributorResult> {
  const url = `${env.brinApiBase}/contributor/${login}?details=true&mode=full`;
  const log = childLogger({ service: "brin-api", endpoint: "contributor", login });
  const headers = options.githubToken
    ? { "x-github-token": options.githubToken }
    : undefined;

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      log.warn({ status: res.status }, "Brin contributor API returned non-OK status");
      return {};
    }
    const data = (await res.json()) as ContributorResult;
    log.info({ score: data.score, verdict: data.verdict }, "Contributor scan response");
    return data;
  } catch (err) {
    log.error({ err }, "Brin contributor API request failed");
    return {};
  }
}
