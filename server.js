const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const root = path.join(__dirname, "public");
const INVOICE_API_BASE_URL = (process.env.INVOICE_API_BASE_URL || "https://invoice.fbigh.com").replace(/\\/+$/, "");
const FILES_API_BASE_URL = (process.env.FILES_API_BASE_URL || "https://files.fbigh.com").replace(/\\/+$/, "");
const FBI_ADMIN_SHARED_TOKEN = String(process.env.FBI_ADMIN_SHARED_TOKEN || "");


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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/health") {
    res.writeHead(200, {"Content-Type":"application/json; charset=utf-8"});
    res.end(JSON.stringify({status:"ok", service:"fbi-os-website"}));
    return;
  }

  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin/index.html";
  if (pathname === "/api/admin/invoice-snapshot") {
    if (!FBI_ADMIN_SHARED_TOKEN) { res.writeHead(503, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false,error:"Admin integration is not configured."})); }
    try {
      const upstream = await fetch(INVOICE_API_BASE_URL + "/api/admin/snapshot", {headers: {"x-fbi-admin-token": FBI_ADMIN_SHARED_TOKEN}});
      const body = await upstream.text();
      res.writeHead(upstream.status, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"});
      return res.end(body);
    } catch (err) {
      res.writeHead(502, {"Content-Type":"application/json"});
      return res.end(JSON.stringify({ok:false,error:"Invoice Studio is unreachable."}));
    }
  }

  if (pathname === "/api/admin/files-snapshot") {
    if (!FBI_ADMIN_SHARED_TOKEN) { res.writeHead(503, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false,error:"Admin integration is not configured."})); }
    try {
      const upstream = await fetch(FILES_API_BASE_URL + "/api/admin/snapshot", {headers: {"x-fbi-admin-token": FBI_ADMIN_SHARED_TOKEN}});
      const body = await upstream.text();
      res.writeHead(upstream.status, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"});
      return res.end(body);
    } catch (err) {
      res.writeHead(502, {"Content-Type":"application/json"});
      return res.end(JSON.stringify({ok:false,error:"Client File Studio is unreachable."}));
    }
  }


  const file = path.normalize(path.join(root, pathname));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      fs.readFile(path.join(root, "index.html"), (fallbackErr, fallbackData) => {
        if (fallbackErr) {
          res.writeHead(500);
          res.end("Website unavailable");
          return;
        }
        res.writeHead(200, {"Content-Type": mime[".html"]});
        res.end(fallbackData);
      });
      return;
    }

    res.writeHead(200, {
      "Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": pathname === "/index.html" ? "no-cache" : "public, max-age=86400"
    });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("FBI GH website listening on port " + PORT);
});