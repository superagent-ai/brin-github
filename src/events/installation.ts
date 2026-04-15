import { childLogger } from "../lib/logger.js";
import { saveInstallation, removeInstallation } from "../lib/db.js";

export async function handleInstallationCreated({
  payload,
}: {
  payload: Record<string, any>;
}) {
  const log = childLogger({
    event: "installation.created",
    installationId: payload.installation.id,
    account: payload.installation.account.login,
  });

  const repos = (payload.repositories ?? []).map((r: any) => ({
    name: r.name,
    full_name: r.full_name,
    private: r.private,
  }));

  saveInstallation(payload.installation, repos);

  log.info(
    { repoCount: repos.length, repos: repos.map((r: any) => r.full_name) },
    "New installation created",
  );
}

export async function handleInstallationDeleted({
  payload,
}: {
  payload: Record<string, any>;
}) {
  const log = childLogger({
    event: "installation.deleted",
    installationId: payload.installation.id,
    account: payload.installation.account.login,
  });

  removeInstallation(payload.installation.id);

  log.info("Installation removed");
}
