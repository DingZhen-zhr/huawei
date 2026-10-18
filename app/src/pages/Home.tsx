import { useEffect, useMemo, useRef, useState } from "react";
import {
  Store, BookOpen, Send, RotateCcw, Play, ChevronDown, Copy, Download,
  CheckCircle2, XCircle, Database, Wand2, KeyRound,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ChatMessage from "@/components/ChatMessage";
import EvidencePanel from "@/components/EvidencePanel";
import Md from "@/components/Md";
import { fetchImageIndex, type KbImage } from "@/lib/kb";
import {
  MODELS, PLATFORMS, SCENARIOS,
  buildExport, buildPublishText, runPipeline,
  type ModelId, type PlatformId, type ScenarioId, type StageOut, type TaskInput,
} from "@/lib/content";
import { freeReply, type ChatMsg } from "@/lib/engine";
import { callDeepSeek } from "@/lib/llm";

const PROMPT_PATH =
  "D:/KimiData/kimi/Workspaces/华为浙客松/门店增长智能体/系统提示词骨架.md";

/** 按平台要求从图片索引挑图并格式化来源记录 */
function pickImages(images: KbImage[], platform: PlatformId, modelDir: string): string[] {
  const range = PLATFORMS[platform].imgRange;
  const n = Math.min(range[1], Math.max(range[0], images.length ? range[0] : 0));
  const sorted = [...images].sort((a, b) => {
    const score = (x: KbImage) =>
      (/外观|配色/.test(x.caption) ? 0 : /场景|创作|协同/.test(x.caption) ? 1 : /细节|屏幕/.test(x.caption) ? 2 : 3);
    return score(a) - score(b);
  });
  const positions: Record<PlatformId, string[]> = {
    小红书: ["封面/首图", "第 2 页·任务场景", "第 3 页·核心事实", "第 4 页·版本差异", "第 5 页·核对清单", "第 6 页·收尾"],
    公众号: ["封面图", "正文中段·事实插图", "结尾·行动引导配图", "备选·细节图"],
    门店朋友圈: ["主图", "场景图", "细节图"],
    门店海报: ["唯一主视觉（不得拉伸或错配型号）"],
  };
  return sorted.slice(0, n).map(
    (img, i) =>
      `${img.file}｜来源：华为官方产品页（已登记于 P1/${modelDir}/图片索引.csv）｜插入位置：${positions[platform][i] ?? "正文"}｜图片说明：${img.caption}`
  );
}

export default function Home() {
  // ── 任务输入 ──
  const [modelId, setModelId] = useState<ModelId>("matebook-pro");
  const [scenario, setScenario] = useState<ScenarioId>("内容创作");
  const [platform, setPlatform] = useState<PlatformId>("小红书");
  const [goal, setGoal] = useState("带来私信咨询与到店体验");
  const [brief, setBrief] = useState("");
  const [withPrice, setWithPrice] = useState(false);
  const [stages, setStages] = useState<StageOut[] | null>(null);
  const [running, setRunning] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{ task: TaskInput; plan: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  const task: TaskInput = useMemo(
    () => ({ modelId, scenario, platform, goal, withPrice, brief: brief.trim() || undefined }),
    [modelId, scenario, platform, goal, withPrice, brief]
  );

  const run = async (t: TaskInput = task) => {
    setRunning(true);
    setStages(null);
    setCopied(false);
    const m = MODELS[t.modelId];
    let imgs: KbImage[] = [];
    try {
      imgs = await fetchImageIndex(m.kbDir);
    } catch {
      imgs = [];
    }
    const plan = pickImages(imgs, t.platform, m.kbDir);
    // 模拟流水线推进，让每阶段卡片依次出现
    const all = runPipeline(t, plan);
    setStages([]);
    for (let i = 0; i < all.length; i++) {
      await new Promise((r) => setTimeout(r, 180));
      setStages(all.slice(0, i + 1));
    }
    setExported(buildExport(t, plan));
    setLastRun({ task: t, plan });
    setRunning(false);
  };

  // ── 自由对话 ──
  const [freeMsgs, setFreeMsgs] = useState<ChatMsg[]>([
    {
      role: "agent",
      title: "门店增长智能体已就绪",
      body: "我挂在华为 PC 知识库 v7 上（快照 2026-10-17）。在「软文工作台」里输入产品+人群+场景+平台即可跑完整流水线。\n\n这里可以现场测试：**混淆型号**（MateBook Pro 和 Pro S 有什么区别）、**补贴/内部价**（知识库没有的数据怎么处理）、**参数/价格**快查。\n\n在右上角「接入 DeepSeek」填入 API Key 后，本模式将切换为**大模型回答**：自动挂载知识库检索片段与护栏规则；未接入时使用内置规则引擎。",
    },
  ]);
  const [input, setInput] = useState("");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("deepseek-key") ?? "");
  const [keyInput, setKeyInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const saveKey = () => {
    const k = keyInput.trim();
    if (k) {
      localStorage.setItem("deepseek-key", k);
      setApiKey(k);
      setKeyInput("");
    }
  };
  const clearKey = () => {
    localStorage.removeItem("deepseek-key");
    setApiKey("");
  };

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setFreeMsgs((m) => [...m, { role: "customer", body: text }]);
    setInput("");
    if (apiKey) {
      setThinking(true);
      try {
        const history = freeMsgs
          .filter((m) => m.role === "customer" || m.role === "agent")
          .map((m) => ({ role: m.role as "customer" | "agent", body: m.body }));
        const reply = await callDeepSeek(history, text, apiKey);
        setFreeMsgs((m) => [...m, { role: "agent", title: "DeepSeek · 知识库增强回答", body: reply }]);
      } catch (e) {
        const fallback = freeReply(text);
        fallback.body = `（DeepSeek 调用失败，已回退规则引擎）\n\n${fallback.body}`;
        setFreeMsgs((m) => [...m, fallback]);
      } finally {
        setThinking(false);
      }
    } else {
      setFreeMsgs((m) => [...m, freeReply(text)]);
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (el) el.scrollTop = el.scrollHeight;
  }, [stages, freeMsgs]);

  const [promptText, setPromptText] = useState("");

  const copyExport = async () => {    if (!exported) return;
    await navigator.clipboard.writeText(exported);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const [copiedPub, setCopiedPub] = useState(false);
  const copyPublish = async () => {
    if (!lastRun) return;
    await navigator.clipboard.writeText(buildPublishText(lastRun.task, lastRun.plan));
    setCopiedPub(true);
    setTimeout(() => setCopiedPub(false), 2000);
  };
  const downloadExport = () => {
    if (!exported) return;
    const blob = new Blob([exported], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${MODELS[modelId].name.replace(/[（）\s]/g, "")}-${scenario}-${platform}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
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
            <div className="text-[15px] font-bold leading-tight">AI+华为PC营销软文智能体</div>
            <div className="text-[11px] text-muted-foreground">
              浙客松·华为产业赛道 ｜ 场景解析 → 平台策略 → 检索 → 生成 → 核验 → 合规 → 导出
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              {apiKey ? (
                <Badge className="cursor-pointer gap-1 bg-emerald-600 text-[11px] hover:bg-emerald-700">
                  <KeyRound className="h-3 w-3" />
                  DeepSeek 已连接（点击管理）
                </Badge>
              ) : (
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <KeyRound className="mr-1 h-3.5 w-3.5" />
                  接入 DeepSeek
                </Button>
              )}
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>接入 DeepSeek API</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-[13px]">
                <p className="text-muted-foreground">
                  填入你的 DeepSeek API Key（platform.deepseek.com 申请），自由对话将由大模型回答，
                  并自动挂载知识库检索片段与全部护栏规则。Key 仅保存在本机浏览器，不明文展示或上传。
                </p>
                <Input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="h-9 text-xs"
                />
                <div className="flex gap-2">
                  <Button className="h-8 bg-red-700 text-xs hover:bg-red-800" onClick={saveKey}>
                    保存并连接
                  </Button>
                  {apiKey && (
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={clearKey}>
                      清除已存 Key
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  已存 Key：{apiKey ? `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}` : "无"}；未接入时自由对话使用内置规则引擎，工作台流水线不受影响。
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Badge variant="outline" className="gap-1 text-[11px]">
            <Database className="h-3 w-3" />
            知识库 v7 ｜ 快照 2026-10-17
          </Badge>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                if (promptText) return;
                fetch(`/@fs/${encodeURI(PROMPT_PATH)}`).then((r) => r.text()).then(setPromptText)
                  .catch(() => setPromptText("（系统提示词文件读取失败）"));
              }}>
                <BookOpen className="mr-1 h-3.5 w-3.5" />
                系统提示词
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] max-w-2xl">
              <DialogHeader>
                <DialogTitle>系统提示词骨架（8 模块规范）</DialogTitle>
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

      <Tabs defaultValue="workbench" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-4 pt-2">
          <TabsList>
            <TabsTrigger value="workbench" className="text-xs">软文工作台（9 阶段流水线）</TabsTrigger>
            <TabsTrigger value="free" className="text-xs">自由对话（现场抽查）</TabsTrigger>
          </TabsList>
        </div>

        {/* ── 工作台 ── */}
        <TabsContent value="workbench" className="m-0 flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
            <div className="mx-auto max-w-3xl space-y-3 px-4 py-4">
              {/* 任务输入 */}
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">任务输入</div>
                  <Button
                    variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                    onClick={() => { setModelId("matebook-pro"); setScenario("内容创作"); setPlatform("小红书"); setGoal("带来私信咨询与到店体验"); setWithPrice(false); setBrief(""); }}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    重置
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <div>
                    <Label className="mb-1 block text-xs text-muted-foreground">产品型号（相近型号易混淆）</Label>
                    <Select value={modelId} onValueChange={(v) => setModelId(v as ModelId)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(MODELS) as ModelId[]).map((id) => (
                          <SelectItem key={id} value={id} className="text-xs">
                            {MODELS[id].name}｜{MODELS[id].cpu}·{MODELS[id].weight}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs text-muted-foreground">业务场景</Label>
                    <Select value={scenario} onValueChange={(v) => setScenario(v as ScenarioId)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
                          <SelectItem key={id} value={id} className="text-xs">{id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs text-muted-foreground">发布平台</Label>
                    <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformId)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PLATFORMS) as PlatformId[]).map((id) => (
                          <SelectItem key={id} value={id} className="text-xs">{id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="mb-1 block text-xs text-muted-foreground">内容目标</Label>
                    <Input value={goal} onChange={(e) => setGoal(e.target.value)} className="h-9 text-xs" />
                  </div>
                  <div className="col-span-2">
                    <Label className="mb-1 block text-xs text-muted-foreground">
                      顾客原话（可选）——填模糊需求可演示「先追问再生成」机制
                    </Label>
                    <Input
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      placeholder="例：想买台轻薄本，平时就办公用"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="flex items-end gap-2 pb-1.5">
                    <Switch id="price" checked={withPrice} onCheckedChange={setWithPrice} />
                    <Label htmlFor="price" className="text-xs leading-tight text-muted-foreground">
                      文中引用价格<br />（仅限有官方依据时）
                    </Label>
                  </div>
                </div>
                <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground/80">防混淆提示：</span>
                  {MODELS[modelId].identityNote}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button className="h-8 bg-red-700 text-xs hover:bg-red-800" onClick={() => run()} disabled={running}>
                    <Play className="mr-1 h-3.5 w-3.5" />
                    {running ? "流水线运行中…" : "运行 9 阶段流水线"}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" disabled={running}
                    onClick={() => { const ids = Object.keys(PLATFORMS) as PlatformId[]; const next = ids[(ids.indexOf(platform) + 1) % ids.length]; setPlatform(next); }}>
                    <Wand2 className="mr-1 h-3.5 w-3.5" />换平台重生成（→{(() => { const ids = Object.keys(PLATFORMS) as PlatformId[]; return PLATFORMS[ids[(ids.indexOf(platform) + 1) % ids.length]].id; })()}）
                  </Button>
                </div>
              </div>

              {/* 流水线阶段卡片 */}
              {stages?.map((st) => (
                <Collapsible key={st.id} defaultOpen={st.id === "generate" || st.id === "compliance" || st.id === "verify"}>
                  <div className="rounded-xl border bg-card">
                    <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-muted/40">
                      <span className="flex items-center gap-2 text-[13px] font-semibold">
                        {st.name}
                        {st.ok !== undefined &&
                          (st.ok ? (
                            <Badge className="gap-1 bg-emerald-600 text-[10.5px] hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3" />通过</Badge>
                          ) : (
                            <Badge className="gap-1 bg-amber-600 text-[10.5px] hover:bg-amber-600"><XCircle className="h-3 w-3" />需处理</Badge>
                          ))}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="max-w-[46vw] truncate text-[11px] font-normal text-muted-foreground">{st.summary}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 border-t px-4 py-3">
                        <Md text={st.detail} />
                        {st.evidenceIds.length > 0 && <EvidencePanel fileIds={st.evidenceIds} />}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}

              {/* 导出 */}
              {exported && (
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">导出（统一四段式格式）</div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 bg-red-700 text-xs hover:bg-red-800" onClick={copyPublish}>
                        {copiedPub ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                        {copiedPub ? "已复制" : "复制发布正文"}
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyExport}>
                        {copied ? <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                        {copied ? "已复制" : "复制全文（四段式）"}
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={downloadExport}>
                        <Download className="mr-1 h-3.5 w-3.5" />下载 .md
                      </Button>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    「复制发布正文」可直接粘贴到平台（仅标题+正文+配图建议，已去掉审核包装）；「复制全文 / 下载 .md」为比赛统一四段式格式（场景判断 / 知识库依据 / 图文软文 / 核验结果），用于提交与存档。发布前请人工复核价格与权益。
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ── 自由对话 ── */}
        <TabsContent value="free" className="m-0 flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
            <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
              {freeMsgs.map((m, i) => (
                <ChatMessage key={i} msg={m} onChip={(t) => setFreeMsgs((mm) => [...mm, { role: "customer", body: t }, freeReply(t)])} />
              ))}
            </div>
          </ScrollArea>
          <div className="border-t bg-card/60 px-4 py-2.5">
            <div className="mx-auto flex max-w-3xl gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={apiKey ? "DeepSeek 已接入，直接提问（自动挂载知识库）" : "试试：MateBook Pro 和 Pro S 有什么区别？／ 国补能减多少？（右上角可接入 DeepSeek）"}
                className="h-9 text-[13px]"
                disabled={thinking}
              />
              <Button className="h-9 bg-red-700 hover:bg-red-800" onClick={send} disabled={thinking}>
                {thinking ? <span className="text-xs">思考中…</span> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
