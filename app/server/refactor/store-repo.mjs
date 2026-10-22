// 本地门店仓库：开发环境持久化到 server/data/runtime；接上 Supabase 后可替换为 DB 仓储。
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const DATA_DIR = path.resolve(process.cwd(), "server", "data", "runtime");
const FILE = path.join(DATA_DIR, "stores.json");
const DEMO_CODE = process.env.DEMO_STORE_CODE || "HUAWEI-001";
const DEMO_PIN = process.env.DEMO_STORE_PIN || "246810";
const demoMode = process.env.HC_DEMO_MODE !== "false";

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readState() {
  ensureDir();
  if (!existsSync(FILE)) return { stores: [], version: 1 };
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf-8"));
    return { stores: Array.isArray(parsed.stores) ? parsed.stores : [], version: 1 };
  } catch {
    return { stores: [], version: 1 };
  }
}

function writeState(state) {
  ensureDir();
  const tmp = `${FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, FILE);
}

function hashPin(pin, salt = randomBytes(16).toString("hex")) {
  const digest = scryptSync(String(pin), salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

function verifyHash(pin, stored) {
  const [algo, salt, digest] = String(stored || "").split("$");
  if (algo !== "scrypt" || !salt || !digest) return false;
  const actual = scryptSync(String(pin), salt, 64);
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function idFor(code) {
  return `store:${createHash("sha1").update(String(code)).digest("hex").slice(0, 12)}`;
}

function makeDemoStore() {
  return {
    id: idFor(DEMO_CODE),
    code: DEMO_CODE,
    name: "华为体验店 · 演示门店",
    status: "active",
    pinHash: hashPin(DEMO_PIN),
    demo: true,
    profile: {
      city: "杭州",
      address: "",
      phone: "",
      businessHours: "10:00–22:00",
      qrAssetUrl: "",
      voiceTone: "直接、克制",
      voiceSamples: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function ensureDemoStore() {
  const state = readState();
  let changed = false;
  if (!state.stores.length && demoMode) {
    state.stores.push(makeDemoStore());
    changed = true;
  }
  // 开发环境如果换了演示 PIN，允许本地文件里的演示门店跟着更新。
  const demo = state.stores.find((s) => s.demo && s.code === DEMO_CODE);
  if (demo && demoMode) {
    const expected = hashPin(DEMO_PIN, "demo-fixed-salt");
    if (!demo.pinHash || !demo.pinHash.startsWith("scrypt$")) {
      demo.pinHash = expected;
      changed = true;
    }
  }
  if (changed) writeState(state);
  return state;
}

export function getDemoCredentials() {
  if (!demoMode) return null;
  return { storeCode: DEMO_CODE, pin: DEMO_PIN, label: "演示门店" };
}

export function findStoreByCode(code) {
  const clean = String(code || "").trim();
  if (!clean) return null;
  return ensureDemoStore().stores.find((s) => s.code.toLowerCase() === clean.toLowerCase()) || null;
}

export function verifyStorePin(store, pin) {
  return Boolean(store && store.status === "active" && verifyHash(pin, store.pinHash));
}

export function getStoreById(id) {
  return ensureDemoStore().stores.find((s) => s.id === id) || null;
}

export function publicStore(store) {
  if (!store) return null;
  return {
    id: store.id,
    code: store.code,
    name: store.name,
    status: store.status,
    demo: Boolean(store.demo),
    profile: store.profile || {},
  };
}

export function updateStoreProfile(id, patch = {}) {
  const state = ensureDemoStore();
  const store = state.stores.find((s) => s.id === id);
  if (!store) throw new Error("门店不存在");
  const allowed = ["city", "address", "phone", "businessHours", "qrAssetUrl", "voiceTone", "voiceSamples"];
  const profile = { ...(store.profile || {}) };
  for (const key of allowed) {
    if (patch[key] !== undefined) profile[key] = patch[key];
  }
  store.profile = profile;
  store.updatedAt = new Date().toISOString();
  writeState(state);
  return publicStore(store);
}

export function addStore({ code, name, pin }) {
  if (!code || !name || !/^\d{4,6}$/.test(String(pin || ""))) throw new Error("门店码、名称和 4–6 位 PIN 必填");
  const state = ensureDemoStore();
  if (state.stores.some((s) => s.code.toLowerCase() === String(code).toLowerCase())) {
    throw new Error("门店码已存在");
  }
  const store = {
    id: idFor(code),
    code: String(code).trim(),
    name: String(name).trim(),
    status: "active",
    pinHash: hashPin(pin),
    demo: false,
    profile: {
      city: "",
      address: "",
      phone: "",
      businessHours: "",
      qrAssetUrl: "",
      voiceTone: "直接、克制",
      voiceSamples: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.stores.push(store);
  writeState(state);
  return publicStore(store);
}

export function listStores() {
  return ensureDemoStore().stores.map(publicStore);
}

export function resetStorePin(id, pin) {
  if (!/^\d{4,6}$/.test(String(pin || ""))) throw new Error("PIN 需要 4–6 位数字");
  const state = ensureDemoStore();
  const store = state.stores.find((s) => s.id === id);
  if (!store) throw new Error("门店不存在");
  store.pinHash = hashPin(pin);
  store.updatedAt = new Date().toISOString();
  writeState(state);
  return { ok: true };
}

export { demoMode };
