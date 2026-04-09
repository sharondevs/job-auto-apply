/**
 * Scheduler for automated browser tasks
 *
 * Checks every 60 seconds for automations whose next_run_at has passed.
 * Runs scout tasks via the existing agent loop infrastructure.
 */
declare let runTaskFn: (params: {
    workspaceId: string;
    browserSessionId: string;
    task: string;
    url?: string;
}) => Promise<{
    taskId: string;
    answer?: string;
    status: string;
}>;
export declare function initScheduler(deps: {
    store: typeof import("./store-pg.js");
    runTask: typeof runTaskFn;
    isSessionConnected: (id: string) => boolean;
    notify?: (email: string, count: number) => Promise<void>;
}): void;
export declare function startScheduler(): void;
export declare function stopScheduler(): void;
interface ParsedDraft {
    tweetUrl: string;
    tweetText?: string;
    tweetAuthorHandle?: string;
    tweetAuthorName?: string;
    tweetAuthorBio?: string;
    tweetAuthorFollowers?: number;
    tweetEngagement?: Record<string, any>;
    tweetAgeHours?: number;
    replyText: string;
    replyType?: "A" | "B" | "C";
    replyReasoning?: string;
    score?: number;
}
export declare function parseScoutAnswer(answer: string): ParsedDraft[] | null;
export declare function computeNextRun(cronExpr: string, timezone?: string): Date | null;
export declare function buildPostPrompt(tweetUrl: string, replyText: string): string;
export {};
