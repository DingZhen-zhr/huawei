export type Platform = "xiaohongshu" | "moments" | "wechat-mp" | "poster" | "video";
export type Angle = "pain" | "avoidance" | "story";
export type TaskStatus = "queued" | "running" | "done" | "partial" | "failed" | "cancelled";

export interface StoreProfile {
  city?: string;
  address?: string;
  phone?: string;
  businessHours?: string;
  qrAssetUrl?: string;
  voiceTone?: string;
  voiceSamples?: string[];
}

export interface Store {
  id: string;
  code: string;
  name: string;
  status: string;
  demo: boolean;
  profile: StoreProfile;
}

export interface PriceSummary {
  min: number | null;
  max: number | null;
  status: "active" | "conflict" | "missing";
  label: string;
}

export interface Product {
  id: string;
  name: string;
  shortName: string;
  family: string;
  asset: string | null;
  hasAssets: boolean;
  snapshotDate: string;
  sourceStatus: string;
  price: PriceSummary;
  factCount: number;
  factStatus: "active" | "conflict";
}

export interface TaskCard {
  id: string;
  productId: string;
  productName: string;
  productShortName: string;
  productAsset: string;
  productFamily: string;
  title: string;
  scene: string;
  audience: string;
  target: string;
  reason: string;
  requiredDetailHint: string;
  hasAssets: boolean;
  factStatus: "active" | "conflict";
  priceLabel: string;
  snapshotDate: string;
  detailOptions: string[];
  audienceOptions: string[];
  targetOptions: string[];
  noPrice?: boolean;
}

export interface RecentTask {
  id: string;
  productName: string;
  productShortName: string;
  status: TaskStatus;
  progress: { stage: string; label: string; percent: number };
  createdAt: string;
  blockedCount: number;
  readyCount: number;
}

export interface TodayResponse {
  date: string;
  store: Store;
  tasks: TaskCard[];
  recent: RecentTask[];
}

export interface Fact {
  id: string;
  productId: string;
  model: string;
  field: string;
  value: string | number;
  unit?: string;
  conditions?: string;
  sourceId: string;
  sourceUrl?: string;
  sourceTitle: string;
  capturedAt: string;
  status: string;
  trustTier: number;
  excerpt?: string;
}

export interface VerificationClaim {
  type: string;
  text: string;
  value?: string | number;
  unit?: string;
  status: string;
  reason?: string;
  span?: { start: number; end: number };
  evidenceIds?: string[];
}

export interface Verification {
  status: "ready" | "blocked";
  blocked: boolean;
  claims: VerificationClaim[];
  reasons: string[];
  checkedAt: string;
}

export interface CopyQuality {
  issues: { type: string; term: string; sentence: string; suggestion: string }[];
  counts: { characters: number; emoji: number; exclamations: number };
  summary: string;
}

export interface ImagePlanItem {
  purpose: string;
  ratio: string;
  width: number;
  height: number;
  productAssetId: string;
  backgroundBrief: string;
  overlayText: string[];
  required: boolean;
}

export interface Variant {
  id: string;
  taskId: string;
  platform: Platform;
  angle: Angle;
  angleLabel: string;
  platformLabel: string;
  title?: string;
  summary?: string;
  body: string;
  tags?: string[];
  script?: string;
  shotList?: string[];
  cta: string;
  copyText: string;
  status: "writing" | "reviewing" | "blocked" | "ready" | "failed";
  verification: Verification;
  copyQuality: CopyQuality;
  editBurden: "none" | "light" | "heavy";
  recommended?: boolean;
  selected?: boolean;
  imagePlan: ImagePlanItem[];
  evidenceIds: string[];
  limitations: string[];
  verifiedAt?: string;
  audience: string;
  scene: string;
  target: string;
  model: string;
  priceIncluded?: boolean;
}

export interface ChannelSnapshot {
  platform: Platform;
  label: string;
  variants: Variant[];
  recommended: Variant | null;
  status: "waiting" | "ready" | "blocked";
}

export interface Conflict {
  id: string;
  productId: string;
  field: string;
  status: "open" | "resolved" | "ignored";
  reason: string;
  candidates: { value: number; unit: string; evidence: { sku?: string; priceType?: string; url?: string; capturedAt?: string }[] }[];
}

