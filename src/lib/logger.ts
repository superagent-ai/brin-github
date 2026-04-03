import pino from "pino";
import { env } from "./env.js";

export const logger = pino({ level: env.logLevel });

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
