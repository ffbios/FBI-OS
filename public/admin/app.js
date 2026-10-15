"use strict";

const app = document.getElementById("app");
let currentUser = null;
let csrfToken = "";
let systems = [];
let healthById = {};
let healthCheckedAt = null;
let healthLoading = false;

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function ghTime(value) {
  if (!value) return "Not checked";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra"
  }).format(date) + " GMT";
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body && !((options.headers || {})["Content-Type"]) ? { "Content-Type": "application/json" } : {})
    }
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return { response, data };
}

async function loadCurrentSession() {
  try {
    const { response, data } = await requestJson("/api/auth/me");
    if (!response.ok || !data.ok || !data.user) return false;
    currentUser = data.user;
    csrfToken = data.csrfToken || "";
    return true;
  } catch {
    return false;
  }
}

function login(message = "") {
  currentUser = null;
  csrfToken = "";
  app.innerHTML = `<div class="auth"><section class="auth-card">
    <div class="brand"><div class="mark">FBI</div><div><strong>FBI Digital HQ</strong><small>Film Beyond Imagination</small></div></div>
    <h1>Secure sign in</h1>
    <p class="muted">Use the account assigned to you by the FBI system administrator. Accounts are managed server-side. Public registration and browser-based password recovery are disabled.</p>
    <form id="loginForm" autocomplete="on">
      <div class="field"><label for="email">Work email</label><input id="email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn gold full" type="submit" id="loginButton">Sign in</button>
      <div id="loginError" class="error" role="alert">${esc(message)}</div>
    </form>
    <p class="login-note">Your session is verified by the server. This browser does not store your password.</p>
  </section></div>`;

  document.getElementById("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = document.getElementById("loginButton");
    const error = document.getElementById("loginError");
    button.disabled = true;
    button.textContent = "Verifying…";
    error.textContent = "";
    try {
      const { response, data } = await requestJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") || "").trim(),
          password: String(form.get("password") || "")
        })
      });
      if (!response.ok || !data.ok) {
        error.textContent = data.error || "Sign-in failed. Check your credentials or contact the system administrator.";
        button.disabled = false;
        button.textContent = "Sign in";
        return;
      }
      currentUser = data.user;
      csrfToken = data.csrfToken || "";
      await renderDashboard();
    } catch {
      error.textContent = "The authentication service could not be reached. Check your connection and try again.";
      button.disabled = false;
      button.textContent = "Sign in";
    }
  });
}

async function loadRegistry() {
  try {
    const { response, data } = await requestJson("/api/ecosystem/registry");
    if (!response.ok || !Array.isArray(data.systems)) throw new Error("Registry unavailable");
    systems = data.systems;
    return true;
  } catch {
    systems = [];
    return false;
  }
}

function statusClass(status) {
  return ({
    Healthy: "health-healthy",
    Degraded: "health-degraded",
    Unavailable: "health-unavailable",
    Unknown: "health-unknown"
  })[status] || "health-unknown";
}

async function loadHealth() {
  if (healthLoading) return;
  healthLoading = true;
  const refresh = document.getElementById("refreshHealth");
  if (refresh) { refresh.disabled = true; refresh.textContent = "Checking…"; }
  const message = document.getElementById("healthMessage");
  if (message) message.textContent = "Checking configured health endpoints. Systems without a verified endpoint will show Unknown.";
  try {
    const { response, data } = await requestJson("/api/ecosystem/health");
    if (response.status === 401) {
      login("Your session has expired. Please sign in again.");
      return;
    }
    if (!response.ok || !data.ok) throw new Error(data.error || "Health report unavailable.");
    healthById = Object.fromEntries((data.systems || []).map(item => [item.systemId, item]));
    healthCheckedAt = data.checkedAt || null;
    renderHealthCards();
    if (message) message.textContent = "Last report: " + ghTime(healthCheckedAt) + ". Health is measured, not inferred from the last deployment.";
  } catch (error) {
    if (message) message.textContent = error.message || "The health report could not be loaded.";
    const grid = document.getElementById("healthGrid");
    if (grid) grid.innerHTML = '<div class="health-empty">Health report unavailable. No system is being marked Healthy without a current check.</div>';
  } finally {
    healthLoading = false;
    const btn = document.getElementById("refreshHealth");
    if (btn) { btn.disabled = false; btn.textContent = "Refresh checks"; }
  }
}

