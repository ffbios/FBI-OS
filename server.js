"use strict";

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const scryptAsync = promisify(crypto.scrypt);
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
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
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

function mediaObjectKey(pathname, prefix) {
  const key = pathname.slice(prefix.length);
  if (!key.startsWith("assets/") || key.length > 512 || key.includes("\\") || key.split("/").some(part => !part || part === "." || part === "..")) return null;
  return key;
}

function signedBucketRequest(method, key, contentType, contentLength, range) {
  const endpoint = new URL(String(process.env.MEDIA_ENDPOINT || ""));
  const bucket = String(process.env.MEDIA_BUCKET || "");
  const region = String(process.env.MEDIA_REGION || "auto");
  const accessKeyId = String(process.env.MEDIA_ACCESS_KEY_ID || "");
  const secretAccessKey = String(process.env.MEDIA_SECRET_ACCESS_KEY || "");
  if (endpoint.protocol !== "https:" || !bucket || !accessKeyId || !secretAccessKey) throw new Error("Media storage is not configured.");

  const hostname = bucket + "." + endpoint.hostname;
  const host = hostname + (endpoint.port ? ":" + endpoint.port : "");
  const pathPrefix = endpoint.pathname.replace(/\/+$/, "");
  const objectPath = pathPrefix + "/" + key.split("/").map(encodeURIComponent).join("/");
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = method === "PUT" ? "UNSIGNED-PAYLOAD" : crypto.createHash("sha256").update("").digest("hex");
  const signedHeaders = method === "PUT"
    ? "content-type;host;x-amz-content-sha256;x-amz-date"
    : "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = method === "PUT"
    ? "content-type:" + contentType.trim() + "\n" + "host:" + host + "\n" + "x-amz-content-sha256:" + payloadHash + "\n" + "x-amz-date:" + amzDate + "\n"
    : "host:" + host + "\n" + "x-amz-content-sha256:" + payloadHash + "\n" + "x-amz-date:" + amzDate + "\n";
  const canonicalRequest = [method, objectPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = dateStamp + "/" + region + "/s3/aws4_request";
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const hmac = (secret, value) => crypto.createHmac("sha256", secret).update(value, "utf8").digest();
  const dateKey = hmac(Buffer.from("AWS4" + secretAccessKey, "utf8"), dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const headers = {
    Host: host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    Authorization: "AWS4-HMAC-SHA256 Credential=" + accessKeyId + "/" + scope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature
  };
  if (method === "PUT") {
    headers["Content-Type"] = contentType;
    headers["Content-Length"] = String(contentLength);
  }
  if (range) headers.Range = range;
  return { hostname, port: endpoint.port ? Number(endpoint.port) : 443, path: objectPath, method, headers };
}

function proxyMediaObject(req, res, key, method = "GET") {
  let options;
  try {
    const contentType = String(req.headers["content-type"] || "application/octet-stream").split(";")[0];
    options = signedBucketRequest(method, key, contentType, req.headers["content-length"], req.headers.range);
  } catch {
    return json(res, 503, { ok: false, error: "Media storage is unavailable." });
  }
  const upstream = https.request(options, upstreamRes => {
    const status = Number(upstreamRes.statusCode || 502);
    if (method === "PUT") {
      upstreamRes.resume();
      upstreamRes.on("end", () => {
        if (status >= 200 && status < 300) return json(res, 201, { ok: true, key });
        return json(res, 502, { ok: false, error: "Media upload failed." });
      });
      return;
    }
    if (status >= 400) {
      upstreamRes.resume();
      return json(res, status === 404 ? 404 : 502, { ok: false, error: status === 404 ? "Not found." : "Media is temporarily unavailable." });
    }
    const extension = path.extname(key).toLowerCase();
    const headers = {
      "Content-Type": upstreamRes.headers["content-type"] || mime[extension] || "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff"
    };
    for (const header of ["content-length", "content-range", "etag", "last-modified"]) {
      if (upstreamRes.headers[header]) headers[header] = upstreamRes.headers[header];
    }
    res.writeHead(status, headers);
    if (method === "HEAD") {
      upstreamRes.resume();
      return res.end();
    }
    upstreamRes.on("error", () => res.destroy());
    upstreamRes.pipe(res);
  });
  upstream.on("error", () => {
    if (res.headersSent) return res.destroy();
    return json(res, 502, { ok: false, error: "Media is temporarily unavailable." });
  });
  if (method === "PUT") req.pipe(upstream);
  else upstream.end();
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

  if (pathname.startsWith("/media/") && (req.method === "GET" || req.method === "HEAD")) {
    const key = mediaObjectKey(pathname, "/media/");
    if (!key) return json(res, 404, { ok: false, error: "Not found." });
    return proxyMediaObject(req, res, key, req.method);
  }

  if (pathname.startsWith("/api/media-upload/") && req.method === "PUT") {
    const token = String(process.env.MEDIA_UPLOAD_TOKEN || "");
    const authorization = String(req.headers.authorization || "");
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token || !safeTokenEqual(suppliedToken, token)) return json(res, 401, { ok: false, error: "Upload authorization required." });
    const key = mediaObjectKey(pathname, "/api/media-upload/");
    if (!key) return json(res, 400, { ok: false, error: "Invalid media path." });
    const length = Number(req.headers["content-length"]);
    if (!Number.isSafeInteger(length) || length < 1 || length > 400 * 1024 * 1024) return json(res, 413, { ok: false, error: "Invalid media size." });
    return proxyMediaObject(req, res, key, "PUT");
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
      try { await scryptAsync(password, Buffer.alloc(16, 1), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }); } catch {}
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

  if (path.extname(file).toLowerCase() === ".mp4" && req.headers.range) {
    fs.stat(file, (statErr, stats) => {
      if (statErr || !stats.isFile()) return json(res, 404, { ok: false, error: "Not found." });
      const size = stats.size;
      const match = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range));
      if (!match) {
        res.writeHead(416, { "Content-Range": "bytes */" + size, "Accept-Ranges": "bytes" });
        return res.end();
      }
      let start;
      let end;
      if (match[1] === "") {
        const suffixLength = Number(match[2]);
        start = Math.max(size - suffixLength, 0);
        end = size - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || start > end) {
        res.writeHead(416, { "Content-Range": "bytes */" + size, "Accept-Ranges": "bytes" });
        return res.end();
      }
      res.writeHead(206, {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Range": "bytes " + start + "-" + end + "/" + size,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff"
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file, { start, end }).on("error", () => {
        if (!res.headersSent) return json(res, 500, { ok: false, error: "Video unavailable." });
        res.destroy();
      }).pipe(res);
    });
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      // Missing pages get a real 404 page (not the homepage), so search engines don't index duplicates.
      if (pathname.startsWith("/api/")) return json(res, 404, { ok: false, error: "Not found." });
      fs.readFile(path.join(root, "404.html"), (fallbackErr, fallbackData) => {
        if (fallbackErr) return json(res, 404, { ok: false, error: "Not found." });
        res.writeHead(404, { "Content-Type": mime[".html"], "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
        res.end(fallbackData);
      });
      return;
    }

    const contentType = mime[path.extname(file).toLowerCase()] || "application/octet-stream";
    const noStore = pathname.startsWith("/admin/") || path.extname(file).toLowerCase() === ".html";
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

