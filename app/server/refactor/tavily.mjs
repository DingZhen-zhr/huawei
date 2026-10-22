import { createHash } from "node:crypto";

const OFFICIAL_HOSTS = ["huawei.com", "vmall.com"];
const MAX_QUERIES = 3;
const TIMEOUT_MS = 20_000;

export function isOfficialHuaweiUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OFFICIAL_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function digest(text) {
  return createHash("sha256").update(text).digest("hex");
}

/** Searches only for source candidates; callers must never treat output as ledger facts. */
export async function searchOfficialSources(query, { apiKey = process.env.TAVILY_API_KEY, fetchImpl = fetch, now = () => new Date() } = {}) {
  if (!apiKey) return { status: "needs_evidence", reason: "TAVILY_API_KEY 未配置", sources: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const searches = [String(query || ""), `${query} 华为 官方`, `${query} site:consumer.huawei.com OR site:vmall.com`].slice(0, MAX_QUERIES);
    const sources = [];
    for (const q of searches) {
      const response = await fetchImpl("https://api.tavily.com/search", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, query: q, search_depth: "advanced", max_results: 5, include_raw_content: true }),
      });
      if (!response.ok || !String(response.headers.get("content-type") || "").includes("application/json")) continue;
      const payload = await response.json();
      for (const item of payload.results || []) {
        if (!isOfficialHuaweiUrl(item.url) || sources.some((source) => source.url === item.url)) continue;
        const page = await fetchImpl(item.url, { signal: controller.signal, headers: { accept: "text/html,text/plain" } });
        const contentType = String(page.headers.get("content-type") || "").toLowerCase();
        if (!page.ok || (!contentType.includes("text/html") && !contentType.includes("text/plain"))) continue;
        const body = (await page.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").replace(/\s+/g, " ").trim();
        if (body.length < 20) continue;
        sources.push({ id: `src:${digest(item.url).slice(0, 16)}`, url: item.url, title: String(item.title || "华为官方页面"), capturedAt: now().toISOString(), excerpt: body.slice(0, 1200), contentHash: digest(body), trustTier: 1, status: "proposed" });
      }
    }
    return sources.length ? { status: "proposed", sources } : { status: "needs_evidence", reason: "未找到可抓取的华为官方正文", sources: [] };
  } catch (error) {
    return { status: "needs_evidence", reason: error?.name === "AbortError" ? "搜索超时，等待补充官方来源" : "官方来源搜索失败，等待补充", sources: [] };
  } finally {
    clearTimeout(timer);
  }
}
