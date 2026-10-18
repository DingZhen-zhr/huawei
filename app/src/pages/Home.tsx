import { useEffect, useMemo, useRef, useState } from "react";
import { Store, BookOpen, Send, RotateCcw, ChevronRight, Database } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ChatMessage from "@/components/ChatMessage";
import { DEMO_STEPS, freeReply, type ChatMsg } from "@/lib/engine";

const PROMPT_PATH =
  "D:/KimiData/kimi/Workspaces/华为浙客松/门店增长智能体/系统提示词骨架.md";

export default function Home() {
  // ── 演示模式 ──
  const [step, setStep] = useState(0);
  const demoMsgs = useMemo(() => {
    const out: ChatMsg[] = [];
    for (let i = 0; i < step && i < DEMO_STEPS.length; i++) {
      out.push(DEMO_STEPS[i].agent);
      if (DEMO_STEPS[i].customer) out.push(DEMO_STEPS[i].customer!);
    }
    return out;
  }, [step]);

  // ── 自由对话 ──
  const [freeMsgs, setFreeMsgs] = useState<ChatMsg[]>([
    {
      role: "agent",
      title: "门店增长智能体已就绪",
      body: "我是门店销售顾问的作战伙伴，挂载华为 PC 全板块深度知识库 v7（事实基准 2026-10-17）。\n\n可以直接问我：**报价**、**参数**、**软件兼容**、**写小红书文案**、**到店演示怎么做**，也可以故意问我\"内部价能不能便宜\"试试权限闸门。",
    },
  ]);
  const [input, setInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (el) el.scrollTop = el.scrollHeight;
  }, [step, freeMsgs]);

  // ── 系统提示词 ──
  const [promptText, setPromptText] = useState("");

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setFreeMsgs((m) => [...m, { role: "customer", body: text }, freeReply(text)]);
    setInput("");
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 头部 */}
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-700 text-white">
            <Store className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[15px] font-bold leading-tight">门店增长智能体</div>
            <div className="text-[11px] text-muted-foreground">
              浙客松·华为产业赛道 ｜ 懂客户 · 写内容 · 算准价 · 推到成交
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-[11px]">
            <Database className="h-3 w-3" />
            知识库 v7 ｜ 快照 2026-10-17
          </Badge>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  if (promptText) return;
                  fetch(`/@fs/${encodeURI(PROMPT_PATH)}`)
                    .then((r) => r.text())
                    .then(setPromptText)
                    .catch(() => setPromptText("（系统提示词文件读取失败）"));
                }}
              >
                <BookOpen className="mr-1 h-3.5 w-3.5" />
                系统提示词
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] max-w-2xl">
              <DialogHeader>
                <DialogTitle>系统提示词骨架（系统提示词骨架.md）</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[62vh] pr-3">
                <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/85">
                  {promptText || "读取中…"}
                </pre>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <Tabs defaultValue="demo" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-4 pt-2">
          <TabsList>
            <TabsTrigger value="demo" className="text-xs">演示模式（端到端闭环）</TabsTrigger>
            <TabsTrigger value="free" className="text-xs">自由对话（现场测试）</TabsTrigger>
          </TabsList>
        </div>

        {/* ── 演示模式 ── */}
        <TabsContent value="demo" className="m-0 flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
            <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
              {demoMsgs.map((m, i) => (
                <ChatMessage key={i} msg={m} onChip={() => setStep((s) => Math.min(s + 1, DEMO_STEPS.length))} />
              ))}
              {step >= DEMO_STEPS.length && (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5" />
                  演示结束，可切换到「自由对话」现场提问，或点击重播
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="border-t bg-card/60 px-4 py-2.5">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                第 {Math.min(step, DEMO_STEPS.length)} / {DEMO_STEPS.length} 步
                {step === 0 && " · 点击下方按钮开始演示"}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={step === 0}
                  onClick={() => setStep(0)}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  重播
                </Button>
                <Button
                  size="sm"
                  className="h-8 bg-red-700 text-xs hover:bg-red-800"
                  disabled={step >= DEMO_STEPS.length}
                  onClick={() => setStep((s) => Math.min(s + 1, DEMO_STEPS.length))}
                >
                  {step === 0 ? "开始演示" : "下一步"}
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── 自由对话 ── */}
        <TabsContent value="free" className="m-0 flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
            <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
              {freeMsgs.map((m, i) => (
                <ChatMessage
                  key={i}
                  msg={m}
                  onChip={(t) => {
                    setFreeMsgs((mm) => [...mm, { role: "customer", body: t }, freeReply(t)]);
                  }}
                />
              ))}
            </div>
          </ScrollArea>
          <div className="border-t bg-card/60 px-4 py-2.5">
            <div className="mx-auto flex max-w-3xl gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="例如：MateBook Pro 多少钱？／ 能跑 Photoshop 吗？／ 内部价能不能便宜？"
                className="h-9 text-[13px]"
              />
              <Button className="h-9 bg-red-700 hover:bg-red-800" onClick={send}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
