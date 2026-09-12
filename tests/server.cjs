const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  let route = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (!route.startsWith("/elowen/")) {
    res.writeHead(404);
    res.end();
    return;
  }
  let file = path.join(root, route.slice(8) || "index.html");
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file).toLowerCase()] || "text/plain",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end(await fs.readFile(path.join(root, "404.html")));
  }
});

module.exports = { server, root };
