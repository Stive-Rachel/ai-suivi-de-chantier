// ─── Sentry (optional) ──────────────────────────────────────────────────────
// @sentry/react is optional. If not installed or DSN not set, everything no-ops.

let SentryModule: typeof import("@sentry/react") | null = null;

export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  try {
    SentryModule = await import("@sentry/react");
    SentryModule.init({
      dsn,
      environment: import.meta.env.MODE,
      enabled: import.meta.env.PROD,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    });
  } catch {
    console.warn("[Sentry] @sentry/react not available, error tracking disabled");
  }
}

export function getSentry() {
  return SentryModule;
}
