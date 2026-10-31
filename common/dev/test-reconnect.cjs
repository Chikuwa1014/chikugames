// 共通部品 room.js：親の仲介接続が「黙って切れた」ときの確認（2026-10-31。キャリア回線で部屋が見つからなくなる不具合）
//   node roulette/dev/server.mjs 8787 を起動してから  node common/dev/test-reconnect.cjs [beat]
//   A：親＋子2人  B：親の接続が死んでいる間に子3が参加 → 親が画面に戻ると、つなぎ直して子3も入る
//   C：つなぎ直したあとも新しい子が入れる  D：ない部屋は 10 秒ほど待ってから「その部屋は見つかりません」
//   beat を付けると、画面の切りかえなしで生存確認（35 秒）だけで気づくかを確かめる（1 分ほどかかる）
const { chromium } = require('playwright');
const URL0 = 'http://localhost:8787/common/dev/room-test.html?game=horimogu&max=8';
const ok = (c, t) => { console.log((c ? 'OK ' : 'NG ') + t); if (!c) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const errs = [];
  async function page(name, hostCtl) {
    const ctx = await b.newContext({ viewport: { width: 400, height: 760 } });
    await ctx.addInitScript(n => localStorage.setItem('cg-room-test-name', n), name);
    if (hostCtl) {
      // 1本目の接続だけ、合図で「黙って切れた」状態にする（どちらの向きも通さず、閉じもしない）
      let n = 0;
      await ctx.routeWebSocket(/\/ws/, ws => {
        const me = ++n, srv = ws.connectToServer();
        ws.onMessage(m => { if (!(me === 1 && hostCtl.dead)) srv.send(m); });
        srv.onMessage(m => { if (!(me === 1 && hostCtl.dead)) ws.send(m); });
      });
    }
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e));
    p.on('console', m => m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|qrcode/i.test(m.text()) && errs.push(name + ' console: ' + m.text()));
    await p.goto(URL0);
    return p;
  }
  const members = p => p.locator('.cg-room-members li').count();
  const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await wait(150); } return false; };
  const join = async (p, code) => { await p.fill('.cg-room-code', code); await p.click('[data-cg="join"]'); };

  // A：ふつうに 4 人
  const ctl = { dead: false };
  const h = await page('おや', ctl);
  await h.click('[data-cg="create"]'); await h.waitForSelector('.cg-room-num');
  const code = (await h.textContent('.cg-room-num')).trim();
  const g1 = await page('こ1'), g2 = await page('こ2');
  await join(g1, code); await join(g2, code);
  ok(await until(async () => await members(h) === 3, 15000), 'A：親＋子2人がそろう');

  // B：親の接続が黙って切れる → 子3が参加（親を待つ）→ 親が画面に戻る → つなぎ直して子3も入る
  ctl.dead = true;
  const g3 = await page('こ3'); await join(g3, code);
  await wait(2000);
  ok(await members(g3) === 0, 'B：親の接続が死んでいる間は、子3はまだ入れない');
  if (process.argv[2] === 'beat') {
    ok(await until(async () => await members(h) === 4, 70000), 'E：画面の切りかえなしでも、生存確認だけで気づいて子3が入れる');
    ok(errs.length === 0, 'エラーなし ' + errs.join(' | '));
    return b.close();
  }
  await h.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  ok(await until(async () => await members(h) === 4, 20000), 'B：画面に戻ったら親がつなぎ直し、子3も入れる（4人）');
  ok(await members(g1) === 4, 'B：前からいた子1にも4人と見える');

  // C：つなぎ直したあとの新しい接続で、子4が入れる
  const g4 = await page('こ4'); await join(g4, code);
  ok(await until(async () => await members(h) === 5, 15000), 'C：つなぎ直したあとも新しい子が入れる（5人）');

  // D：ない部屋 → 10秒ほど待ってから「見つかりません」
  const g5 = await page('こ5'); const t0 = Date.now(); await join(g5, '0000' === code ? '0001' : '0000');
  ok(await until(async () => /見つかりません/.test(await g5.textContent('body')), 20000), 'D：ない部屋は「その部屋は見つかりません」');
  const dt = (Date.now() - t0) / 1000; ok(dt > 8, 'D：すぐに失敗せず待つ（' + dt.toFixed(1) + '秒）');
  ok(errs.length === 0, 'エラーなし ' + errs.join(' | '));
  await b.close();
})();
