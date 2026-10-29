// 使い方：号口のフォルダで python3 -m http.server 8090 を動かし、node shop-sim/dev/sim/run.js 回数 日数（例：60 252）。結果は dev/sim/res-*.json（2026-10-29、2店舗目のタイミングの試算に使った）
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const N = +process.argv[2] || 3, days = +process.argv[3] || 252, rule = process.argv[4] || 'margin';
  const b = await chromium.launch();
  const out = [];
  for (let r = 0; r < N; r++) {
    const ctx = await b.newContext();
    await ctx.addInitScript(() => { localStorage.setItem('shop-sim-tutorial','1'); });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => console.log('PAGEERR', e.message));
    await pg.goto('http://localhost:8090/shop-sim/'); await pg.waitForTimeout(300);
    await pg.addScriptTag({ path: __dirname + '/bot.js' });
    const res = await pg.evaluate(([days, rule]) => SIM({ days, slotRule: rule }), [days, rule]);
    out.push(res);
    console.log(r, res.over, res.overMsg, 'day', res.day, 'ceil', res.ceiling, 'clerk', res.firstClerkFull, 'cash', res.cashOk);
    await ctx.close();
  }
  fs.writeFileSync(__dirname + `/res-${rule}-${N}.json`, JSON.stringify(out));
  await b.close();
})();
