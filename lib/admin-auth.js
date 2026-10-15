"use strict";

const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scryptAsync = promisify(crypto.scrypt);
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const SESSION_COOKIE_BASE = "fbi_hq_session";
const sessions = new Map();
const loginAttempts = new Map();

const ROLE_LABELS = Object.freeze({
  super_admin: "Super Administrator",
  administrator: "Administrator",
  manager: "Manager",
  viewer: "Read-Only Viewer"
});

const ROLE_PERMISSIONS = Object.freeze({
  super_admin: new Set(["system:read", "admin:read", "admin:write", "user:manage", "audit:read"]),
  administrator: new Set(["system:read", "admin:read", "admin:write", "audit:read"]),
  manager: new Set(["system:read", "admin:read"]),
  viewer: new Set(["system:read"])
});

function normaliseEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validScryptHash(value) {
  return /^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(String(value || ""));
}

async function createPasswordHash(password) {
  const value = String(password ?? "");
  if (value.length < 12) throw new Error("Password must contain at least 12 characters.");
  if (Buffer.byteLength(value, "utf8") > 1024) throw new Error("Password is too long.");
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(value, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return "scrypt$16384$8$1$" + salt.toString("hex") + "$" + Buffer.from(derived).toString("hex");
}

async function verifyPassword(password, encodedHash) {
  const parts = String(encodedHash || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== "16384" || parts[2] !== "8" || parts[3] !== "1") return false;
  const saltHex = parts[4], expectedHex = parts[5];
  if (!/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]{128}$/.test(expectedHex)) return false;
  const value = String(password ?? "");
  if (Buffer.byteLength(value, "utf8") > 1024) return false;
  const actual = Buffer.from(await scryptAsync(value, Buffer.from(saltHex, "hex"), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }));
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function readConfiguredUsers() {
  const raw = String(process.env.FBI_HQ_USERS_JSON || "");
  if (!raw) return { ok: false, reason: "not_configured", users: new Map() };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, reason: "invalid_json", users: new Map() }; }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100) return { ok: false, reason: "invalid_user_list", users: new Map() };

  const users = new Map();
  for (const item of parsed) {
    if (!item || typeof item !== "object") return { ok: false, reason: "invalid_user", users: new Map() };
    const email = normaliseEmail(item.email);
    const role = String(item.role || "");
    const passwordHash = String(item.passwordHash || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !ROLE_LABELS[role] || !validScryptHash(passwordHash) || users.has(email)) {
      return { ok: false, reason: "invalid_user", users: new Map() };
    }
    users.set(email, { email, role, passwordHash });
  }
  return { ok: true, users };
}

function permissionForRole(role, permission) {
  return !!ROLE_PERMISSIONS[role] && ROLE_PERMISSIONS[role].has(permission);
}

function credentialVersion(user) {
  return crypto.createHash("sha256").update(user.email + "\0" + user.role + "\0" + user.passwordHash).digest("hex");
}

function cookieName() {
  return process.env.NODE_ENV === "development" ? SESSION_COOKIE_BASE : "__Host-" + SESSION_COOKIE_BASE;
}

function shouldUseSecureCookie() {
  return process.env.NODE_ENV !== "development";
}

function setSessionCookie(res, rawToken, maxAgeSeconds = SESSION_TTL_SECONDS) {
  const parts = [cookieName() + "=" + (rawToken || ""), "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=" + Math.max(0, Math.floor(maxAgeSeconds))];
  if (shouldUseSecureCookie()) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || "");
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return "";
}

function tokenKey(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken)).digest("hex");
}

