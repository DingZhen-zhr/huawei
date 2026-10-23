import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowUp, Check, Copy, FileText, Loader2, Mic, MicOff, RotateCcw, Sparkles } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/lib/store-context";
import { sendChat, type Fact, type Message } from "@/lib/chat";
import { getSpeechRecognition, type SpeechRecognitionLike } from "@/lib/speech";

function followupHref(card: { id: string }, slots?: Record<string, string | number | null>) {
  const params = new URLSearchParams({ productId: card.id, target: "到店看实物" });
  const audienceMap: Record<string, string> = { 学生: "大学生", 职场: "通勤上班族", 创作者: "短视频创作者", 家庭: "家长给孩子买" };
  if (typeof slots?.segment === "string" && slots.segment) params.set("audience", audienceMap[slots.segment] || slots.segment);
  if (typeof slots?.scenario === "string" && slots.scenario) params.set("scene", slots.scenario);
  if (slots?.budget !== null && slots?.budget !== undefined && slots?.budget !== "") params.set("budget", String(slots.budget));
  return `/create?${params.toString()}`;
}

const STARTERS = [
  "预算 6000，主要剪视频，怎么选？",
  "顾客说旧电脑太重，每天要背去教室",
  "客户嫌比同价位贵，怎么接话？",
];

const uid = () => Math.random().toString(36).slice(2);

