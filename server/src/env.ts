/**
 * Centralised environment configuration for the server.
 *
 * Required variables: DATABASE_URL, PORT, LINKDROP_ADMIN_TOKEN.
 *
 * `LINKDROP_ADMIN_TOKEN` is validated at startup (see `assertAdminTokenPresent`,
 * invoked from src/index.ts before the server binds to a port): if it is
 * missing, the process logs an error and exits with code 1 (LAR-22).
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

/**
 * Verifies that LINKDROP_ADMIN_TOKEN is set. If it is not, logs
 * "LINKDROP_ADMIN_TOKEN not set" and exits the process with code 1.
 *
 * Kept separate from module load (rather than run automatically when this
 * module is imported) so it can be called explicitly and deterministically
 * from src/index.ts before the server binds to a port, and so it can be
 * unit tested with injected `exit`/`log` implementations.
 */
export function assertAdminTokenPresent(
  candidate: Pick<Env, "LINKDROP_ADMIN_TOKEN"> = env,
  exit: (code: number) => void = process.exit.bind(process),
  log: (message: string) => void = (message) => {
    // eslint-disable-next-line no-console
    console.error(message);
  }
): void {
  if (!candidate.LINKDROP_ADMIN_TOKEN) {
    log("LINKDROP_ADMIN_TOKEN not set");
    exit(1);
  }
}