function pruneState(now = Date.now()) {
  for (const [key, value] of sessions) if (value.expiresAt <= now) sessions.delete(key);
  for (const [key, entries] of loginAttempts) {
    const fresh = entries.filter(ts => now - ts < LOGIN_WINDOW_MS);
    if (fresh.length) loginAttempts.set(key, fresh);
    else loginAttempts.delete(key);
  }
  if (sessions.size > 10000) {
    for (const [key, value] of sessions) {
      if (value.expiresAt <= now || sessions.size > 9000) sessions.delete(key);
    }
  }
  if (loginAttempts.size > 5000) {
    for (const key of loginAttempts.keys()) {
      loginAttempts.delete(key);
      if (loginAttempts.size <= 4000) break;
    }
  }
}

function clientAddress(req) {
  // Railway's reverse proxy appends the address closest to the application.
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",").map(x => x.trim()).filter(Boolean);
  return forwarded.length ? forwarded[forwarded.length - 1] : String(req.socket?.remoteAddress || "unknown");
}

function loginRateStatus(req, now = Date.now()) {
  pruneState(now);
  const key = clientAddress(req);
  const attempts = (loginAttempts.get(key) || []).filter(ts => now - ts < LOGIN_WINDOW_MS);
  loginAttempts.set(key, attempts);
  return { allowed: attempts.length < LOGIN_MAX_ATTEMPTS, retryAfterSeconds: attempts.length >= LOGIN_MAX_ATTEMPTS ? Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (now - attempts[0])) / 1000)) : 0 };
}

function noteLoginFailure(req, now = Date.now()) {
  const key = clientAddress(req);
  const attempts = (loginAttempts.get(key) || []).filter(ts => now - ts < LOGIN_WINDOW_MS);
  attempts.push(now);
  loginAttempts.set(key, attempts);
}

function clearLoginFailures(req) {
  loginAttempts.delete(clientAddress(req));
}

function createSession(res, user, now = Date.now()) {
  pruneState(now);
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const csrfToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  sessions.set(tokenKey(rawToken), {
    email: user.email,
    role: user.role,
    credentialVersion: credentialVersion(user),
    csrfToken,
    createdAt: now,
    expiresAt
  });
  setSessionCookie(res, rawToken, SESSION_TTL_SECONDS);
  return { email: user.email, role: user.role, roleLabel: ROLE_LABELS[user.role], csrfToken, expiresAt: new Date(expiresAt).toISOString() };
}

function getSession(req, now = Date.now()) {
  pruneState(now);
  const rawToken = readCookie(req, cookieName());
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(rawToken)) return null;
  const key = tokenKey(rawToken);
  const session = sessions.get(key);
  if (!session || session.expiresAt <= now) {
    sessions.delete(key);
    return null;
  }
  const directory = readConfiguredUsers();
  const currentUser = directory.ok ? directory.users.get(session.email) : null;
  if (!currentUser || currentUser.role !== session.role || credentialVersion(currentUser) !== session.credentialVersion) {
    sessions.delete(key);
    return null;
  }
  return {
    email: session.email,
    role: session.role,
    roleLabel: ROLE_LABELS[session.role],
    csrfToken: session.csrfToken,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString()
  };
}

function revokeSession(req) {
  const rawToken = readCookie(req, cookieName());
  if (rawToken) sessions.delete(tokenKey(rawToken));
}

function sameOriginRequest(req) {
  const origin = String(req.headers.origin || "");
  if (!origin || origin === "null") return false;
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  const host = String(req.headers.host || "").toLowerCase();
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  const protocol = forwardedProto === "https" || req.socket?.encrypted ? "https:" : "http:";
  if (parsed.host.toLowerCase() !== host || parsed.protocol !== protocol) return false;
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  return true;
}

function safeUser(session) {
  return { email: session.email, role: session.role, roleLabel: session.roleLabel };
}

module.exports = {
  SESSION_TTL_SECONDS,
  ROLE_LABELS,
  readConfiguredUsers,
  verifyPassword,
  createPasswordHash,
  permissionForRole,
  createSession,
  getSession,
  revokeSession,
  setSessionCookie,
  sameOriginRequest,
  loginRateStatus,
  noteLoginFailure,
  clearLoginFailures,
  safeUser
};
