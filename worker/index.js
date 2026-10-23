// ちくわゲームズ 対戦用シグナリングサーバー（多人数版）
// 対戦オセロ（online-game-test）と同じ仕組み：端末どうしが WebRTC の接続情報
// （offer / answer / ICE）を交換するためだけに使い、遊んでいる間のデータはここを通らない。
// オセロとの違いは「1部屋に最大8台」「親（最初に入った端末）と各子が1対1でつながる星型」の2点。
//
// ゲームの画面などの静的ファイルは Workers の assets が先に返すので、
// このスクリプトが動くのは assets に無いパス（/roulette/ws など）だけ。

const MAX_PEERS = 8;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/roulette/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("WebSocket only", { status: 426 });
      }
      const room = (url.searchParams.get("room") || "").trim();
      if (!/^[0-9]{4}$/.test(room)) {
        return new Response("bad room code", { status: 400 });
      }
      const id = env.ROOMS.idFromName("roulette:" + room);
      return env.ROOMS.get(id).fetch(request);
    }

    // デバッグログの受け口（例：/shop-sim/debug）。D1 の debug_logs に保存し、受付番号を返す
    const dm = url.pathname.match(/^\/([a-z0-9-]+)\/debug$/);
    if (dm && DEBUG_GAMES.includes(dm[1])) {
      return saveDebugLog(request, env, dm[1]);
    }

    // それ以外は通常の静的配信（見つからなければ 404）
    return env.ASSETS.fetch(request);
  },
};

// デバッグログを受け付けるゲーム（フォルダ名）
const DEBUG_GAMES = ["shop-sim"];
// 1件の上限（バイト）と、1日に受け付ける件数の上限（いたずら対策）
const DEBUG_MAX_BYTES = 300 * 1024;
const DEBUG_MAX_PER_DAY = 300;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

async function saveDebugLog(request, env, game) {
  if (request.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  if (!env.DEBUG_DB) return json({ ok: false, error: "保存先が未設定です" }, 503);
  const text = await request.text();
  if (text.length > DEBUG_MAX_BYTES) return json({ ok: false, error: "ログが大きすぎます" }, 413);
  let data;
  try { data = JSON.parse(text); } catch (e) { return json({ ok: false, error: "形式が正しくありません" }, 400); }
  if (!data || typeof data !== "object") return json({ ok: false, error: "形式が正しくありません" }, 400);
  const cnt = await env.DEBUG_DB.prepare(
    "SELECT COUNT(*) AS n FROM debug_logs WHERE at >= datetime('now', '-1 day')"
  ).first("n");
  if (cnt >= DEBUG_MAX_PER_DAY) return json({ ok: false, error: "混み合っています。時間をおいて送ってください" }, 429);
  // 受付番号：紛らわしい文字（0/O/1/I）を除いた6文字
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rnd = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(rnd, (b) => A[b % A.length]).join("");
  await env.DEBUG_DB.prepare(
    "INSERT INTO debug_logs (game, version, code, note, body, ua) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(
    game,
    String(data.version || "").slice(0, 20),
    code,
    String(data.note || "").slice(0, 500),
    text,
    (request.headers.get("user-agent") || "").slice(0, 300)
  ).run();
  return json({ ok: true, code });
}

export class MultiRoom {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const sockets = this.state.getWebSockets();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (sockets.length >= MAX_PEERS) {
      server.accept();
      server.send(JSON.stringify({ type: "full" }));
      server.close(4000, "room full");
      return new Response(null, { status: 101, webSocket: client });
    }

    // 親がまだいなければ、この端末が親になる
    const hasHost = sockets.some((ws) => this.state.getTags(ws).includes("host"));
    const role = hasHost ? "guest" : "host";
    // 端末ID：親は "0"、子はかぶらないランダムな文字列（接続を切った子のIDを使い回さない）
    const id = role === "host" ? "0" : crypto.randomUUID().slice(0, 8);
    this.state.acceptWebSocket(server, [role, "id:" + id]);

    server.send(JSON.stringify({ type: "role", role, id }));
    if (role === "guest") {
      for (const ws of this.state.getWebSockets("host")) {
        ws.send(JSON.stringify({ type: "peer-joined", id }));
      }
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  idOf(ws) {
    const tag = this.state.getTags(ws).find((t) => t.startsWith("id:"));
    return tag ? tag.slice(3) : "";
  }

  // 宛先（to）があればその端末へ、なければ自分以外の全員へ中継する。from は必ずサーバーが付け直す
  async webSocketMessage(ws, message) {
    let msg;
    try { msg = JSON.parse(message); } catch (e) { return; }
    if (!msg || typeof msg !== "object") return;
    msg.from = this.idOf(ws);
    const text = JSON.stringify(msg);
    if (typeof msg.to === "string") {
      for (const other of this.state.getWebSockets("id:" + msg.to)) {
        if (other !== ws) other.send(text);
      }
      return;
    }
    for (const other of this.state.getWebSockets()) {
      if (other !== ws) other.send(text);
    }
  }

  async webSocketClose(ws) {
    const id = this.idOf(ws);
    const wasHost = this.state.getTags(ws).includes("host");
    for (const other of this.state.getWebSockets()) {
      if (other === ws) continue;
      try { other.send(JSON.stringify(wasHost ? { type: "host-left" } : { type: "peer-left", id })); } catch (e) {}
    }
  }

  async webSocketError(ws) {
    return this.webSocketClose(ws);
  }
}
