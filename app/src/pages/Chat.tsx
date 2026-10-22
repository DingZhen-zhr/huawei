import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Copy, Download, ImageIcon, Loader2, Mic, MicOff, Sparkles } from "lucide-react";
import { sendChat, type Fact, type Message } from "@/lib/chat";
import { IMAGE_SPEC, downloadAsset, renderPlatformImages, type ImageAsset, type PlatformId } from "@/lib/imagegen";

const STARTERS: Record<"guide" | "content", string[]> = {
  guide: ["顾客想买个轻薄本，预算还没说", "客户 8000 预算，主要剪视频", "客户嫌比竞品贵，怎么回"],
  content: [
    "写一篇小红书，MateBook 14 鸿蒙版，给学生上网课用",
    "朋友圈文案，8000 档轻薄本，主推续航",
    "门店海报文案，开学季，预算 5000",
  ],
};

const PLATFORMS: [PlatformId, string][] = [
  ["xiaohongshu", "小红书"],
  ["moments", "朋友圈"],
  ["wechat-mp", "公众号"],
  ["poster", "门店海报"],
];

const uid = () => Math.random().toString(36).slice(2);

export default function Chat() {
  const [mode, setMode] = useState<"guide" | "content">("guide");
  const [platform, setPlatform] = useState<PlatformId>("xiaohongshu");
  const [threads, setThreads] = useState<{ guide: Message[]; content: Message[] }>({
    guide: [],
    content: [],
  });
  const [restored, setRestored] = useState<{ guide: boolean; content: boolean }>({
    guide: false,
    content: false,
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [assets, setAssets] = useState<Record<string, ImageAsset[]>>({});
  const [imgLoading, setImgLoading] = useState<string | null>(null);
  const [imgError, setImgError] = useState("");
  const [serverDown, setServerDown] = useState(false);
  const recRef = useRef<any>(null);
  const deviceRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = threads[mode];
  const sessionKey = (m: "guide" | "content") => `${deviceRef.current}:${m}`;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // 匿名 id + 分别恢复两种模式的会话
  useEffect(() => {
    const key = "hc_device_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    deviceRef.current = id;

    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setServerDown(!d?.ok))
      .catch(() => setServerDown(true));

    (["guide", "content"] as const).forEach((m) => {
      fetch(`/api/session?deviceId=${encodeURIComponent(`${id}:${m}`)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!Array.isArray(d.messages) || !d.messages.length) return;
          setThreads((prev) => ({
            ...prev,
            [m]: d.messages.map((x: any) => ({
              id: uid(),
              role: x.role,
              content: x.content,
              facts: x.facts,
              options: x.options,
            })),
          }));
          setRestored((prev) => ({ ...prev, [m]: true }));
        })
        .catch(() => {});
    });
  }, []);

  const send = async (text = input) => {
    const content = text.trim();
    if (!content || loading) return;
    setError("");
    setInput("");
    const usedPlatform = mode === "content" ? platform : undefined;
    const userMsg: Message = { id: uid(), role: "user", content };
    const next = [...threads[mode], userMsg];
    setThreads((prev) => ({ ...prev, [mode]: next }));
    setLoading(true);
    try {
      const r = await sendChat(next, mode, mode === "content" ? platform : undefined, sessionKey(mode));
      setThreads((prev) => ({
        ...prev,
        [mode]: [
          ...prev[mode],
          {
            id: uid(),
            role: "assistant",
            content: r.reply,
            facts: r.facts,
            options: r.options,
            platform: usedPlatform,
            issues: r.issues,
            warning: r.warning,
          },
        ],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络异常，稍后再试");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const voiceSupported =
    typeof window !== "undefined" &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const toggleVoice = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const reset = async () => {
    fetch("/api/session", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: sessionKey(mode) }),
    }).catch(() => {});
    setThreads((prev) => ({ ...prev, [mode]: [] }));
    setRestored((prev) => ({ ...prev, [mode]: false }));
    setAssets({});
    setError("");
    setInput("");
  };

  const generateImages = async (m: Message) => {
    const p = (m.platform as PlatformId) || platform;
    const key = `${m.id}:${p}`;
    const lines = m.content.split("\n").map((l) => l.trim()).filter(Boolean);
    const noTitle = p === "moments"; // 朋友圈没有标题，整段都是正文
    const title = noTitle ? "" : (lines[0] || "华为门店推荐").slice(0, 30);
    const body = noTitle ? m.content : lines.slice(1).join(" ");
    const price = (m.content.match(/¥\s?[\d,]+/) || [])[0];
    setImgLoading(key);
    setImgError("");
    try {
      const r = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: p, title, body }),
      });
      const text = await r.text();
      let d: any = {};
      try {
        d = text ? JSON.parse(text) : {};
      } catch {
        d = {};
      }
      if (!r.ok || !text) throw new Error(d.error || `生成失败（${r.status}）`);
      const bg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = d.dataUrl;
      });
      setAssets((prev) => ({ ...prev, [key]: renderPlatformImages(p, { title, body, price }, bg) }));
    } catch (e) {
      setAssets((prev) => ({ ...prev, [key]: renderPlatformImages(p, { title, body, price }) }));
      setImgError(e instanceof Error ? `AI 图失败（${e.message}），已用纯模板` : "AI 图失败，已用纯模板");
    } finally {
      setImgLoading(null);
    }
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="flex min-h-full flex-col bg-[#fbfaf7]">
      <header className="sticky top-0 z-20 border-b hairline bg-[#fbfaf7]">
        <div className="mx-auto flex h-14 max-w-[760px] items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-black">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                <circle cx="12" cy="12" r="7.2" fill="none" stroke="white" strokeWidth="2.1" />
                <circle cx="12" cy="12" r="2.4" fill="#C8102E" />
              </svg>
            </span>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold tracking-tight">华为门店 · 导购助手</div>
              <div className="text-[10.5px] text-black/40">
                {mode === "guide" ? "先问清楚，再推荐" : "选平台，出稿出图"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/batch"
              className="rounded-full border border-black/12 bg-white px-2.5 py-1 text-[11px] text-black/55 hover:border-black/30 hover:text-black"
            >
              一键四平台
            </a>
            <button
              onClick={reset}
              className="rounded-full border border-black/12 bg-white px-2.5 py-1 text-[11px] text-black/55 hover:border-black/30 hover:text-black"
              title="清空当前模式并重新开始"
            >
              ＋ 新建
            </button>
            <div className="flex rounded-full border border-black/10 bg-white p-0.5">
              <button
                onClick={() => setMode("guide")}
                className={`rounded-full px-3 py-1 text-[11.5px] transition ${
                  mode === "guide" ? "bg-black text-white" : "text-black/50"
                }`}
              >
                导购
              </button>
              <button
                onClick={() => setMode("content")}
                className={`rounded-full px-3 py-1 text-[11.5px] transition ${
                  mode === "content" ? "bg-black text-white" : "text-black/50"
                }`}
              >
                写文案
              </button>
            </div>
            <span className="hidden items-center gap-1 text-[10.5px] text-emerald-700 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              在线
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 pb-6 pt-5">
        {messages.length === 0 && (
          <div className="pt-10">
            <div className="flex items-center gap-2 text-[13px] font-medium text-black/70">
              <Sparkles className="h-4 w-4 text-[#C8102E]" />
              {mode === "guide" ? "把顾客的情况说一句就行" : "选好平台，说一句要写什么"}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-black/40">
              {mode === "guide"
                ? "我会先问清楚在意什么，再给机型和话术。参数和价格只从门店知识库里取。"
                : "出稿后可以按平台尺寸直接生成配图：小红书 3:4、朋友圈 1:1、公众号封面 900×383、门店海报 1242 宽。"}
            </p>
            <div className="mt-4 space-y-1.5">
              {STARTERS[mode].map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full rounded-[12px] border border-black/8 bg-white px-3.5 py-2.5 text-left text-[12.5px] text-black/60 transition hover:border-black/20 hover:text-black/85"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {restored[mode] && messages.length > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-[10px] border border-black/8 bg-white px-3 py-1.5 text-[10.5px] text-black/40">
            <span>已恢复上次对话</span>
            <button onClick={reset} className="text-black/30 hover:text-black/60">
              开新对话
            </button>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id}>
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[78%] whitespace-pre-wrap rounded-[16px] rounded-br-[5px] bg-black px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[86%]">
                    <div className="whitespace-pre-wrap rounded-[16px] rounded-bl-[5px] border border-black/8 bg-white px-3.5 py-2.5 text-[13px] leading-[1.75] text-black/80">
                      {m.platform && (
                        <div className="mb-1.5 text-[10px] font-medium text-[#C8102E]">
                          按「{IMAGE_SPEC[(m.platform as PlatformId) || platform].label}」生成
                        </div>
                      )}
                      {m.content}
                    </div>

                    {m.options && m.options.length > 0 && m.id === lastAssistantId && !loading && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-0.5">
                        {m.options.map((o) => (
                          <button
                            key={o}
                            onClick={() => send(o)}
                            className="rounded-full border border-black/12 bg-white px-3 py-1.5 text-[12px] text-black/65 transition hover:border-black/30 hover:text-black"
                          >
                            {o}
                          </button>
                        ))}
                        <button
                          onClick={() => inputRef.current?.focus()}
                          className="rounded-full border border-dashed border-black/15 px-3 py-1.5 text-[12px] text-black/35 transition hover:border-black/30 hover:text-black/60"
                        >
                          都不是，我说
                        </button>
                      </div>
                    )}

                    {mode === "content" && m.id === lastAssistantId && !loading && (
                      <div className="mt-2 pl-0.5">
                        <button
                          onClick={() => generateImages(m)}
                          disabled={imgLoading === `${m.id}:${(m.platform as PlatformId) || platform}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-black/12 bg-white px-3 py-1.5 text-[12px] text-black/65 transition hover:border-black/30 hover:text-black disabled:opacity-50"
                        >
                          {imgLoading === `${m.id}:${(m.platform as PlatformId) || platform}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5" />
                          )}
                          {imgLoading === `${m.id}:${(m.platform as PlatformId) || platform}`
                            ? "正在生成实拍图…"
                            : `AI 生成配图（${IMAGE_SPEC[(m.platform as PlatformId) || platform].label} · ${IMAGE_SPEC[(m.platform as PlatformId) || platform].note}）`}
                        </button>
                      </div>
                    )}

                    {assets[`${m.id}:${(m.platform as PlatformId) || platform}`] && (
                      <div className="mt-2 rounded-[14px] border border-black/8 bg-white p-2.5">
                        <div className="mb-2 flex items-center justify-between px-0.5">
                          <span className="text-[10.5px] text-black/40">
                            {IMAGE_SPEC[(m.platform as PlatformId) || platform].label}配图 · {assets[`${m.id}:${(m.platform as PlatformId) || platform}`].length} 张
                          </span>
                          <button
                            onClick={() => assets[`${m.id}:${(m.platform as PlatformId) || platform}`].forEach((a, i) => setTimeout(() => downloadAsset(a, i), i * 200))}
                            className="inline-flex items-center gap-1 text-[10.5px] text-black/45 hover:text-black/75"
                          >
                            <Download className="h-3 w-3" /> 全部下载
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {assets[`${m.id}:${(m.platform as PlatformId) || platform}`].map((a, i) => (
                            <figure key={i} className="overflow-hidden rounded-[10px] border border-black/8">
                              <img src={a.dataUrl} alt={a.label} className="w-full bg-[#fbfaf7]" />
                              <figcaption className="flex items-center justify-between px-2 py-1 text-[9.5px] text-black/35">
                                <span className="truncate">{a.label}</span>
                                <button onClick={() => downloadAsset(a, i)} className="shrink-0 text-black/40 hover:text-black/70">
                                  下载
                                </button>
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      </div>
                    )}

                    {imgError && m.id === lastAssistantId && (
                      <p className="mt-1 px-1 text-[10px] text-amber-700">{imgError}</p>
                    )}

                    {m.facts && m.facts.length > 0 && (
                      <details className="mt-1.5 px-1">
                        <summary className="cursor-pointer text-[10.5px] text-black/30">依据 {m.facts.length} 条</summary>
                        <ul className="mt-1 space-y-1 border-l border-black/10 pl-2">
                          {m.facts.slice(0, 4).map((f: Fact, i: number) => (
                            <li key={i} className="text-[10.5px] leading-relaxed text-black/40">
                              <span className="text-black/55">{f.model}</span> · {f.text}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    <div className="mt-1 flex items-center gap-3 px-1">
                      {m.role === "assistant" && m.content.length > 80 && (
                        <button
                          onClick={() => copy(m.id, m.content)}
                          className="ml-auto inline-flex items-center gap-1 text-[10px] text-black/30 hover:text-black/60"
                        >
                          {copiedId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedId === m.id ? "已复制" : "复制"}
                        </button>
                      )}
                    </div>

                    {m.issues && m.issues.length > 0 && (
                      <p className="mt-1 px-1 text-[10px] text-amber-700">
                        平台校验：{m.issues.length} 条提示（{m.issues[0].message}）
                      </p>
                    )}
                    {m.warning && <p className="mt-1 px-1 text-[10px] text-amber-700">{m.warning}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-1.5 pl-2 text-black/30">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-[11.5px]">{mode === "content" ? "在写…" : "在看资料…"}</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>

      <div className="sticky bottom-0 border-t hairline bg-[#fbfaf7]">
        <div className="mx-auto max-w-[760px] px-4 py-3">
          {mode === "content" && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {PLATFORMS.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPlatform(id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    platform === id
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-black/45 hover:border-black/25"
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="text-[10px] text-black/25">{IMAGE_SPEC[platform].note}</span>
            </div>
          )}
          {serverDown && (
        <div className="mb-2 rounded-[10px] border border-red-500/25 bg-red-50 px-3 py-1.5 text-[10.5px] text-red-700">
          后端未连接：请在 app 目录运行 <code>node server/index.mjs</code>，再刷新页面
        </div>
      )}
      {error && <p className="mb-1.5 text-[11px] text-red-600">{error}</p>}
          <div className="flex items-end gap-2 rounded-[18px] border border-black/12 bg-white p-2 pl-3.5">
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={mode === "guide" ? "顾客什么情况？" : "想写哪台、给谁看？"}
              className="max-h-[120px] flex-1 resize-none bg-transparent py-1 text-[13px] leading-relaxed outline-none placeholder:text-black/25"
            />
            {voiceSupported && (
              <button
                onClick={toggleVoice}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                  listening ? "border-red-500/40 bg-red-50 text-red-600" : "border-black/10 text-black/40 hover:text-black/70"
                }`}
                aria-label={listening ? "停止录音" : "语音输入"}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-white disabled:opacity-25"
              aria-label="发送"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-black/25">
            <span>知识库快照 2026-10-17 · 价格与库存以门店为准</span>
            {messages.length > 0 && (
              <button onClick={reset} className="hover:text-black/50">
                新对话
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
