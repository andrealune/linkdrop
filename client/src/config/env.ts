/**
 * Centralised access to build-time environment configuration.
 *
 * Vite only exposes variables prefixed with `VITE_` to client code, and it
 * inlines them at build time via `import.meta.env`. Reading them through
 * this module (instead of `import.meta.env` directly) keeps the rest of the
 * app decoupled from Vite specifics and gives us one place to validate
 * required configuration.
 */

function readApiUrl(): string {
  const value = import.meta.env.VITE_API_URL

  if (!value) {
    // Fail loudly in development rather than silently calling the wrong
    // host. In production this should always be set via the environment.
    // eslint-disable-next-line no-console
    console.warn(
      '[config] VITE_API_URL is not set. Falling back to "http://localhost:3001". ' +
        'Set VITE_API_URL in a .env file (see .env.example) to point at the API.',
    )
    return 'http://localhost:3001'
  }

  return value.replace(/\/+$/, '')
}

export const env = {
  apiUrl: readApiUrl(),
} as const
