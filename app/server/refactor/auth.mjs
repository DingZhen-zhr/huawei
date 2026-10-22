// 门店与管理员会话：HttpOnly + SameSite=Lax + 签名 Cookie。
import { createHmac, timingSafeEqual } from "node:crypto";
import { getStoreById, demoMode } from "./store-repo.mjs";

const SECRET = process.env.HC_SESSION_SECRET || "dev-only-huacai-session-secret-change-me";
const STORE_COOKIE = "hc_store_session";
const ADMIN_COOKIE = "hc_admin_session";
const MAX_AGE = 7 * 24 * 60 * 60;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || (demoMode ? "huacai-admin" : "");

function encode(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function sign(value) {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

function createToken(payload) {
  const body = encode({ ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE });
  return `${body}.${sign(body)}`;
}

function verifyToken(token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookies(req) {
  const header = String(req.headers?.cookie || "");
  const out = {};
  for (const item of header.split(";")) {
    const i = item.indexOf("=");
    if (i > 0) out[item.slice(0, i).trim()] = decodeURIComponent(item.slice(i + 1).trim());
  }
  return out;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE * 1000,
  };
}

export function setStoreSession(res, storeId) {
  res.cookie(STORE_COOKIE, createToken({ scope: "store", sub: storeId }), cookieOptions());
}

export function setAdminSession(res) {
  res.cookie(ADMIN_COOKIE, createToken({ scope: "admin", sub: "admin" }), cookieOptions());
}

export function clearSessions(res) {
  res.clearCookie(STORE_COOKIE, { path: "/" });
  res.clearCookie(ADMIN_COOKIE, { path: "/" });
}

export function getStoreFromRequest(req) {
  const payload = verifyToken(cookies(req)[STORE_COOKIE]);
  if (!payload || payload.scope !== "store") return null;
  return getStoreById(payload.sub);
}

export function isAdminRequest(req) {
  const payload = verifyToken(cookies(req)[ADMIN_COOKIE]);
  return Boolean(payload && payload.scope === "admin");
}

export function verifyAdminPasscode(passcode) {
  if (!ADMIN_PASSCODE) return false;
  const a = Buffer.from(String(passcode || ""));
  const b = Buffer.from(ADMIN_PASSCODE);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireStore(req, res, next) {
  const store = getStoreFromRequest(req);
  if (!store) return res.status(401).json({ error: "请先输入门店码和 PIN", code: "STORE_AUTH_REQUIRED" });
  req.store = store;
  next();
}

export function requireAdmin(req, res, next) {
  if (!isAdminRequest(req)) return res.status(401).json({ error: "管理员未登录", code: "ADMIN_AUTH_REQUIRED" });
  next();
}

export function adminDemoEnabled() {
  return demoMode;
}
