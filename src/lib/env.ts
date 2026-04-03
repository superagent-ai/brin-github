function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  get appId() {
    return required("APP_ID");
  },
  get privateKey() {
    return required("PRIVATE_KEY").replace(/\\n/g, "\n");
  },
  get webhookSecret() {
    return required("WEBHOOK_SECRET");
  },
  get brinApiBase() {
    return process.env.BRIN_API_BASE ?? "https://api.brin.sh";
  },
  get port() {
    return parseInt(process.env.PORT ?? "3000", 10);
  },
  get logLevel() {
    return process.env.LOG_LEVEL ?? "info";
  },
} as const;
