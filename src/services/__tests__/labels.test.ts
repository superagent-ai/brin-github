import { describe, it, expect, vi } from "vitest";
import { clearLabels, ensureLabels, setLabel } from "../labels.js";

function mockOctokit(overrides: Record<string, any> = {}) {
  return {
    rest: {
      issues: {
        getLabel: vi.fn(),
        createLabel: vi.fn(),
        updateLabel: vi.fn(),
        listLabelsOnIssue: vi.fn(),
        setLabels: vi.fn(),
        ...overrides,
      },
    },
  } as any;
}

describe("ensureLabels", () => {
  const labels = [
    { name: "pr:verified", color: "0969da", description: "PR passed." },
  ];

  it("creates label when it does not exist", async () => {
    const octokit = mockOctokit({
      getLabel: vi.fn().mockRejectedValue({ status: 404 }),
    });

    await ensureLabels(octokit, "owner", "repo", labels);

    expect(octokit.rest.issues.createLabel).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      name: "pr:verified",
      color: "0969da",
      description: "PR passed.",
    });
  });

  it("updates label when color differs", async () => {
    const octokit = mockOctokit({
      getLabel: vi.fn().mockResolvedValue({
        data: { color: "ffffff", description: "PR passed." },
      }),
    });

    await ensureLabels(octokit, "owner", "repo", labels);

    expect(octokit.rest.issues.updateLabel).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      name: "pr:verified",
      color: "0969da",
      description: "PR passed.",
    });
  });

  it("skips update when label matches", async () => {
    const octokit = mockOctokit({
      getLabel: vi.fn().mockResolvedValue({
        data: { color: "0969da", description: "PR passed." },
      }),
    });

    await ensureLabels(octokit, "owner", "repo", labels);

    expect(octokit.rest.issues.updateLabel).not.toHaveBeenCalled();
    expect(octokit.rest.issues.createLabel).not.toHaveBeenCalled();
  });

  it("rethrows non-404 errors", async () => {
    const octokit = mockOctokit({
      getLabel: vi.fn().mockRejectedValue({ status: 500 }),
    });

    await expect(ensureLabels(octokit, "owner", "repo", labels)).rejects.toEqual({
      status: 500,
    });
  });
});

describe("setLabel", () => {
  it("preserves non-brin labels and sets the new one", async () => {
    const octokit = mockOctokit({
      listLabelsOnIssue: vi.fn().mockResolvedValue({
        data: [
          { name: "bug" },
          { name: "pr:flagged" },
          { name: "enhancement" },
        ],
      }),
    });

    await setLabel(octokit, "owner", "repo", 42, "pr:verified", [
      "pr:verified",
      "pr:flagged",
    ]);

    expect(octokit.rest.issues.setLabels).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      issue_number: 42,
      labels: ["bug", "enhancement", "pr:verified"],
    });
  });

  it("works when no existing labels", async () => {
    const octokit = mockOctokit({
      listLabelsOnIssue: vi.fn().mockResolvedValue({ data: [] }),
    });

    await setLabel(octokit, "owner", "repo", 1, "contributor:verified", [
      "contributor:verified",
      "contributor:flagged",
    ]);

    expect(octokit.rest.issues.setLabels).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      issue_number: 1,
      labels: ["contributor:verified"],
    });
  });
});

describe("clearLabels", () => {
  it("removes brin labels and preserves unrelated labels", async () => {
    const octokit = mockOctokit({
      listLabelsOnIssue: vi.fn().mockResolvedValue({
        data: [
          { name: "bug" },
          { name: "pr:flagged" },
          { name: "enhancement" },
        ],
      }),
    });

    await clearLabels(octokit, "owner", "repo", 42, [
      "pr:verified",
      "pr:flagged",
    ]);

    expect(octokit.rest.issues.setLabels).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      issue_number: 42,
      labels: ["bug", "enhancement"],
    });
  });
});
