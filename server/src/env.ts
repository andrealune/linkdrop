/**
 * Centralised environment configuration for the server.
 *
 * Required variables: DATABASE_URL, PORT, LINKDROP_ADMIN_TOKEN.
 *
 * NOTE: strict "exit with a specific message when a variable is missing"
 * behaviour is implemented as part of LAR-22. This module currently reads
 * the variables and applies sane parsing, and throws a descriptive error
 * if a value is present but invalid (e.g. a non-numeric PORT).
 */
import "dotenv/config";

export interface Env {
  DATABASE_URL: string | undefined;
  PORT: number;
  LINKDROP_ADMIN_TOKEN: string | undefined;
}

function parsePort(value: string | undefined): number {
  if (!value) return 3001;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value: "${value}". Expected a positive integer.`);
  }
  return parsed;
}

export const env: Env = {
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: parsePort(process.env.PORT),
  LINKDROP_ADMIN_TOKEN: process.env.LINKDROP_ADMIN_TOKEN
};
