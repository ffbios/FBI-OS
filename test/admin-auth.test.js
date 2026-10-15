"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const auth = require("../lib/admin-auth");

async function availablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function waitForServer(url, child) {
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error("Test server exited before becoming healthy.");
    try {
      const response = await fetch(url + "/health", { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not become healthy.");
}

test("Admin Hub server-side authentication and access control", async t => {
  const adminPassword = "Example-Admin-Password-12!";
  const viewerPassword = "Example-Viewer-Password-12!";
  const adminHash = await auth.createPasswordHash(adminPassword);
  const viewerHash = await auth.createPasswordHash(viewerPassword);
  assert.match(adminHash, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await auth.verifyPassword(adminPassword, adminHash), true);
  assert.equal(await auth.verifyPassword("wrong password", adminHash), false);
  assert.equal(auth.permissionForRole("super_admin", "user:manage"), true);
  assert.equal(auth.permissionForRole("administrator", "user:manage"), false);
  assert.equal(auth.permissionForRole("manager", "system:read"), true);
  assert.equal(auth.permissionForRole("viewer", "admin:read"), false);

  const port = await availablePort();
  const base = "http://127.0.0.1:" + port;
  const users = [
    { email: "admin@example.test", role: "super_admin", passwordHash: adminHash },
    { email: "viewer@example.test", role: "viewer", passwordHash: viewerHash }
  ];
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "development",
      FBI_HQ_USERS_JSON: JSON.stringify(users)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let serverLogs = "";
  child.stdout.on("data", chunk => { serverLogs += chunk.toString(); });
  child.stderr.on("data", chunk => { serverLogs += chunk.toString(); });

  t.after(async () => {
    if (child.exitCode === null) child.kill("SIGTERM");
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 2000).unref();
    });
  });

  await waitForServer(base, child).catch(error => { throw new Error(error.message + "\n" + serverLogs); });

  async function postLogin(email, password, includeOrigin = true) {
    const headers = { "Content-Type": "application/json" };
    if (includeOrigin) headers.Origin = base;
    return fetch(base + "/api/auth/login", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password })
    });
  }

  await t.test("health endpoint is public and timestamped", async () => {
    const response = await fetch(base + "/health");
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.service, "fbi-os-website");
    assert.ok(payload.time);
  });

  await t.test("registry contains non-sensitive directory data", async () => {
    const response = await fetch(base + "/api/ecosystem/registry");
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(payload.systems));
    assert.ok(payload.systems.some(item => item.id === "invoice-studio"));
    assert.equal(JSON.stringify(payload).includes("passwordHash"), false);
  });

  await t.test("session endpoint rejects unauthenticated users", async () => {
    const response = await fetch(base + "/api/auth/me");
    assert.equal(response.status, 401);
  });

  await t.test("login requires a same-origin request", async () => {
    const response = await postLogin("admin@example.test", adminPassword, false);
    assert.equal(response.status, 403);
  });

  let adminCookie = "";
  let adminCsrf = "";

  await t.test("valid credentials create an HttpOnly session", async () => {
    const response = await postLogin("ADMIN@example.test", adminPassword);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.user.email, "admin@example.test");
    assert.equal(payload.user.role, "super_admin");
    assert.ok(payload.csrfToken);
    const setCookie = response.headers.get("set-cookie") || "";
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    assert.match(setCookie, /Max-Age=28800/i);
    adminCookie = setCookie.split(";")[0];
    adminCsrf = payload.csrfToken;
    const me = await fetch(base + "/api/auth/me", { headers: { Cookie: adminCookie } });
    assert.equal(me.status, 200);
    const session = await me.json();
    assert.equal(session.user.roleLabel, "Super Administrator");
    assert.equal(session.csrfToken, adminCsrf);
  });

  await t.test("unauthenticated users cannot request system health or admin snapshots", async () => {
    assert.equal((await fetch(base + "/api/ecosystem/health")).status, 401);
    assert.equal((await fetch(base + "/api/admin/invoice-snapshot")).status, 401);
  });

  await t.test("viewer role cannot read administrative snapshots", async () => {
    const login = await postLogin("viewer@example.test", viewerPassword);
    const loginPayload = await login.json();
    assert.equal(login.status, 200);
    assert.equal(loginPayload.user.role, "viewer");
    const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
    const response = await fetch(base + "/api/admin/files-snapshot", { headers: { Cookie: cookie } });
    assert.equal(response.status, 403);
  });

  await t.test("logout requires CSRF token and revokes the session", async () => {
    const denied = await fetch(base + "/api/auth/logout", {
      method: "POST",
      headers: { Origin: base, Cookie: adminCookie, "x-csrf-token": "wrong" }
    });
    assert.equal(denied.status, 403);

    const success = await fetch(base + "/api/auth/logout", {
      method: "POST",
      headers: { Origin: base, Cookie: adminCookie, "x-csrf-token": adminCsrf }
    });
    assert.equal(success.status, 200);

    const me = await fetch(base + "/api/auth/me", { headers: { Cookie: adminCookie } });
    assert.equal(me.status, 401);
  });
});
