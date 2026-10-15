const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const root = path.join(__dirname, "public");


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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/health") {
    res.writeHead(200, {"Content-Type":"application/json; charset=utf-8"});
    res.end(JSON.stringify({status:"ok", service:"fbi-os-website"}));
    return;
  }

  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin/index.html";
  // Public, non-sensitive system directory used by the Admin Hub.
  if (pathname === "/api/ecosystem/registry") {
    fs.readFile(path.join(__dirname, "ecosystem", "registry.json"), "utf8", (err, data) => {
      if (err) {
        res.writeHead(503, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"});
        res.end(JSON.stringify({ok:false,error:"Ecosystem registry is unavailable."}));
        return;
      }
      res.writeHead(200, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"});
      res.end(data);
    });
    return;
  }

  // These proxy routes are intentionally disabled until server-verified Admin Hub
  // authentication and role checks are in place. A shared upstream token alone
  // must never turn a public endpoint into a relay for private business data.
  if (pathname === "/api/admin/invoice-snapshot" || pathname === "/api/admin/files-snapshot") {
    res.writeHead(503, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"});
    return res.end(JSON.stringify({ok:false,error:"Administrative data snapshots are temporarily disabled pending server-side authorization."}));
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