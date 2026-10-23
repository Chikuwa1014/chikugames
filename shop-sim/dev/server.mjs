// ローカル確認用サーバー（公開しない。.assetsignore の **/dev で除外）
// 本物の worker/index.js の fetch を Node 上で動かし、静的ファイルとデバッグログの受け口（/shop-sim/debug）を出す。
// D1 は中身をメモリに持つだけのまね。受け取ったログは GET /__debug で確かめられる。
//   node shop-sim/dev/server.mjs [port]   → http://localhost:8788/shop-sim/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = +(process.argv[2] || 8788);
const worker = (await import(path.join(ROOT, "worker/index.js"))).default;

// ---- D1 のまね（このサーバーが使う SQL だけ） ----
const rows = [];
const DEBUG_DB = {
  prepare(sql) {
    const st = {
      args: [],
      bind(...a) { st.args = a; return st; },
      async first(col) { if (/COUNT/.test(sql)) return col ? rows.length : { n: rows.length }; return null; },
      async run() {
        const [game, version, code, note, body, ua] = st.args;
        rows.push({ id: rows.length + 1, game, version, code, note, body, ua, at: new Date().toISOString() });
        return { success: true };
      },
    };
    return st;
  },
};

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const ASSETS = {
  async fetch(req) {
    const u = new URL(req.url);
    let p = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!p.startsWith(ROOT)) return new Response("forbidden", { status: 403 });
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!fs.existsSync(p)) return new Response("not found", { status: 404 });
    return new Response(fs.readFileSync(p), { headers: { "content-type": MIME[path.extname(p)] || "application/octet-stream" } });
  },
};

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const url = "http://localhost:" + PORT + req.url;
  if (req.url === "/__debug") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(rows.map((r) => ({ ...r, body: JSON.parse(r.body) })), null, 1));
  }
  // assets に無いパスだけ worker へ（本番と同じ順番）
  let r = await ASSETS.fetch(new Request(url));
  if (r.status === 404 || req.method !== "GET") {
    const init = { method: req.method, headers: req.headers };
    if (chunks.length) init.body = Buffer.concat(chunks);
    r = await worker.fetch(new Request(url, init), { ASSETS, DEBUG_DB });
  }
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => console.log("http://localhost:" + PORT + "/shop-sim/"));
