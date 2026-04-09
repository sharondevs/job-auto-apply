/**
 * Scheduler for automated browser tasks
 *
 * Checks every 60 seconds for automations whose next_run_at has passed.
 * Runs scout tasks via the existing agent loop infrastructure.
 */
import { CronExpressionParser } from "cron-parser";
// These are injected via initScheduler() to avoid circular deps
let S;
let runTaskFn;
let isSessionConnectedFn;
let notifyFn = null;
let schedulerInterval = null;
const MAX_CONSECUTIVE_FAILURES = 3;
// ── Init ──────────────────────────────────────────────────────────────
export function initScheduler(deps) {
    S = deps.store;
    runTaskFn = deps.runTask;
    isSessionConnectedFn = deps.isSessionConnected;
    notifyFn = deps.notify || null;
}
export function startScheduler() {
    if (schedulerInterval)
        return;
    schedulerInterval = setInterval(tick, 60_000);
    console.error("[Scheduler] Started — checking every 60s");
}
export function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
}
// ── Tick ──────────────────────────────────────────────────────────────
async function tick() {
    try {
        const due = await S.getDueAutomations();
        for (const auto of due) {
            try {
                await runScoutTask(auto);
            }
            catch (err) {
                console.error(`[Scheduler] Error running automation ${auto.id}:`, err.message);
            }
        }
    }
    catch (err) {
        console.error("[Scheduler] Tick error:", err.message);
    }
}
// ── Scout Task ───────────────────────────────────────────────────────
async function runScoutTask(auto) {
    const { id, workspaceId, browserSessionId, config } = auto;
    if (!browserSessionId) {
        await S.updateAutomation(id, workspaceId, {
            status: "error",
            errorMessage: "No browser session configured",
        });
        return;
    }
    // Check browser is connected
    if (!isSessionConnectedFn(browserSessionId)) {
        const failures = auto.consecutiveFailures + 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
            await S.updateAutomation(id, workspaceId, {
                status: "error",
                consecutiveFailures: failures,
                errorMessage: "Browser offline at scheduled time",
            });
        }
        else {
            await S.updateAutomation(id, workspaceId, {
                consecutiveFailures: failures,
            });
        }
        return;
    }
    // Build scout prompt
    const engagedHandles = await S.getRecentlyEngagedHandles(workspaceId);
    const prompt = buildScoutPrompt(config, engagedHandles);
    // Compute next run time
    const nextRunAt = computeNextRun(config.schedule_cron, config.timezone);
    // Update automation state (mark as running)
    await S.updateAutomation(id, workspaceId, {
        lastRunAt: new Date(),
        nextRunAt,
        consecutiveFailures: 0,
        errorMessage: null,
    });
    // Run the task
    const result = await runTaskFn({
        workspaceId,
        browserSessionId,
        task: prompt,
        url: "https://x.com",
    });
    if (result.status !== "complete" || !result.answer) {
        await S.updateAutomation(id, workspaceId, {
            consecutiveFailures: auto.consecutiveFailures + 1,
            errorMessage: `Scout task failed: ${result.status}`,
        });
        return;
    }
    // Parse drafts from answer
    const drafts = parseScoutAnswer(result.answer);
    if (!drafts || drafts.length === 0) {
        await S.updateAutomation(id, workspaceId, {
            errorMessage: "Scout returned no usable drafts",
        });
        return;
    }
    // Store drafts
    const stored = await S.createDraftBatch({
        automationId: id,
        workspaceId,
        scoutTaskId: result.taskId,
        drafts,
    });
    // Notify
    const email = config.notification_email;
    if (email && notifyFn) {
        try {
            await notifyFn(email, stored.length);
        }
        catch (err) {
            console.error(`[Scheduler] Notification failed:`, err.message);
        }
    }
}
// ── Scout Prompt ─────────────────────────────────────────────────────
function buildScoutPrompt(config, engagedHandles) {
    const keywords = (config.keywords || []).join('", "');
    const maxDrafts = config.max_drafts || 8;
    const replyMix = config.reply_mix || { a: 40, b: 40, c: 20 };
    const voiceProfile = config.voice_profile
        ? JSON.stringify(config.voice_profile, null, 2)
        : "No voice profile set. Use a casual, helpful developer tone.";
    const skipList = engagedHandles.length > 0
        ? engagedHandles.join(", ")
        : "None yet";
    return `You are a professional X/Twitter marketing scout. Your job is to find high-value tweets and draft reply suggestions. You NEVER post anything — you only research and draft.

## Product
Name: ${config.product_name || ""}
URL: ${config.product_url || ""}
Description: ${config.product_description || ""}

## Voice Profile
${voiceProfile}

## Previously engaged handles (do NOT draft replies for these)
${skipList}

## Instructions
1. For each keyword below, navigate to the search URL and look at the Latest tab:
   Keywords: "${keywords}"
   Search URL pattern: https://x.com/search?q={keyword}&src=typed_query&f=live

2. Scroll through results. Collect 15-20 candidate tweets that are:
   - Posted within the last 24 hours
   - From real people (not bots, not brands with millions of followers)
   - Related to the product's problem space
   - Have some engagement but aren't viral (5-200 likes ideal)

3. For each promising tweet author, visit their profile briefly to understand who they are.

4. Score each tweet 1-10 based on: relevance, timing, author quality, reply visibility, conversation potential.

5. Select the top ${maxDrafts} tweets.

6. Draft a reply for each. Follow this mix:
   - Type A (value-only, no product mention): ~${replyMix.a}%
   - Type B (value + soft mention): ~${replyMix.b}%
   - Type C (direct recommendation): ~${replyMix.c}%

7. Anti-AI rules for EVERY reply:
   - Never use em dashes (—), semicolons, or words like "leverage", "harness", "streamline"
   - Never start with "Hey!", "Great point!", "Love this!"
   - Under 280 characters. Sound like a text message, not a press release.
   - Use contractions (don't, can't, it's)
   - Match the energy of the original poster

8. Return your results as a JSON block at the very end of your response.

## OUTPUT FORMAT (CRITICAL)
After completing your research, output ONLY this JSON block at the end:

\`\`\`json
{"drafts": [
  {
    "tweet_url": "https://x.com/user/status/123456",
    "tweet_text": "the original tweet text...",
    "tweet_author_handle": "@username",
    "tweet_author_name": "Display Name",
    "tweet_author_bio": "their bio...",
    "tweet_author_followers": 2100,
    "tweet_engagement": {"likes": 12, "replies": 3, "retweets": 1},
    "tweet_age_hours": 2.5,
    "reply_text": "your drafted reply text here",
    "reply_type": "B",
    "reply_reasoning": "Why this tweet and this reply approach",
    "score": 8
  }
]}
\`\`\`

Output ONLY this JSON block at the end. No other text after it.`;
}
export function parseScoutAnswer(answer) {
    let raw;
    // Try: ```json ... ``` block
    const fenced = answer.match(/```json\s*([\s\S]*?)```/);
    if (fenced) {
        try {
            raw = JSON.parse(fenced[1]);
        }
        catch { }
    }
    // Try: raw JSON starting with {"drafts"
    if (!raw) {
        const jsonStart = answer.lastIndexOf('{"drafts"');
        if (jsonStart !== -1) {
            try {
                raw = JSON.parse(answer.slice(jsonStart));
            }
            catch { }
        }
    }
    // Try: raw JSON array starting with [
    if (!raw) {
        const arrStart = answer.lastIndexOf('[{');
        if (arrStart !== -1) {
            try {
                const parsed = JSON.parse(answer.slice(arrStart));
                if (Array.isArray(parsed))
                    raw = { drafts: parsed };
            }
            catch { }
        }
    }
    if (!raw?.drafts || !Array.isArray(raw.drafts))
        return null;
    // Normalize field names (LLM might use snake_case)
    return raw.drafts
        .filter((d) => d.tweet_url && d.reply_text)
        .map((d) => ({
        tweetUrl: d.tweet_url,
        tweetText: d.tweet_text,
        tweetAuthorHandle: d.tweet_author_handle,
        tweetAuthorName: d.tweet_author_name,
        tweetAuthorBio: d.tweet_author_bio,
        tweetAuthorFollowers: d.tweet_author_followers,
        tweetEngagement: d.tweet_engagement,
        tweetAgeHours: d.tweet_age_hours,
        replyText: d.reply_text,
        replyType: d.reply_type,
        replyReasoning: d.reply_reasoning,
        score: d.score,
    }));
}
// ── Cron Helpers ─────────────────────────────────────────────────────
export function computeNextRun(cronExpr, timezone) {
    try {
        const interval = CronExpressionParser.parse(cronExpr, {
            tz: timezone || "UTC",
        });
        return interval.next().toDate();
    }
    catch {
        return null;
    }
}
// Post prompt for approved drafts
export function buildPostPrompt(tweetUrl, replyText) {
    return `Go to ${tweetUrl}

Click the reply button. Type this exact text in the reply box:

${replyText}

Click the post/reply button to submit. Confirm the reply was posted successfully.`;
}
