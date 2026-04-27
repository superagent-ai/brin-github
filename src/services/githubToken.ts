import type { Octokit } from "octokit";

export async function getGitHubToken(octokit: Octokit): Promise<string | undefined> {
  const auth = await octokit.auth({ type: "installation" });
  if (auth && typeof auth === "object" && "token" in auth && typeof auth.token === "string") {
    return auth.token;
  }
  return undefined;
}
