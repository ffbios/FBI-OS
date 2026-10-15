"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const auth = require("./lib/admin-auth");

const PORT = Number(process.env.PORT || 3000);
const root = path.join(__dirname, "public");
const REGISTRY_PATH = path.join(__dirname, "ecosystem", "registry.json");
const MAX_JSON_BODY_BYTES = 8192;
const HEALTH_TIMEOUT_MS = 4500;
const HEALTH_BODY_MAX_BYTES = 8192;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function noContent(res, extraHeaders = {}) {
  res.writeHead(204, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders });
  res.end();
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    req.setEncoding("utf8");
    req.on("data", chunk => {
      bytes += Buffer.byteLength(chunk, "utf8");
      if (bytes > MAX_JSON_BODY_BYTES) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        req.resume();
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reject(Object.assign(new Error("JSON body must be an object."), { statusCode: 400 }));
        resolve(parsed);
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function safeTokenEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function currentSession(req) {
  return auth.getSession(req);
}

function requestAudit(event, session, requestId, detail = {}) {
  // Deliberately exclude passwords, cookies, CSRF tokens, IPs and upstream bodies.
  console.log(JSON.stringify({
    type: "fbi-hq-audit",
    event,
    requestId,
    at: new Date().toISOString(),
    actor: session ? session.email : null,
    role: session ? session.role : null,
    ...detail
  }));
}

function requirePermission(req, res, permission) {
  const session = currentSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: "Sign-in required." });
    return null;
  }
  if (!auth.permissionForRole(session.role, permission)) {
    json(res, 403, { ok: false, error: "You do not have permission to perform this action." });
    return null;
  }
  return session;
}

function readRegistry() {
  const raw = fs.readFileSync(REGISTRY_PATH, "utf8");
  const registry = JSON.parse(raw);
  if (!Array.isArray(registry.systems)) throw new Error("Invalid ecosystem registry.");
  return registry;
}

function approvedHealthTarget(raw) {
  try {
    const target = new URL(String(raw || ""));
    const host = target.hostname.toLowerCase();
    const approvedHost = host === "fbigh.com" || host.endsWith(".fbigh.com") || host.endsWith(".up.railway.app");
    if (target.protocol !== "https:" || !approvedHost || target.username || target.password || (target.port && target.port !== "443") || target.hash) return null;
    return target;
  } catch {
    return null;
  }
}

async function readBodyLimited(response) {
  if (!response.body || typeof response.body.getReader !== "function") return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let output = "";
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > HEALTH_BODY_MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
      output += decoder.decode(part.value, { stream: true });
    }
    output += decoder.decode();
    return output;
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

async function inspectSystemHealth(system) {
  const checkedAt = new Date().toISOString();
  const base = { systemId: system.id, name: system.name, checkedAt, latencyMs: null };
  const target = approvedHealthTarget(system.healthUrl);
  if (!target) {
    return { ...base, status: "Unknown", reason: "No verified health endpoint is configured." };
  }

  const started = Date.now();
  try {
    const response = await fetch(target, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS)
    });
    const latencyMs = Date.now() - started;
    if (response.status < 200 || response.status >= 300) {
      await response.body?.cancel().catch(() => {});
      return {
        ...base,
        latencyMs,
        status: response.status >= 500 ? "Unavailable" : "Degraded",
        reason: "Health endpoint returned HTTP " + response.status + "."
      };
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const raw = await readBodyLimited(response);
      let data = null;
      try { data = JSON.parse(raw); } catch {}
      if (data && (data.ok === false || data.status === "degraded" || data.storage === "not-ready")) {
        return { ...base, latencyMs, status: "Degraded", reason: data.storage === "not-ready" ? "Application is responding, but its storage is not ready." : "Health response reported a dependency or application issue." };
      }
    } else {
      await response.body?.cancel().catch(() => {});
    }
    return { ...base, latencyMs, status: "Healthy", reason: "Health endpoint responded successfully." };
  } catch (error) {
    const timedOut = error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ...base,
      latencyMs: Date.now() - started,
      status: "Unavailable",
      reason: timedOut ? "Health check timed out." : "Health endpoint could not be reached."
    };
  }
}

async function ecosystemHealthReport() {
  const registry = readRegistry();
  const systems = await Promise.all(registry.systems.map(inspectSystemHealth));
  const counts = { Healthy: 0, Degraded: 0, Unavailable: 0, Unknown: 0 };
  for (const item of systems) counts[item.status] = (counts[item.status] || 0) + 1;
  return { ok: true, checkedAt: new Date().toISOString(), summary: counts, systems };
}