export default function Ask() {
  const { store } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [restored, setRestored] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const deviceRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    const key = "hc_device_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    deviceRef.current = `${id}:ask`;
    try {
      const raw = localStorage.getItem("hc_ask_history");
      if (!raw) return;
      const saved = JSON.parse(raw) as { savedAt?: number; messages?: Message[] };
      if (!saved?.savedAt || Date.now() - saved.savedAt > 7 * 86400000) {
        localStorage.removeItem("hc_ask_history");
        return;
      }
      if (Array.isArray(saved.messages) && saved.messages.length) {
        setMessages(saved.messages.slice(-40));
        setRestored(true);
      }
    } catch {
      localStorage.removeItem("hc_ask_history");
    }
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    try {
      localStorage.setItem("hc_ask_history", JSON.stringify({ savedAt: Date.now(), messages: messages.slice(-40) }));
    } catch {
      /* 浏览器禁用本地存储时不影响问答 */
    }
  }, [messages]);

  const send = async (text = input) => {
    const content = text.trim();
    if (!content || loading) return;
    setError("");
    setInput("");
    const next: Message[] = [...messages, { id: uid(), role: "user", content }];
    setMessages(next);
    setLoading(true);
    try {
      const result = await sendChat(next, "guide", undefined, deviceRef.current);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: result.reply,
          facts: result.facts,
          options: result.options,
          cards: result.cards,
          slots: result.slots,
          warning: result.warning,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络断了，再试一次。");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError("浏览器不让复制，长按选中文字。");
    }
  };

  const voiceSupported = Boolean(getSpeechRecognition());

  const toggleVoice = () => {
    if (!voiceSupported) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0].transcript;
      setInput(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const reset = async () => {
    try {
      localStorage.removeItem("hc_ask_history");
    } catch {
      /* ignore */
    }
    setMessages([]);
    setRestored(false);
    setError("");
    setInput("");
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <AppShell flush>
      <div className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-[820px] flex-col">
        <header className="border-b border-[var(--line)] px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.025em]">顾客问答</h1>
              <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">顾客什么情况，说一句就行。信息不够我会追问，价格只从资料里取。</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-[var(--muted-2)]">
                <span>{store.name}</span>
                <span>不建客户档案</span>
                <span>对话 7 天后清掉</span>
              </div>
            </div>
            <button type="button" className="btn-quiet shrink-0" onClick={() => void reset()}>
              <RotateCcw className="h-3.5 w-3.5" /> 新对话
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6">
          {messages.length === 0 && (
            <div className="mx-auto max-w-[640px] py-8 sm:py-14">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
                <Sparkles className="h-4 w-4 text-[var(--red)]" />
              </div>
              <h2 className="mt-5 text-[20px] font-semibold tracking-[-0.02em]">顾客什么情况，直接说</h2>
              <p className="mt-2 max-w-[36rem] text-[12.5px] leading-6 text-[var(--muted)]">
                预算、用途、现在最烦的地方，知道多少说多少。不够我会再问一句。
              </p>
              <div className="mt-6 space-y-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => void send(starter)}
                    className="flex min-h-[50px] w-full items-center justify-between gap-3 border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-[12.5px] leading-5 text-[var(--muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
                  >
                    {starter}
                    <ArrowUp className="h-3.5 w-3.5 shrink-0 rotate-45 text-[var(--muted-2)]" />
                  </button>
                ))}
              </div>
              <p className="mt-5 text-[10.5px] leading-5 text-[var(--muted-2)]">演示用，别输真实顾客的姓名、电话和学校。</p>
            </div>
          )}

          {restored && messages.length > 0 && (
            <div className="mb-4 flex items-center justify-between border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[10.5px] text-[var(--muted)]">
              <span>把最近 7 天的对话找回来了</span>
              <button type="button" className="text-[var(--red)] underline underline-offset-4" onClick={() => void reset()}>重新开始</button>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[82%] rounded-[14px] rounded-br-[4px] bg-[var(--ink)] px-4 py-3 text-[13px] leading-6 text-white">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="max-w-[90%]">
                      <div className="rounded-[14px] rounded-bl-[4px] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3">
                        <div className="whitespace-pre-wrap text-[13px] leading-7 text-[var(--ink)]">{message.content}</div>
                        {message.warning && <p className="mt-2 border-t border-[var(--line)] pt-2 text-[10.5px] leading-5 text-[var(--warning)]">{message.warning}</p>}
                      </div>

                      {message.cards && message.cards.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {message.cards.map((card) => (
                            <div key={card.id} className="border border-[var(--line)] bg-[var(--surface)] p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-[12px] font-medium">{card.model}</p>
                                  <p className="mt-0.5 text-[10px] text-[var(--muted-2)]">
                                    {card.family}{card.screenSize ? ` · ${card.screenSize} 英寸` : ""}
                                  </p>
                                </div>
                                <span className={`status-pill ${card.priceStatus === "active" ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"}`}>
                                  {card.priceLabel}
                                </span>
                              </div>
                              {card.overBy ? <p className="mt-1 text-[10px] text-[var(--warning)]">比预算高约 ¥{card.overBy.toLocaleString("zh-CN")}，值不值得加你判断。</p> : null}
                              <p className="mt-1 text-[10.5px] leading-5 text-[var(--muted)]">{card.reason}</p>
                              <p className="mt-1 border-t border-[var(--line)] pt-1.5 text-[10px] leading-5 text-[var(--muted-2)]">先问清楚：{card.limitation}</p>
                              <Link to={followupHref(card, message.slots)} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-[10.5px] text-[var(--red)] underline underline-offset-4">
                                接着写一条 <ArrowUp className="h-3 w-3 rotate-45" />
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}

                      {message.options && message.options.length > 0 && message.id === lastAssistantId && !loading && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {message.options.map((option) => (
                            <button key={option} type="button" className="chip" onClick={() => void send(option)}>{option}</button>
                          ))}
                          <button type="button" className="chip border-dashed" onClick={() => inputRef.current?.focus()}>都不是，我说</button>
                        </div>
                      )}

                      {message.facts && message.facts.length > 0 && (
                        <details className="mt-2 px-1">
                          <summary className="cursor-pointer text-[10.5px] text-[var(--muted)]">看依据（{message.facts.length} 条）</summary>
                          <ul className="mt-2 space-y-1.5 border-l border-[var(--line-strong)] pl-3">
                            {message.facts.slice(0, 4).map((fact: Fact, index: number) => (
                              <li key={index} className="text-[10.5px] leading-5 text-[var(--muted)]">
                                <span className="text-[var(--ink)]">{fact.model}</span> · {fact.text}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}

                      <div className="mt-1.5 flex items-center gap-3 px-1">
                        {message.content.length > 60 && (
                          <button type="button" className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--ink)]" onClick={() => void copy(message.id, message.content)}>
                            {copiedId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copiedId === message.id ? "已复制" : "复制"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-1.5 pl-1 text-[var(--muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-[11.5px]">想一下…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length > 0 && (
            <div className="mt-7 flex items-start gap-2 border border-[var(--info)]/20 bg-[var(--info-soft)] p-3 text-[11px] leading-5 text-[var(--info)]">
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>这里只管现场怎么答。要发内容，去内容页补一句店里的事，五个渠道用同一套资料。</span>
            </div>
          )}
        </main>

        <div className="sticky bottom-[calc(58px+env(safe-area-inset-bottom))] z-20 md:bottom-0 border-t border-[var(--line)] bg-[var(--paper)] px-4 py-3 sm:px-6 lg:bottom-0">
          <div className="mx-auto max-w-[820px]">
            {error && <p className="mb-2 text-[11px] leading-5 text-[var(--danger)]">{error}</p>}
            <div className="flex items-end gap-2 rounded-[14px] border border-[var(--line-strong)] bg-[var(--surface-strong)] p-2 pl-3">
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="顾客什么情况？"
                className="max-h-[120px] flex-1 resize-none bg-transparent py-1.5 text-[13px] leading-6 outline-none placeholder:text-[var(--muted)]"
              />
              {voiceSupported && (
                <button type="button" className="icon-button h-11 w-11" onClick={toggleVoice} aria-label={listening ? "停止录音" : "语音输入"}>
                  {listening ? <MicOff className="h-4 w-4 text-[var(--red)]" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] bg-[var(--ink)] text-white disabled:opacity-30" onClick={() => void send()} disabled={loading || !input.trim()} aria-label="发送">
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-[var(--muted-2)]">
              <span>价格和参数截至 2026-10-17</span>
              <Link to="/create" className="underline underline-offset-4 hover:text-[var(--ink)]">去写内容</Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
