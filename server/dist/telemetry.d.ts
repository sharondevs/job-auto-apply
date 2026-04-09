/**
 * Anonymous telemetry for local MCP users.
 *
 * Collects error reports and usage stats to improve Hanzi.
 * Opt out: `hanzi-browse telemetry off` or set DO_NOT_TRACK=1
 *
 * Never sends: task content, URLs, API keys, file paths, PII.
 */
export declare function isTelemetryEnabled(): boolean;
export declare function setTelemetryEnabled(value: boolean): void;
export declare function initTelemetry(): void;
export declare function trackEvent(name: string, properties?: Record<string, any>): void;
export declare function captureException(error: Error, context?: Record<string, string>): void;
export declare function shutdownTelemetry(): Promise<void>;
