/**
 * Email notifications via Resend.
 * Free tier: 100 emails/day — more than enough for automation drafts.
 *
 * Set RESEND_API_KEY env var to enable. Without it, notifications are no-ops.
 */
export declare function notifyDraftsReady(email: string, count: number): Promise<void>;
