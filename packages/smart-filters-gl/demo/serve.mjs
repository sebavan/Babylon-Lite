// Minimal static file server for the demo (no deps). Usage: node demo/serve.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] ?? 8777);
const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".map": "application/json",
};

createServer(async (req, res) => {
    try {
        let p = decodeURIComponent((req.url ?? "/").split("?")[0]);
        if (p === "/") p = "/index.html";
        const file = join(root, normalize(p));
        const data = await readFile(file);
        res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end("not found");
    }
}).listen(port, () => console.log(`smart-filters-gl demo on http://localhost:${port}`));
