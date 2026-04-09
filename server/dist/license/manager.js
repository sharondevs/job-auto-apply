/**
 * License Manager for MCP Server (BYOM mode)
 *
 * BYOM is free and unlimited — no license check needed.
 * Managed mode uses the per-task credit system in api.ts instead.
 *
 * This file is kept for backwards compatibility (index.ts imports it)
 * but always returns "allowed".
 */
export async function checkAndIncrementUsage() {
    return { allowed: true, remaining: null, message: "BYOM — unlimited tasks" };
}
export function getLicenseStatus() {
    return { isPro: true, tasksUsed: 0, taskLimit: null, message: "BYOM — Free, unlimited" };
}
