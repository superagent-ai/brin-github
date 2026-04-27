import type { Octokit } from "octokit";
import type { LabelDef } from "../lib/types.js";

export async function ensureLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  labels: readonly LabelDef[],
): Promise<void> {
  for (const label of labels) {
    try {
      const { data: existing } = await octokit.rest.issues.getLabel({
        owner,
        repo,
        name: label.name,
      });
      if (
        existing.color !== label.color ||
        (existing.description ?? "") !== label.description
      ) {
        await octokit.rest.issues.updateLabel({
          owner,
          repo,
          name: label.name,
          color: label.color,
          description: label.description,
        });
      }
    } catch (err: unknown) {
      if (err && typeof err === "object" && "status" in err && err.status !== 404) throw err;
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name: label.name,
        color: label.color,
        description: label.description,
      });
    }
  }
}

export async function setLabel(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  nextLabel: string,
  brinLabelNames: readonly string[],
): Promise<void> {
  const { data: current } = await octokit.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const preserved = current
    .map((l) => l.name)
    .filter((name) => !brinLabelNames.includes(name));

  await octokit.rest.issues.setLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [...preserved, nextLabel],
  });
}

export async function clearLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  brinLabelNames: readonly string[],
): Promise<void> {
  const { data: current } = await octokit.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const preserved = current
    .map((l) => l.name)
    .filter((name) => !brinLabelNames.includes(name));

  await octokit.rest.issues.setLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: preserved,
  });
}
