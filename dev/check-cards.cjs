#!/usr/bin/env node
/* 号口のトップ（おでん横丁）が、各ゲームの card.js そのままを出しているかを調べる。
   使い方：node dev/check-cards.cjs [--beta <βの cards.js のパス>]
   このリポジトリ自身のカード（各フォルダの card.js）を正とする。
   --beta を渡すと、https://chikuwagames-beta.chikuwa-hookah.workers.dev/cards.js へのリクエストにその中身を返して調べる。
   渡さないときは、βのカード抜きで調べる。
   (a) index.html が読む ./<ゲーム>/card.js の一覧と、リポジトリにある各フォルダの card.js の一覧が同じか
   (b) 画面に全項目・リンク・サムネイルが出ているか（title・kicker・sub・desc・tags・版数・リンク先・屋台と一覧の数・draw・サムネイルの絵）
   (c) カードが1件も読めなかったとき、「カードを読み込めませんでした」だけを出すか
   差異があれば、期待と実際を出して終了コード 1。 */
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
let BETA_FILE = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--beta') BETA_FILE = args[++i] && path.resolve(args[i]);
  else { console.error('使い方：node dev/check-cards.cjs [--beta <βの cards.js>]'); process.exit(2); }
}
if (args.includes('--beta') && (!BETA_FILE || !fs.existsSync(BETA_FILE))) { console.error('--beta のファイルが見つかりません'); process.exit(2); }
const BETA_URL = 'https://chikuwagames-beta.chikuwa-hookah.workers.dev/cards.js';

const ng = [];
let okCount = 0;
const ok = (label) => { okCount++; console.log('OK  ' + label); };
const bad = (label, detail) => { ng.push(label); console.log('NG  ' + label); detail.forEach(d => console.log('      ' + d)); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const show = v => JSON.stringify(v);

function evalCards(files) {
  const sandbox = {}; sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of files) vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
  return sandbox.CHIKUWA_GAMES || [];
}

