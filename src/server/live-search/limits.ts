const buckets = new Map<string, { count: number; resetAt: number }>();
let activeGenerations = 0;
let budgetDay = "";
let budgetUsed = 0;

export function allowRequest(ip: string, now = Date.now(), limit = 40, windowMs = 60_000) {
  if (buckets.size > 5000) for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** One slot per generating search and one daily ceiling, so a burst cannot run up the bill. */
export function acquireGeneration(now = new Date(), env: Record<string, string | undefined> = process.env) {
  const maxActive = Number(env.LIVE_LLM_MAX_ACTIVE) || 4;
  const dailyLimit = Number(env.LIVE_LLM_DAILY_LIMIT) || 1000;
  const day = now.toISOString().slice(0, 10);
  if (day !== budgetDay) {
    budgetDay = day;
    budgetUsed = 0;
  }
  if (activeGenerations >= maxActive || budgetUsed >= dailyLimit) return null;
  activeGenerations += 1;
  budgetUsed += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeGenerations -= 1;
  };
}

export function resetLiveLimits() {
  buckets.clear();
  activeGenerations = 0;
  budgetDay = "";
  budgetUsed = 0;
}
