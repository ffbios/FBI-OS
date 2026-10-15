const KEY="fbi_admin_account_v1";const SESSION="fbi_admin_session_v1";
const modules=[
 {name:"Invoice Studio",desc:"Invoices, receipts, catalog and invoicing operations.",url:"https://invoice.fbigh.com/"},
 {name:"Client Files Studio",desc:"Client file sharing, uploads, downloads and delivery.",url:"https://fbi-client-file-studio-production.up.railway.app/"},
 {name:"IT Command Center",desc:"Installation monitoring, client locations and technical operations.",url:"#"},
 {name:"Management",desc:"Private management and operational administration.",url:"#"}
];
const qs=[
 "What was the name of your first school?",
 "What city were you born in?",
 "What was your childhood nickname?",
 "What was the name of your first pet?"
];
const app=document.getElementById("app");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
async function digest(value){const data=new TextEncoder().encode(value);const buf=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function account(){try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch{return null}}
function session(){return sessionStorage.getItem(SESSION)==="1"}
let modules = [];

async function loadModules() {
  try {
    const response = await fetch("/api/ecosystem/registry", { cache: "no-store" });
    if (!response.ok) throw new Error("Registry unavailable");
    const registry = await response.json();
    modules = Array.isArray(registry.systems) ? registry.systems : [];
  } catch {
    modules = [];
  }
}

async function shell() {
  await loadModules();
  app.innerHTML = `<div class="top"><div class="brand"><div class="mark">FBI</div><div><strong>FBI Digital HQ</strong><small>Film Beyond Imagination</small></div></div><button class="signout" id="out">Sign out</button></div>
  <main class="content">
    <div class="hero"><div><div class="muted">SYSTEM DIRECTORY</div><h1>FBI Digital HQ</h1><p class="muted">A central entry point for the separate FBI business and production systems.</p></div><span class="status">Browser-local preview gate</span></div>
    <div class="grid">${modules.length ? modules.map((m,i)=>`<article class="card"><div class="num">${String(i+1).padStart(2,"0")} · ${esc(m.category || "SYSTEM")}</div><h3>${esc(m.name)}</h3><p>${esc(m.purpose || "")}</p>${m.availabilityNote ? `<p class="module-note"><strong>Attention required:</strong> ${esc(m.availabilityNote)}</p>` : ""}<div class="actions">${m.url ? `<button class="btn gold" data-open="${esc(m.url)}">Open system</button>` : `<span class="muted">No URL configured</span>`}</div></article>`).join("") : `<article class="card"><h3>System registry unavailable</h3><p>The directory could not load its system registry. No live status is being inferred.</p></article>`}</div>
    <div class="section-title">Operational data access</div>
    <div class="admin-box"><h2>Cross-system snapshots are paused</h2><p class="muted">Invoice and file-delivery summaries will remain disabled until server-side administrator authentication and role checks are implemented. This prevents the hub from relaying private business data through a public endpoint.</p></div>
    <div class="section-title">Access control notice</div>
    <div class="admin-box"><h2>Local directory access only</h2><p class="muted">This sign-in gate is stored in this browser and is not a server-verified identity system. Each application must continue enforcing its own authentication. Do not use this gate to protect confidential records.</p><button class="btn ghost" id="resetAccount">Reset local access gate</button></div>
  </main>`;
  document.querySelectorAll("[data-open]").forEach(b => b.onclick = () => {
    const u = b.dataset.open;
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  });
  document.getElementById("out").onclick = () => { sessionStorage.removeItem(SESSION); render(); };
  document.getElementById("resetAccount").onclick = () => {
    if (confirm("Remove this browser's local directory access gate?")) {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(SESSION);
      render();
    }
  };
}

function login(){app.innerHTML=`<div class="auth"><section class="auth-card"><div class="brand"><div class="mark">FBI</div><div><strong>FBI Admin Hub</strong><small>Film Beyond Imagination</small></div></div><h1>Admin Hub preview sign in</h1><p class="muted">This browser-local gate only opens the system directory. It is not server-side administrator authentication.</p><form id="login"><div class="field"><label>Email or username</label><input name="id" autocomplete="username" required></div><div class="field"><label>Password</label><input type="password" name="pw" autocomplete="current-password" required></div><button class="btn gold full">Sign in</button><div id="err" class="error"></div></form><div class="row" style="margin-top:18px"><button class="link" id="forgot">Forgot password?</button><button class="link" id="create">Create local access gate</button></div></section></div>`;
document.getElementById("login").onsubmit=async e=>{e.preventDefault();const a=account(),f=new FormData(e.target),h=await digest(f.get("pw"));if(a&&String(f.get("id")).toLowerCase()===a.id.toLowerCase()&&h===a.password){sessionStorage.setItem(SESSION,"1");render()}else document.getElementById("err").textContent="Invalid administrator credentials."};document.getElementById("forgot").onclick=forgot;document.getElementById("create").onclick=create}
function create(){app.innerHTML=`<div class="auth"><section class="auth-card"><div class="brand"><div class="mark">FBI</div><div><strong>FBI Admin Hub</strong><small>Local directory access gate</small></div></div><h1>Create admin account</h1><p class="muted">Create a local access gate for the directory only. This does not create a server-side identity.</p><form id="createForm"><div class="field"><label>Username or email</label><input name="id" required></div><div class="field"><label>Password</label><input type="password" name="pw" minlength="8" required></div><div class="field"><label>Confirm password</label><input type="password" name="pw2" minlength="8" required></div><div class="field"><label>Security question</label><select name="q">${qs.map((x,i)=>`<option value="${i}">${esc(x)}</option>`).join("")}</select></div><div class="field"><label>Security answer</label><input name="a" required></div><button class="btn gold full">Create administrator</button><div id="err" class="error"></div></form><div style="margin-top:18px"><button class="link" id="back">Back to sign in</button></div></section></div>`;
document.getElementById("createForm").onsubmit=async e=>{e.preventDefault();if(account()){document.getElementById("err").textContent="An administrator already exists on this browser. Use password recovery instead.";return}const f=new FormData(e.target);if(f.get("pw")!==f.get("pw2")){document.getElementById("err").textContent="Passwords do not match.";return}const a={id:String(f.get("id")).trim(),password:await digest(f.get("pw")),q:Number(f.get("q")),answer:await digest(String(f.get("a")).trim().toLowerCase())};localStorage.setItem(KEY,JSON.stringify(a));sessionStorage.setItem(SESSION,"1");render()};document.getElementById("back").onclick=login}
function forgot(){const a=account();if(!a){create();return}app.innerHTML=`<div class="auth"><section class="auth-card"><div class="brand"><div class="mark">FBI</div><div><strong>FBI Admin Hub</strong><small>Password recovery</small></div></div><h1>Reset password</h1><p class="muted">${esc(qs[a.q])}</p><form id="recover"><div class="field"><label>Security answer</label><input name="a" required></div><div class="field"><label>New password</label><input type="password" name="pw" minlength="8" required></div><div class="field"><label>Confirm password</label><input type="password" name="pw2" minlength="8" required></div><button class="btn gold full">Reset password</button><div id="err" class="error"></div></form><div style="margin-top:18px"><button class="link" id="back">Back to sign in</button></div></section></div>`;
document.getElementById("recover").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);if(f.get("pw")!==f.get("pw2")){document.getElementById("err").textContent="Passwords do not match.";return}if(await digest(String(f.get("a")).trim().toLowerCase())!==a.answer){document.getElementById("err").textContent="Security answer is incorrect.";return}a.password=await digest(f.get("pw"));localStorage.setItem(KEY,JSON.stringify(a));sessionStorage.setItem(SESSION,"1");render()};document.getElementById("back").onclick=login}
function render(){if(session()&&account())shell();else login()}render();