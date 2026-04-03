import { childLogger } from "../lib/logger.js";

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

  const repoCount = payload.repositories?.length ?? 0;
  log.info({ repoCount }, "New installation created");
}