/* ---------- (a) 一覧 ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const GAMES = [...html.matchAll(/<script src="\.\/([\w-]+)\/card\.js"/g)].map(m => m[1]);
const FOLDERS = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, 'card.js'))).map(d => d.name);
console.log('== (a) ゲームの一覧');
{
  const s = a => a.slice().sort();
  if (same(s(GAMES), s(FOLDERS)) && new Set(GAMES).size === GAMES.length) ok(`index.html が読む card.js（${GAMES.length}本）とリポジトリの */card.js が同じ`);
  else bad('index.html が読む card.js とリポジトリの */card.js', [`index.html：${show(s(GAMES))}`, `リポジトリ：${show(s(FOLDERS))}`,
    `index.html に無い：${show(FOLDERS.filter(g => !GAMES.includes(g)))}`, `フォルダに無い：${show(GAMES.filter(g => !FOLDERS.includes(g)))}`]);
}

/* ---------- 期待するカード ---------- */
const liveCards = [];
for (const g of GAMES) evalCards([path.join(ROOT, g, 'card.js')]).forEach(c => liveCards.push(Object.assign({ _game: g }, c)));
const betaCards = BETA_FILE ? evalCards([BETA_FILE]) : [];
const expected = liveCards.concat(betaCards.map(c => Object.assign({ _game: null }, c))).filter(c => !c.adult)
  .sort((a, b) => (a.order - b.order) || ((a.beta ? 1 : 0) - (b.beta ? 1 : 0)));  // order が同じなら正式版が先
const verOf = c => c.beta ? 'β' + String(c.version).replace(/^β/, '') : 'v' + c.version;
const modeOf = c => c.dev ? 'dev' : c.lock ? 'lock' : 'open';
const nameOf = c => c._game || (c.href || '').replace(/\/$/, '').split('/').pop() || c.title;

/* ---------- このリポジトリを静的配信 ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

/* ---------- ページ側で調べる ---------- */
async function collect(page) {
  /* 一覧のキャンバスを順に画面へ出して、ページ自身に描かせる（画面の外は描かない作りのため） */
  await page.evaluate(async () => {
    for (const th of window.YK_THUMBS || []) {
      th.canvas.scrollIntoView({ block: 'center' });
      await new Promise(res => setTimeout(res, 120));
    }
  });
  return page.evaluate(() => {
    const all = window.YK_ALL || [];
    const cg = window.CHIKUWA_GAMES || [];
    const txt = el => el ? el.textContent.trim() : null;
    const cards = all.map((g, i) => {
      const li = document.getElementById(g._id);
      const q = s => li ? li.querySelector(s) : null;
      const a = q('h3 a');
      return {
        i, order: g.order, mode: g._m, exists: !!li,
        title: txt(q('h3')), kicker: txt(q('.shina-k')), sub: txt(q('.shina-sub')), desc: txt(q('.shina-d')),
        tags: li ? [...li.querySelectorAll('.shina-tags li')].map(x => x.textContent) : null,
        version: txt(q('.nefuda')), href: a ? a.getAttribute('href') : null, hrefAbs: a ? a.href : null,
        drawSame: typeof g.draw === 'function' && cg.some(x => x.draw === g.draw),
        drawIsFn: typeof g.draw === 'function'
      };
    });
    const yatai = [...document.querySelectorAll('#street a.yatai')];
    const thumbs = (window.YK_THUMBS || []).map((th, k) => {
      const c = th.canvas, ctx = c.getContext('2d');
      const before = ctx.getImageData(0, 0, 160, 90).data;
      let nonEmpty = false; for (let p = 0; p < before.length; p += 4) if (before[p + 3] !== 0 && (before[p] | before[p + 1] | before[p + 2]) !== 0) { nonEmpty = true; break; }
      /* 期待：同じ draw を別の 160×90 に t = 0 で描く（開いていない屋台はモザイク） */
      const ref = document.createElement('canvas'); ref.width = 160; ref.height = 90;
      const rx = ref.getContext('2d'); th.game.draw(rx, 0);
      let exp = ref;
      if (th.mode !== 'open') {
        const mos = document.createElement('canvas'); mos.width = 32; mos.height = 18; const mx = mos.getContext('2d');
        mx.imageSmoothingEnabled = true; mx.drawImage(ref, 0, 0, 32, 18);
        exp = document.createElement('canvas'); exp.width = 160; exp.height = 90; const ex = exp.getContext('2d');
        ex.imageSmoothingEnabled = false; ex.drawImage(mos, 0, 0, 160, 90);
      }
      const e = exp.getContext('2d').getImageData(0, 0, 160, 90).data;
      /* 実際：一覧のキャンバスを t = 0 で描き直す */
      ctx.clearRect(0, 0, 160, 90); th.game._cx.clearRect(0, 0, 160, 90);
      th.redraw0();
      const a = ctx.getImageData(0, 0, 160, 90).data;
      let diff = 0; for (let p = 0; p < a.length; p++) if (a[p] !== e[p]) diff++;
      return { id: th.game._id, order: th.game.order, nonEmpty, diff, k };
    });
    return {
      source: window.YK_SOURCE, ready: document.documentElement.dataset.ykReady,
      cards, yataiCount: yatai.length, yataiHref: yatai.map(a => a.getAttribute('href')), listCount: document.querySelectorAll('li.shina').length,
      thumbs, note: (() => { const n = document.getElementById('load-note'); return n && !n.hidden ? n.textContent : ''; })(),
      mihon: document.querySelectorAll('.mihon, .yatai-mihon, .buhin, .kanban-ad').length
    };
  });
}

async function open(browser, base, { live }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route(BETA_URL, route => (live && BETA_FILE)
    ? route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: fs.readFileSync(BETA_FILE) })
    : route.abort());
  if (!live) await page.route('**/card.js', route => route.abort());
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => document.documentElement.dataset.ykReady === '1', null, { timeout: 20000 });
  const r = await collect(page);
  await ctx.close();
  r.errors = errors;
  return r;
}

/* ---------- (b) カードが読めたとき ---------- */
function checkLive(r, base) {
  const label = '(b)';
  console.log('== (b) カードの表示');
  if (r.errors.length) bad(`${label} ページのエラー`, r.errors);
  if (r.source === 'live') ok(`${label} YK_SOURCE = live`); else bad(`${label} YK_SOURCE`, ['期待：live', `実際：${r.source}`]);
  if (r.note) bad(`${label} お知らせ`, ['期待：出ない', `実際：${r.note}`]); else ok(`${label} 読み込み失敗のお知らせが出ていない`);
  if (r.mihon === 0) ok(`${label} 見本・広告の枠が無い`); else bad(`${label} 見本・広告の枠`, ['期待：0', `実際：${r.mihon}`]);

  const want = expected.length;
  if (r.yataiCount === want) ok(`${label} 屋台の数 ${want}`); else bad(`${label} 屋台の数`, [`期待：${want}`, `実際：${r.yataiCount}`]);
  if (r.listCount === want) ok(`${label} 一覧の数 ${want}`); else bad(`${label} 一覧の数`, [`期待：${want}`, `実際：${r.listCount}`]);
  if (r.cards.length === want) ok(`${label} YK_ALL の数 ${want}`); else bad(`${label} YK_ALL の数`, [`期待：${want}`, `実際：${r.cards.length}`]);
  const orders = r.cards.map(c => c.order);
  if (same(orders, expected.map(c => c.order))) ok(`${label} 並び順（order）`); else bad(`${label} 並び順（order）`, [`期待：${show(expected.map(c => c.order))}`, `実際：${show(orders)}`]);

  expected.forEach((e, k) => {
    const a = r.cards[k];
    const name = `${label} ${nameOf(e)}（order ${e.order}）`;
    if (!a) return bad(name, ['画面にカードが出ていない']);
    if (a.order !== e.order) return bad(name, [`並びの ${k} 番目 order 期待：${e.order} 実際：${a.order}`]);
    const diffs = [];
    const cmp = (what, exp, act) => { if (exp !== act) diffs.push(`${what} 期待：${show(exp)} 実際：${show(act)}`); };
    if (!a.exists) diffs.push('一覧の欄（li）が無い');
    cmp('title', e.title, a.title); cmp('kicker', e.kicker, a.kicker);
    if (e.sub) cmp('sub', e.sub, a.sub); else cmp('sub（無し）', null, a.sub);
    cmp('版数', verOf(e), a.version);
    cmp('屋台の状態', modeOf(e), a.mode);
    if (modeOf(e) === 'open') {   // 開発中・鍵付きの品は説明とタグ・リンクを出さない作り
      cmp('desc', e.desc, a.desc);
      if (!same(e.tags || [], a.tags)) diffs.push(`tags 期待：${show(e.tags || [])} 実際：${show(a.tags)}`);
      cmp('リンク先（href）', e.href, a.href);
      cmp('リンク先（絶対）', new URL(e.href, base + '/').href, a.hrefAbs);
      if (r.yataiHref.indexOf(e.href) < 0) diffs.push(`屋台のリンク 期待：${e.href} の屋台が一つある 実際：${show(r.yataiHref)}`);
    }
    if (!a.drawIsFn || !a.drawSame) diffs.push('draw が CHIKUWA_GAMES の同じカードの draw（===）ではない');
    if (!diffs.length) ok(name + ` ${e.title} ${verOf(e)}`); else bad(name, diffs);
  });

  if (r.thumbs.length === want) ok(`${label} サムネイルの数 ${want}`); else bad(`${label} サムネイルの数`, [`期待：${want}`, `実際：${r.thumbs.length}`]);
  r.thumbs.forEach((t, k) => {
    const e = expected[k];
    const name = `${label} サムネイル ${e ? nameOf(e) : t.order}`;
    const diffs = [];
    if (!t.nonEmpty) diffs.push('キャンバスが空');
    if (t.diff) diffs.push(`t=0 で描いた絵と一致しない（ちがうバイト数 ${t.diff}）`);
    if (!diffs.length) ok(name); else bad(name, diffs);
  });
}

/* ---------- (c) カードが1件も読めないとき ---------- */
function checkNone(r) {
  const label = '(c)';
  console.log('== (c) カードが1件も読めないとき');
  if (r.errors.length) bad(`${label} ページのエラー`, r.errors);
  if (r.source === 'none') ok(`${label} YK_SOURCE = none`); else bad(`${label} YK_SOURCE`, ['期待：none', `実際：${r.source}`]);
  const w = 'カードを読み込めませんでした';
  if (r.note === w) ok(`${label} 「${w}」を出す`); else bad(`${label} 読み込み失敗のお知らせ`, [`期待：${w}`, `実際：${show(r.note)}`]);
  if (r.yataiCount === 0 && r.listCount === 0) ok(`${label} 作りものの屋台を出さない`); else bad(`${label} 屋台`, ['期待：0 軒', `実際：屋台 ${r.yataiCount}・一覧 ${r.listCount}`]);
}

(async () => {
  await new Promise(res => server.listen(0, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  try {
    checkLive(await open(browser, base, { live: true }), base);
    checkNone(await open(browser, base, { live: false }));
  } finally { await browser.close(); server.close(); }
  console.log('');
  if (ng.length) { console.log(`差異あり：${ng.length} 件（OK ${okCount} 件）`); process.exit(1); }
  console.log(`差異なし：号口のカード ${liveCards.filter(c => !c.adult).length} 本 + βのカード ${betaCards.filter(c => !c.adult).length} 本${BETA_FILE ? '' : '（β未指定）'}、チェック ${okCount} 項目すべて OK`);
})().catch(e => { console.error(e); try { server.close(); } catch (_) {} process.exit(1); });
