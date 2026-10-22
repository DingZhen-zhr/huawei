import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Download, FilePlus2, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { IMAGE_SPEC, downloadAsset, renderPlatformImages, type ImageAsset, type PlatformId } from "@/lib/imagegen";

const PERSONAS: [string, string, string][] = [
  ["student", "学生自述", "第一人称，宿舍/教室细节"],
  ["clerk", "店员手记", "顾客小故事，专业克制"],
  ["parent", "家长换机", "给孩子买，关注耐用"],
];

interface Verified {
  checked: number;
  supported: string[];
  unsupported: string[];
}

interface Item {
  platform: PlatformId;
  label: string;
  reply: string;
  issues: { level: string; message: string }[];
  verified: Verified;
  edited?: boolean;
}

const TASK_BRIEF: Record<string, string> = {
  launch: "HUAWEI MateBook Pro S，通勤办公，预算8000",
  school: "MateBook 14 鸿蒙版，学生上网课，预算6000",
  weekend: "MateBook Pro S，门店到店体验，预算8000",
};

export default function Batch() {
  const [brief, setBrief] = useState("MateBook 14 鸿蒙版，学生上网课用，预算6000");
  const [persona, setPersona] = useState("clerk");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assets, setAssets] = useState<Record<string, ImageAsset[]>>({});
  const [imgLoading, setImgLoading] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [newModel, setNewModel] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newPoints, setNewPoints] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [rewriting, setRewriting] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const task = q.get("task");
    const presetBrief = q.get("brief");
    if (task && TASK_BRIEF[task]) setBrief(TASK_BRIEF[task]);
    else if (presetBrief) setBrief(presetBrief);
    if (q.get("import") === "1") setShowImport(true);
  }, []);

  const run = async () => {
    if (!brief.trim() || loading) return;
    setLoading(true);
    setError("");
    setAssets({});
    try {
      const r = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, persona }),
      });
      const text = await r.text();
      const d = text ? JSON.parse(text) : {};
      if (!r.ok) throw new Error(d.error || `生成失败（${r.status}）`);
      setItems(d.items);
      try {
        const prev = JSON.parse(localStorage.getItem("hc_recent") || "[]");
        const title = String(d.items[0]?.reply || "").split("\n")[0].slice(0, 40);
        localStorage.setItem(
          "hc_recent",
          JSON.stringify([{ brief, at: Date.now(), title }, ...prev].slice(0, 10)),
        );
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  };

  const updateText = (i: number, value: string) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, reply: value, edited: true } : it)));
  };

  const rewrite = async (i: number, instruction: string) => {
    const it = items[i];
    setRewriting(it.platform);
    try {
      const r = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: it.platform, text: it.reply, instruction, brief }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "改写失败");
      setItems((prev) =>
        prev.map((x, idx) =>
          idx === i ? { ...x, reply: d.reply, issues: d.issues || x.issues, verified: d.verified || x.verified, edited: true } : x,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "改写失败");
    } finally {
      setRewriting(null);
    }
  };

  const verify = async (i: number) => {
    const it = items[i];
    try {
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: it.reply, brief }),
      });
      const d = await r.json();
      if (r.ok) {
        setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, verified: d } : x)));
      }
    } catch {
      /* ignore */
    }
  };

  const copy = async (it: Item) => {
    if (it.verified.unsupported.length) return;
    await navigator.clipboard.writeText(it.reply).catch(() => {});
  };

  const makeImages = async (it: Item) => {
    const key = it.platform;
    setImgLoading(key);
    try {
      const lines = it.reply.split("\n").map((l) => l.trim()).filter(Boolean);
      const noTitle = it.platform === "moments";
      const title = noTitle ? "" : (lines[0] || "").slice(0, 30);
      const body = noTitle ? it.reply : lines.slice(1).join(" ");
      const price = (it.reply.match(/¥\s?[\d,]+/) || [])[0];

      const r = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: it.platform, title, body }),
      });
      const d = await r.json();
      let bg: HTMLImageElement | undefined;
      if (r.ok && d.dataUrl) {
        bg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = d.dataUrl;
        });
      }
      const imgs = renderPlatformImages(it.platform, { title, body, price }, bg);
      setAssets((prev) => ({ ...prev, [key]: imgs }));
    } catch {
      /* ignore */
    } finally {
      setImgLoading(null);
    }
  };

  const importProduct = async () => {
    if (!newModel.trim()) return;
    setImportMsg("");
    try {
      const r = await fetch("/api/facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: newModel.trim(),
          price: newPrice ? Number(newPrice) : null,
          points: newPoints.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "导入失败");
      setImportMsg(`已导入 ${d.rows.length} 条事实，可直接用于生成与核验`);
      setNewModel("");
      setNewPrice("");
      setNewPoints("");
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "导入失败");
    }
  };

  return (
    <div className="min-h-full bg-[#fbfaf7]">
      <header className="sticky top-0 z-20 border-b hairline bg-[#fbfaf7]">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-1 text-[12px] text-black/45 hover:text-black">
              <ArrowLeft className="h-3.5 w-3.5" /> 今天
            </a>
            <span className="text-[13px] font-semibold tracking-tight">内容工作台</span>
            <span className="text-[10.5px] text-black/35">同一份事实，四种说法</span>
          </div>
          <button
            onClick={() => setShowImport((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/12 bg-white px-3 py-1.5 text-[11.5px] text-black/55 hover:border-black/30"
          >
            <FilePlus2 className="h-3.5 w-3.5" /> 导入新品
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-5">
        {showImport && (
          <div className="mb-4 rounded-[16px] border border-black/8 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium">新品资料导入（发布会/官方页复制即可）</span>
              <button onClick={() => setShowImport(false)} className="text-black/30 hover:text-black/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1.2fr_.6fr]">
              <input
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="型号，如 HUAWEI MateBook Pro S"
                className="h-9 rounded-[10px] border border-black/10 px-3 text-[12.5px] outline-none focus:border-black/30"
              />
              <input
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="官方价，如 9999"
                className="h-9 rounded-[10px] border border-black/10 px-3 text-[12.5px] outline-none focus:border-black/30"
              />
            </div>
            <textarea
              value={newPoints}
              onChange={(e) => setNewPoints(e.target.value)}
              rows={3}
              placeholder={"卖点，一行一条：\n1.2kg 机身\n3.1K OLED 触控屏\n续航 12 小时"}
              className="mt-2 w-full resize-none rounded-[10px] border border-black/10 p-3 text-[12.5px] leading-relaxed outline-none focus:border-black/30"
            />
            <div className="mt-2 flex items-center gap-3">
              <button onClick={importProduct} className="rounded-full bg-black px-4 py-1.5 text-[12px] text-white">
                导入并立即可用
              </button>
              {importMsg && <span className="text-[11px] text-emerald-700">{importMsg}</span>}
            </div>
          </div>
        )}

        <div className="rounded-[18px] border border-black/8 bg-white p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-black/35">人设</span>
            {PERSONAS.map(([id, label, hint]) => (
              <button
                key={id}
                onClick={() => setPersona(id)}
                className={`rounded-full border px-3 py-1.5 text-[11.5px] transition ${
                  persona === id ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/50 hover:border-black/25"
                }`}
                title={hint}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              ["新品上市", "HUAWEI MateBook Pro S，通勤办公，预算8000"],
              ["开学季", "MateBook 14 鸿蒙版，学生上网课，预算6000"],
              ["周末到店", "MateBook Pro S，门店到店体验，预算8000"],
            ].map(([label, text]) => (
              <button
                key={label}
                onClick={() => setBrief(text)}
                className="rounded-full border border-black/10 bg-[#fbfaf7] px-2.5 py-1 text-[11px] text-black/45 hover:border-black/25 hover:text-black/70"
              >
                {label}
              </button>
            ))}
          </div>

          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={2}
            className="mt-3 w-full resize-none rounded-[12px] border border-black/10 bg-[#fbfaf7] p-3 text-[13px] leading-relaxed outline-none focus:border-black/25"
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={run}
              disabled={loading || !brief.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-[13px] text-white disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "生成中，约 10-20 秒…" : "一键生成 4 平台"}
            </button>
            <span className="text-[10.5px] text-black/30">同一条需求 → 四份文案 + 数字核验</span>
          </div>
          {error && <p className="mt-2 text-[11.5px] text-red-600">{error}</p>}
        </div>

        {items.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {items.map((it, i) => {
              const bad = it.verified.unsupported;
              const imgs = assets[it.platform];
              return (
                <section
                  key={it.platform}
                  className={`rounded-[16px] border bg-white p-4 ${
                    bad.length ? "border-red-500/35" : "border-black/8"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-black px-2.5 py-0.5 text-[10.5px] text-white">{it.label}</span>
                      <span className="text-[10.5px] text-black/30">{it.reply.length} 字</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[10.5px] ${
                          bad.length ? "text-red-600" : "text-emerald-700"
                        }`}
                      >
                        {bad.length ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                        {bad.length ? `未找到依据：${bad.join("、")}` : `数字可追溯 ${it.verified.supported.length}`}
                      </span>
                      <button
                        onClick={() => copy(it)}
                        disabled={bad.length > 0}
                        className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2.5 py-1 text-[10.5px] text-black/50 disabled:opacity-30"
                        title={bad.length ? "有未核实数字，禁止复制" : "复制"}
                      >
                        <Copy className="h-3 w-3" /> 复制
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={it.reply}
                    onChange={(e) => updateText(i, e.target.value)}
                    onBlur={() => it.edited && verify(i)}
                    rows={it.platform === "wechat-mp" ? 12 : it.platform === "poster" ? 6 : 8}
                    className="mt-2.5 w-full resize-y rounded-[12px] border border-black/8 bg-[#fbfaf7] p-3 text-[12.5px] leading-[1.75] text-black/80 outline-none focus:border-black/25"
                  />

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {[
                      ["更口语", "改得更口语、更像真人说话，短句为主"],
                      ["更专业", "改得更专业克制，适合门店顾问口吻"],
                      ["换个开头", "换一个更有钩子的开头，其余保持"],
                    ].map(([label, ins]) => (
                      <button
                        key={label}
                        onClick={() => rewrite(i, ins)}
                        disabled={rewriting === it.platform}
                        className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10.5px] text-black/45 hover:border-black/25 hover:text-black/70 disabled:opacity-40"
                      >
                        {rewriting === it.platform ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => makeImages(it)}
                      disabled={imgLoading === it.platform || bad.length > 0}
                      title={bad.length ? "有未核实数字，先修正再配图" : ""}
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/12 px-3 py-1.5 text-[11px] text-black/55 hover:border-black/30 disabled:opacity-40"
                    >
                      {imgLoading === it.platform ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {imgLoading === it.platform ? "生成实拍图…" : `AI 配图（${IMAGE_SPEC[it.platform].note}）`}
                    </button>
                    {imgs && (
                      <button
                        onClick={() => imgs.forEach((a, idx) => setTimeout(() => downloadAsset(a, idx), idx * 200))}
                        className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-[11px] text-black/45"
                      >
                        <Download className="h-3.5 w-3.5" /> 全部下载
                      </button>
                    )}
                    {bad.length > 0 ? (
                      <span className="ml-auto text-[10px] text-red-600">修正未核实数字后才能配图</span>
                    ) : (
                      it.issues.length > 0 && (
                        <span className="ml-auto text-[10px] text-amber-700">{it.issues.length} 条提示</span>
                      )
                    )}
                  </div>

                  {imgs && (
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {imgs.map((a, idx) => (
                        <img
                          key={idx}
                          src={a.dataUrl}
                          alt={a.label}
                          onClick={() => downloadAsset(a, idx)}
                          className="w-full cursor-pointer rounded-[8px] border border-black/8"
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
