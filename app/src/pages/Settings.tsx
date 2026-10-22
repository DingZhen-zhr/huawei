import { useState } from "react";
import { CircleAlert, LogOut, QrCode, Save, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/lib/store-context";
import { api, type StoreProfile } from "@/lib/api";

export default function Settings() {
  const { store, setStore, logout } = useStore();
  const [form, setForm] = useState<StoreProfile>({
    city: store.profile.city || "",
    address: store.profile.address || "",
    phone: store.profile.phone || "",
    businessHours: store.profile.businessHours || "",
    qrAssetUrl: store.profile.qrAssetUrl || "",
    voiceTone: store.profile.voiceTone || "直接、克制",
    voiceSamples: store.profile.voiceSamples || [],
  });
  const [samples, setSamples] = useState((store.profile.voiceSamples || []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const set = (key: keyof StoreProfile, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload: StoreProfile = {
        ...form,
        voiceSamples: samples.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3),
      };
      const result = await api.saveProfile(payload);
      setStore(result.store);
      setForm(result.store.profile);
      setSamples((result.store.profile.voiceSamples || []).join("\n"));
      setNotice("门店资料已保存。海报二维码和联系方式会按真实配置使用；没配置就留白。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[820px]">
        <header className="border-b border-[var(--line)] pb-5">
          <p className="mono text-[10px] text-[var(--muted-2)]">{store.code}</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] sm:text-[30px]">门店资料</h1>
          <p className="mt-1.5 text-[12.5px] leading-6 text-[var(--muted)]">只影响门店口吻、海报留白和联系方式，不会改动产品事实。</p>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <section className="surface p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">城市</span>
                <input className="field mt-1.5" value={form.city || ""} onChange={(e) => set("city", e.target.value)} placeholder="例如：杭州" />
              </label>
              <label className="block">
                <span className="field-label">营业时间</span>
                <input className="field mt-1.5" value={form.businessHours || ""} onChange={(e) => set("businessHours", e.target.value)} placeholder="例如：10:00–22:00" />
              </label>
              <label className="block sm:col-span-2">
                <span className="field-label">门店地址</span>
                <input className="field mt-1.5" value={form.address || ""} onChange={(e) => set("address", e.target.value)} placeholder="没有就留空，不生成占位地址" />
              </label>
              <label className="block">
                <span className="field-label">电话 / 企微</span>
                <input className="field mt-1.5" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="没有就留空" inputMode="tel" />
              </label>
              <label className="block">
                <span className="field-label">口吻</span>
                <select className="field mt-1.5" value={form.voiceTone || "直接、克制"} onChange={(e) => set("voiceTone", e.target.value)}>
                  <option>直接、克制</option>
                  <option>温和、耐心</option>
                  <option>简短、利落</option>
                  <option>专业、详细</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="field-label">真实二维码图片地址</span>
                <input className="field mt-1.5" value={form.qrAssetUrl || ""} onChange={(e) => set("qrAssetUrl", e.target.value)} placeholder="只填门店真实素材地址；没有就留空" />
              </label>
              <label className="block sm:col-span-2">
                <span className="field-label">历史文案样本（1–3 条，仅学表达，不复制原文）</span>
                <textarea
                  className="field mt-1.5 min-h-[112px] resize-y"
                  value={samples}
                  onChange={(e) => setSamples(e.target.value)}
                  placeholder={"每行一条门店真实文案。没有就留空。\n例如：这台机器我自己背过一周，通勤路上确实轻。注意不要写虚构体验。"}
                />
              </label>
            </div>

            {error && (
              <div className="mt-4 flex gap-2 border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-3 text-[11px] leading-5 text-[var(--danger)]">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
              </div>
            )}
            {notice && (
              <div className="mt-4 border border-[var(--success)]/20 bg-[var(--success-soft)] p-3 text-[11px] leading-5 text-[var(--success)]">
                {notice}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
              <p className="text-[10.5px] leading-5 text-[var(--muted)]">保存不会改变产品价格事实；价格冲突仍需管理员确认。</p>
              <button className="btn-primary shrink-0" onClick={() => void save()} disabled={saving}>
                {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Save className="h-4 w-4" />}
                {saving ? "保存中" : "保存门店资料"}
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="surface p-4">
              <div className="flex items-center gap-2 text-[12px] font-medium"><QrCode className="h-4 w-4 text-[var(--red)]" /> 二维码与地址</div>
              <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">没有真实配置时，海报只留白并提示，不会画一个假码。地址和电话也只在留空时显示“待配置”。</p>
            </div>
            <div className="surface p-4">
              <div className="flex items-center gap-2 text-[12px] font-medium"><ShieldCheck className="h-4 w-4 text-[var(--success)]" /> 门店隔离</div>
              <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">产品事实共享；门店资料、口吻、历史内容和二维码按门店隔离。</p>
            </div>
            <div className="border-t border-[var(--line)] pt-4">
              <button className="btn-quiet w-full justify-start" onClick={() => void logout()}>
                <LogOut className="h-4 w-4" /> 退出当前门店
              </button>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