const server = http.createServer(async (req, res) => {
  const requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");

  let url;
  try {
    url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  } catch {
    json(res, 400, { ok: false, error: "Invalid request URL." });
    return;
  }

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch {
    json(res, 400, { ok: false, error: "Invalid request path." });
    return;
  }

  if (pathname === "/health") {
    return json(res, 200, { ok: true, status: "ok", service: "fbi-os-website", time: new Date().toISOString() });
  }

  if (pathname === "/api/ecosystem/registry" && req.method === "GET") {
    fs.readFile(REGISTRY_PATH, "utf8", (err, data) => {
      if (err) return json(res, 503, { ok: false, error: "Ecosystem registry is unavailable." });
      try {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed.systems)) throw new Error("Invalid registry");
        return json(res, 200, parsed);
      } catch {
        return json(res, 503, { ok: false, error: "Ecosystem registry is invalid." });
      }
    });
    return;
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    if (!auth.sameOriginRequest(req)) return json(res, 403, { ok: false, error: "Same-origin request required." });
    if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) {
      return json(res, 415, { ok: false, error: "Content-Type must be application/json." });
    }
    const rate = auth.loginRateStatus(req);
    if (!rate.allowed) return json(res, 429, { ok: false, error: "Too many sign-in attempts. Try again later." }, { "Retry-After": String(rate.retryAfterSeconds) });

    let body;
    try { body = await readJsonBody(req); }
    catch (error) { return json(res, error.statusCode || 400, { ok: false, error: error.message || "Invalid request." }); }

    const directory = auth.readConfiguredUsers();
    if (!directory.ok) {
      console.error(JSON.stringify({ type: "fbi-hq-audit", event: "login_unavailable", requestId, at: new Date().toISOString(), reason: "user_directory_not_configured_or_invalid" }));
      return json(res, 503, { ok: false, error: "Administrator sign-in is not configured. Contact the system owner." });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password || password.length > 1024) {
      auth.noteLoginFailure(req);
      return json(res, 401, { ok: false, error: "Invalid email or password." });
    }

    const user = directory.users.get(email);
    let passwordValid = false;
    if (user) {
      try { passwordValid = await auth.verifyPassword(password, user.passwordHash); }
      catch (error) { console.error("FBI HQ password verification failed:", error.message); }
    } else {
      // Spend comparable work for an unknown account to reduce account-enumeration timing differences.
      try { await crypto.promisify(crypto.scrypt)(password, Buffer.alloc(16, 1), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }); } catch {}
    }

    if (!user || !passwordValid) {
      auth.noteLoginFailure(req);
      requestAudit("login_denied", null, requestId);
      return json(res, 401, { ok: false, error: "Invalid email or password." });
    }

    auth.clearLoginFailures(req);
    const session = auth.createSession(res, user);
    requestAudit("login_succeeded", session, requestId);
    return json(res, 200, { ok: true, user: auth.safeUser(session), csrfToken: session.csrfToken, expiresAt: session.expiresAt });
  }

  if (pathname === "/api/auth/me" && req.method === "GET") {
    const session = currentSession(req);
    if (!session) return json(res, 401, { ok: false, error: "Sign-in required." });
    return json(res, 200, { ok: true, user: auth.safeUser(session), csrfToken: session.csrfToken, expiresAt: session.expiresAt });
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    if (!auth.sameOriginRequest(req)) return json(res, 403, { ok: false, error: "Same-origin request required." });
    const session = currentSession(req);
    if (session && !safeTokenEqual(req.headers["x-csrf-token"], session.csrfToken)) {
      return json(res, 403, { ok: false, error: "CSRF verification failed." });
    }
    if (session) requestAudit("logout", session, requestId);
    auth.revokeSession(req);
    auth.setSessionCookie(res, "", 0);
    return json(res, 200, { ok: true });
  }

  if (pathname === "/api/ecosystem/health" && req.method === "GET") {
    const session = requirePermission(req, res, "system:read");
    if (!session) return;
    try {
      const report = await ecosystemHealthReport();
      requestAudit("health_report_viewed", session, requestId, { healthSummary: report.summary });
      return json(res, 200, report);
    } catch (error) {
      console.error("FBI HQ health report failed:", error.message);
      return json(res, 503, { ok: false, error: "Health report is temporarily unavailable." });
    }
  }

  // The cross-system snapshots stay disabled. Even authorised users get no
  // upstream data until a documented API contract and permission checks are tested.
  if (pathname === "/api/admin/invoice-snapshot" || pathname === "/api/admin/files-snapshot") {
    const session = requirePermission(req, res, "admin:read");
    if (!session) return;
    return json(res, 503, { ok: false, error: "The snapshot integration is paused until its protected API contract is implemented." });
  }

  if (pathname === "/") pathname = "/index.html";
  if ((pathname === "/admin" || pathname === "/admin/") && req.method === "GET") pathname = "/admin/index.html";

  const file = path.resolve(root, "." + pathname);
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return json(res, 403, { ok: false, error: "Forbidden." });

  fs.readFile(file, (err, data) => {
    if (err) {
      // Keep the corporate homepage fallback limited to browser navigation, not APIs.
      if (pathname.startsWith("/api/")) return json(res, 404, { ok: false, error: "Not found." });
      fs.readFile(path.join(root, "index.html"), (fallbackErr, fallbackData) => {
        if (fallbackErr) return json(res, 500, { ok: false, error: "Website unavailable." });
        res.writeHead(200, { "Content-Type": mime[".html"], "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
        res.end(fallbackData);
      });
      return;
    }

    const contentType = mime[path.extname(file).toLowerCase()] || "application/octet-stream";
    const noStore = pathname.startsWith("/admin/");
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": noStore || pathname === "/index.html" ? "no-cache" : "public, max-age=86400",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("FBI GH website listening on port " + PORT);
});
