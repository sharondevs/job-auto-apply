/**
 * Telemetry for the managed backend (api.hanzilla.co).
 * Gated by SENTRY_DSN and POSTHOG_API_KEY env vars — no-op in dev.
 */
export declare function initManagedTelemetry(): void;
export declare function trackManagedEvent(name: string, workspaceId: string, properties?: Record<string, any>): void;
export declare function captureManagedError(error: Error, context?: Record<string, string>): void;
export declare function shutdownManagedTelemetry(): Promise<void>;
