// 门店仓库：Supabase Postgres 优先；本地开发/测试回退到 server/data/runtime JSON。
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import {
  dbEnabled,
  dbFindStoreByCode,
  dbGetStoreById,
  dbInsertStore,
  dbListStores,
  dbUpdatePin,
  dbUpdateStoreProfile,
} from "./db.mjs";

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "runtime");
const FILE = path.join(DATA_DIR, "stores.json");
const DEMO_CODE = process.env.DEMO_STORE_CODE || "HUAWEI-001";
const DEMO_PIN = process.env.DEMO_STORE_PIN || "246810";
const isProduction = process.env.NODE_ENV === "production";
const demoMode = process.env.HC_DEMO_MODE === "true" || (!isProduction && process.env.HC_DEMO_MODE !== "false");

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

function localIdFor(code) {
  return `store:${createHash("sha1").update(String(code)).digest("hex").slice(0, 12)}`;
}

function makeDemoStore(id = localIdFor(DEMO_CODE)) {
  return {
    id,
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

function ensureLocalDemoStore() {
  const state = readState();
  let changed = false;
  if (!state.stores.length && demoMode) {
    state.stores.push(makeDemoStore());
    changed = true;
  }
  const demo = state.stores.find((s) => s.demo && s.code === DEMO_CODE);
  if (demo && demoMode && !verifyHash(DEMO_PIN, demo.pinHash)) {
    demo.pinHash = hashPin(DEMO_PIN);
    changed = true;
  }
  if (changed) writeState(state);
  return state;
}

export function getDemoCredentials() {
  if (!demoMode) return null;
  return { storeCode: DEMO_CODE, pin: DEMO_PIN, label: "演示门店" };
}

export async function findStoreByCode(code) {
  const clean = String(code || "").trim();
  if (!clean) return null;
  if (!dbEnabled()) {
    return ensureLocalDemoStore().stores.find((s) => s.code.toLowerCase() === clean.toLowerCase()) || null;
  }
  let store = await dbFindStoreByCode(clean);
  if (!store && demoMode && clean.toLowerCase() === DEMO_CODE.toLowerCase()) {
    store = await dbInsertStore(makeDemoStore(randomUUID()));
    if (!store) store = await dbFindStoreByCode(clean);
  }
  return store;
}

export function verifyStorePin(store, pin) {
  return Boolean(store && store.status === "active" && verifyHash(pin, store.pinHash));
}

export async function getStoreById(id) {
  if (!dbEnabled()) return ensureLocalDemoStore().stores.find((s) => s.id === id) || null;
  return dbGetStoreById(id);
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

export async function updateStoreProfile(id, patch = {}) {
  const allowed = ["city", "address", "phone", "businessHours", "qrAssetUrl", "voiceTone", "voiceSamples"];
  if (!dbEnabled()) {
    const state = ensureLocalDemoStore();
    const store = state.stores.find((s) => s.id === id);
    if (!store) throw new Error("门店不存在");
    const profile = { ...(store.profile || {}) };
    for (const key of allowed) if (patch[key] !== undefined) profile[key] = patch[key];
    store.profile = profile;
    store.updatedAt = new Date().toISOString();
    writeState(state);
    return publicStore(store);
  }
  const current = await dbGetStoreById(id);
  if (!current) throw new Error("门店不存在");
  const profile = { ...(current.profile || {}) };
  for (const key of allowed) if (patch[key] !== undefined) profile[key] = patch[key];
  const store = await dbUpdateStoreProfile(id, profile);
  return publicStore(store);
}

export async function addStore({ code, name, pin }) {
  if (!code || !name || !/^\d{4,6}$/.test(String(pin || ""))) throw new Error("门店码、名称和 4–6 位 PIN 必填");
  if (!dbEnabled()) {
    const state = ensureLocalDemoStore();
    if (state.stores.some((s) => s.code.toLowerCase() === String(code).toLowerCase())) throw new Error("门店码已存在");
    const store = {
      ...makeDemoStore(localIdFor(code)),
      id: localIdFor(code),
      code: String(code).trim(),
      name: String(name).trim(),
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
    };
    state.stores.push(store);
    writeState(state);
    return publicStore(store);
  }
  const store = {
    ...makeDemoStore(randomUUID()),
    code: String(code).trim(),
    name: String(name).trim(),
    pinHash: hashPin(pin),
    demo: false,
  };
  const created = await dbInsertStore(store);
  if (!created) throw new Error("门店码已存在");
  return publicStore(created);
}

export async function listStores() {
  if (!dbEnabled()) return ensureLocalDemoStore().stores.map(publicStore);
  return (await dbListStores()).map(publicStore);
}

export async function resetStorePin(id, pin) {
  if (!/^\d{4,6}$/.test(String(pin || ""))) throw new Error("PIN 需要 4–6 位数字");
  if (!dbEnabled()) {
    const state = ensureLocalDemoStore();
    const store = state.stores.find((s) => s.id === id);
    if (!store) throw new Error("门店不存在");
    store.pinHash = hashPin(pin);
    store.updatedAt = new Date().toISOString();
    writeState(state);
    return { ok: true };
  }
  await dbUpdatePin(id, hashPin(pin));
  return { ok: true };
}

export { demoMode };