function renderHealthCards() {
  const grid = document.getElementById("healthGrid");
  if (!grid) return;
  const counts = { Healthy: 0, Degraded: 0, Unavailable: 0, Unknown: 0 };
  for (const system of systems) {
    const status = healthById[system.id]?.status || "Unknown";
    counts[status] = (counts[status] || 0) + 1;
  }
  const summary = document.getElementById("healthSummary");
  if (summary) {
    summary.innerHTML = Object.entries(counts).map(([status, count]) =>
      `<div class="summary-item"><span class="health-dot ${statusClass(status)}"></span><strong>${count}</strong><span>${esc(status)}</span></div>`
    ).join("");
  }

  grid.innerHTML = systems.map(system => {
    const health = healthById[system.id] || { status: "Unknown", reason: "No current check is available.", checkedAt: null };
    const canOpen = /^https:\/\//i.test(String(system.url || ""));
    return `<article class="system-card">
      <div class="system-card-top"><span class="system-category">${esc(system.category || "SYSTEM")}</span><span class="health-pill ${statusClass(health.status)}">${esc(health.status)}</span></div>
      <h3>${esc(system.name)}</h3>
      <p class="system-purpose">${esc(system.purpose || "")}</p>
      ${system.availabilityNote ? `<p class="module-note"><strong>Operational note:</strong> ${esc(system.availabilityNote)}</p>` : ""}
      <p class="health-reason">${esc(health.reason || "No diagnostic detail available.")}</p>
      <div class="health-meta"><span>Checked</span><strong>${esc(ghTime(health.checkedAt))}</strong></div>
      ${health.latencyMs !== null && health.latencyMs !== undefined ? `<div class="health-meta"><span>Response</span><strong>${Number(health.latencyMs)} ms</strong></div>` : ""}
      <div class="actions">${canOpen ? `<a class="btn gold" href="${esc(system.url)}" target="_blank" rel="noopener noreferrer">Open system</a>` : '<span class="muted">No launch URL configured</span>'}</div>
    </article>`;
  }).join("");
}

async function logout() {
  const button = document.getElementById("logoutButton");
  if (button) { button.disabled = true; button.textContent = "Signing out…"; }
  try {
    await requestJson("/api/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken }
    });
  } finally {
    currentUser = null;
    csrfToken = "";
    login("You have signed out.");
  }
}

async function renderDashboard() {
  await loadRegistry();
  const roleLabel = currentUser?.roleLabel || currentUser?.role || "Authenticated user";
  app.innerHTML = `<div class="top">
    <div class="brand"><div class="mark">FBI</div><div><strong>FBI Digital HQ</strong><small>Film Beyond Imagination</small></div></div>
    <div class="top-actions"><span class="user-badge"><strong>${esc(roleLabel)}</strong><small>${esc(currentUser?.email || "")}</small></span><button class="signout" id="logoutButton">Sign out</button></div>
  </div>
  <main class="content">
    <div class="hero"><div><div class="muted">ECOSYSTEM CONTROL CENTER</div><h1>Digital HQ</h1><p class="muted">A secure entry point for the FBI business, creative, broadcasting and technical systems.</p></div><span class="status">Server-verified session</span></div>
    <section class="health-overview">
      <div class="section-head"><div><div class="section-title">System health</div><h2>Live service checks</h2><p class="muted">A successful deployment is not the same as a healthy application. Each state below comes from a current endpoint check.</p></div><button class="btn ghost" id="refreshHealth">Refresh checks</button></div>
      <div id="healthSummary" class="health-summary"></div>
      <p id="healthMessage" class="muted health-message">Loading health report…</p>
      <div id="healthGrid" class="system-grid">${systems.length ? systems.map(s => `<div class="health-skeleton">${esc(s.name)}<span>Checking…</span></div>`).join("") : '<div class="health-empty">The system registry could not be loaded.</div>'}</div>
    </section>
    <section class="admin-box"><h2>Access and security</h2><p class="muted">Your role is enforced by the server. This account cannot create other accounts from the browser. User roles and password hashes are maintained in the deployment's protected <code>FBI_HQ_USERS_JSON</code> setting. Integration snapshots remain disabled until their upstream contracts and permissions are reviewed.</p><p class="muted">Times are shown in Africa/Accra. Systems without a verified health endpoint are shown as Unknown, never assumed to be Healthy.</p></section>
  </main>`;

  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("refreshHealth").addEventListener("click", loadHealth);
  renderHealthCards();
  await loadHealth();
}

async function boot() {
  const authenticated = await loadCurrentSession();
  if (authenticated) await renderDashboard();
  else login();
}

boot();