export interface TaskSnapshot {
  task: {
    id: string;
    status: TaskStatus;
    progress: { stage: string; label: string; percent: number; updatedAt?: string };
    productId: string;
    productName: string;
    productShortName: string;
    productAsset: string;
    audience: string;
    scene: string;
    target: string;
    realDetail: { text: string; source: string; confirmed: boolean };
    brief?: string;
    createdAt: string;
    updatedAt: string;
    generationMode: string;
  };
  variants: Variant[];
  channels: Record<Platform, ChannelSnapshot>;
  assets: ContentAsset[];
  evidence: Fact[];
  conflicts: Conflict[];
  progress: { stage: string; label: string; percent: number };
  errors: { platform?: string; label?: string; message: string; retryable?: boolean }[];
}

export interface ContentAsset {
  id: string;
  variantId: string;
  platform: Platform;
  index: number;
  width: number;
  height: number;
  status: "ready" | "failed" | "stale" | "unavailable";
  mode: "official-layout";
  error?: string;
  downloadUrl: string | null;
}

class ApiError extends Error {
  status: number;
  code?: string;
  detail?: unknown;
  constructor(message: string, status: number, code?: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(data?.error || `请求失败（${res.status}）`, res.status, data?.code, data?.detail);
  }
  return data as T;
}

export const api = {
  getMe: () => request<{ store: Store }>("/api/auth/me"),
  loginDemo: () => request<{ store: Store }>("/api/auth/demo", { method: "POST", body: "{}" }),
  loginStore: (storeCode: string, pin: string) =>
    request<{ store: Store }>("/api/auth/store", { method: "POST", body: JSON.stringify({ storeCode, pin }) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST", body: "{}" }),
  today: () => request<TodayResponse>("/api/tasks/today"),
  products: () => request<{ products: Product[]; taskCards: TaskCard[] }>("/api/products"),
  createTask: (body: {
    taskCardId?: string;
    productId?: string;
    audience?: string;
    scene?: string;
    target?: string;
    realDetail: { text: string; source: "sales_provided"; confirmed: true };
    questionAnswers?: Record<string, string>;
  }) => request<{ taskId: string; status: string }>("/api/content/tasks", { method: "POST", body: JSON.stringify(body) }),
  getTask: (id: string) => request<TaskSnapshot>(`/api/content/tasks/${id}`),
  generateImages: (taskId: string, variantId: string) => request<{ assets: ContentAsset[] }>(`/api/content/tasks/${encodeURIComponent(taskId)}/assets`, { method: "POST", body: JSON.stringify({ variantId }) }),
  downloadImage: (taskId: string, assetId: string) => binaryRequest(`/api/content/tasks/${encodeURIComponent(taskId)}/assets/${encodeURIComponent(assetId)}/download`),
  exportContent: (taskId: string, selections: Partial<Record<Platform, string>>) => binaryRequest(`/api/content/tasks/${encodeURIComponent(taskId)}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selections }) }),
  listTasks: () => request<{ tasks: RecentTask[] }>("/api/content/tasks"),
  retry: (taskId: string, platform: Platform) =>
    request<{ taskId: string; status: string }>(`/api/content/tasks/${taskId}/retry`, {
      method: "POST",
      body: JSON.stringify({ platform }),
    }),
  updateVariant: (taskId: string, variantId: string, patch: Partial<Variant>) =>
    request<{ variant: Variant }>(`/api/content/tasks/${taskId}/variants/${variantId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  rewrite: (taskId: string, variantId: string, instruction: string) =>
    request<{ variant: Variant; review: CopyQuality; verification: Verification; rewriteMode: string; model: string }>(
      `/api/content/variants/${variantId}/rewrite`,
      { method: "POST", body: JSON.stringify({ taskId, instruction }) },
    ),
  selectVariant: (taskId: string, variantId: string) =>
    request<{ ok: true }>(`/api/content/variants/${variantId}/select`, {
      method: "POST",
      body: JSON.stringify({ taskId }),
    }),
  saveProfile: (patch: StoreProfile) =>
    request<{ store: Store }>("/api/store/profile", { method: "PATCH", body: JSON.stringify(patch) }),
  adminLogin: (passcode: string) =>
    request<{ ok: true }>("/api/admin/login", { method: "POST", body: JSON.stringify({ passcode }) }),
  adminDemo: () => request<{ ok: true }>("/api/admin/demo", { method: "POST", body: "{}" }),
  adminOverview: () =>
    request<{ products: Product[]; conflicts: Conflict[]; tasks: RecentTask[] }>("/api/admin/overview"),
};

export { ApiError };

async function binaryRequest(url: string, init?: RequestInit): Promise<Blob> {
  const response = await fetch(url, { credentials: "include", ...init });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || `交付失败（${response.status}）`, response.status, data.code);
  }
  return response.blob();
}
