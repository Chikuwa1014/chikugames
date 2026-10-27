"""うごかせ！ちくわくん の動作テスト（Playwright）。
β リポジトリのルートで `python3 -m http.server 8765` を動かしてから、
`python3 ugokase-chikuwa/dev/test.py` で実行する。スクリーンショットは dev/shots/（公開しない・commit しない）。
"""
import os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('UC_URL', 'http://localhost:8765/ugokase-chikuwa/')
OUT = os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)
errors = []


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, name + '.png'))


def check(cond, msg):
    print(('OK  ' if cond else 'NG  ') + msg)
    if not cond:
        errors.append(msg)


def run(p, w, h, tag):
    exe = os.environ.get('UC_CHROME', '/opt/pw-browsers/chromium')
    b = p.chromium.launch(executable_path=exe) if os.path.exists(exe) else p.chromium.launch()
    page = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=2)
    page.on('pageerror', lambda e: errors.append(f'{tag} pageerror: {e}'))
    page.on('console', lambda m: m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts' not in m.text and 'favicon' not in str(m.location) and errors.append(f'{tag} console: {m.text}'))
    page.goto(URL)
    page.wait_for_timeout(600)
    shot(page, tag + '-01-title')
    page.click('#btnNew')
    page.wait_for_timeout(300)
    shot(page, tag + '-02-howto')
    page.click('#mClose')
    page.wait_for_timeout(300)
    shot(page, tag + '-03-game')
    # はじめは時間が止まっていて、速さのボタンを吹き出しで知らせる
    t0 = page.evaluate('() => UCT.G.time'); page.wait_for_timeout(500); t1 = page.evaluate('() => UCT.G.time')
    check(t0 == t1 and page.is_visible('#spdTip'), f'{tag}: はじめは時間が止まり、速さボタンの吹き出しが出る')
    page.click('#speed button[data-s="1"]'); page.wait_for_timeout(300)
    check(not page.is_visible('#spdTip') and page.evaluate('() => UCT.G.time') > t1, f'{tag}: ▶ を押すと時間がすすみ、吹き出しが消える')

    # 決まった配置にして、指示書で取り場 → 出荷ヤードを往復させる
    page.evaluate('''() => {
      const G = UCT.G, b = G.bases[0];
      for (const k in b.objs) if (b.objs[k].type === 'src' || b.objs[k].type === 'yard') delete b.objs[k];
      b.coins = {};
      UC.put(b, 'src', 0, 4, 0).stock = [];
      UC.put(b, 'yard', 10, 4, 0).stock = [];
      b.coins['5,4'] = 10;
      const r = G.robots[0]; r.x = 1; r.y = 4; r.dir = 2;
      // 取り場（西）から持って、東へ進んでヤードに置き、もどる
      r.prog.main = ['loop:0', 'take', 'back', 'fwd', 'put', 'back', 'fwd', 'end'];
      G.time = 9 * 60 - 1;   // 1 日目 8:59
    }''')
    page.click('#btnRun')
    page.click('#speed button[data-s="4"]')
    page.wait_for_timeout(6000)
    st = page.evaluate('() => { const G = UCT.G, b = G.bases[0], y = Object.values(b.objs).find(o => o.type === "yard"); return { yard: y.stock.length, coin: G.coin, mode: G.robots[0].mode, x: G.robots[0].x, run: G.robots[0].running, t: G.time } }')
    print(tag, st)
    check(st['mode'] == 'work', f'{tag}: 9時から勤務になる')
    check(st['yard'] >= 1, f'{tag}: 製品を出荷ヤードへ運べる')
    check(st['coin'] >= 310, f'{tag}: 歩くと恋ンを拾える')
    shot(page, tag + '-04-running')

    # BUILD 画面
    page.click('#btnBuild')
    page.wait_for_timeout(300)
    shot(page, tag + '-05-build')
    page.click('#bPal .piece[data-k="fwd"]')
    n = page.evaluate('() => UCT.G.robots[0].prog.main.length')
    check(n == 9, f'{tag}: ピースを追加できる')
    page.click('#mClose')

    # お店：コンベアを置く
    page.evaluate('() => { UCT.G.coin = 5000 }')
    page.click('#btnShop')
    page.wait_for_timeout(200)
    shot(page, tag + '-06-shop')
    page.click('button[data-a="place:belt"]')
    page.evaluate('''() => { const r = document.querySelector('#view').getBoundingClientRect(); }''')
    # 置く場所：タイル (8, 6) の画面の位置へ
    pos = page.evaluate('''() => {
      const c = UCT; const b = UCT.G.bases[0];
      const cv = document.querySelector('#view'), rc = cv.getBoundingClientRect();
      return null;
    }''')
    page.evaluate('() => { UC.put(UCT.G.bases[0], "belt", 8, 6, 0); UC.put(UCT.G.bases[0], "pool", 9, 6, 0); UC.put(UCT.G.bases[0], "sorter", 7, 6, 0); }')
    page.click('#placeEnd')

    # 休けい：12:00 でれいぞうこへ
    page.evaluate('() => { UCT.G.time = UCT.G.lastDay * 1440 + 11 * 60 + 58; }')
    page.wait_for_timeout(2500)
    st = page.evaluate('() => { const r = UCT.G.robots[0]; return { mode: r.mode, ph: r.brk && r.brk.phase, path: r.path && r.path.length } }')
    print(tag, st)
    check(st['mode'] == 'break', f'{tag}: 休けいになる')
    shot(page, tag + '-07-break')

    # シフト・かんばん・設定
    page.click('#btnShift'); page.wait_for_timeout(200); shot(page, tag + '-08-shift'); page.click('#mClose')
    page.click('#btnKanban'); page.wait_for_timeout(200); shot(page, tag + '-09-kanban'); page.click('#mClose')
    page.click('#btnSet'); page.wait_for_timeout(200); shot(page, tag + '-10-settings'); page.click('#mClose')

    # 何日か進めて、集荷が起きるか
    page.evaluate('() => { const G = UCT.G; for (let i = 0; i < 4 * 1440; i++) UC.step(G, 1); }')
    st = page.evaluate('() => { const G = UCT.G; return { log: G.bases[0].log.length, day: UC.cal(G.time).day, hp: G.robots[0].hp, mp: G.robots[0].mp } }')
    print(tag, st)
    check(st['log'] >= 3, f'{tag}: かんばんの集荷が起きる')
    page.wait_for_timeout(300)
    shot(page, tag + '-11-later')

    # 進むの歩数・停止ピース
    st = page.evaluate("""() => {
      const G = UCT.G, b = G.bases[0], r = G.robots[0];
      UC.stop(G, r); r.brk = null; r.path = null; r.walk = null; r.x = 3; r.y = 2; r.dir = 0; r.injured = false; r.sulk = false; r.hp = 100; r.mp = 100;
      for (const k in b.objs) { const o = b.objs[k]; if (o.y === 2 && o.x > 3) delete b.objs[k]; }
      r.prog.main = ['fwd:3', 'stop'];
      G.time = (Math.floor(G.time / 1440 / 7) + 1) * 7 * 1440 + 9 * 60 + 5;   // 次の月曜 9:05
      UC.step(G, 0.1); UC.run(G, r);
      for (let i = 0; i < 60; i++) UC.step(G, 0.25);
      return { x: r.x, run: r.running, mode: r.mode };
    }""")
    print(tag, st)
    check(st['x'] == 6, f'{tag}: 「3歩進む」で 3 マスだけ進む')
    check(not st['run'], f'{tag}: 停止ピースで止まる')
    # ファンクションの中の停止は「ファンクション終了」：呼んだところへもどって、メインの続きを実行する
    st = page.evaluate("""() => {
      const G = UCT.G, r = G.robots[0];
      r.x = 3; r.y = 2; r.dir = 0;
      r.prog.main = ['f1', 'fwd:1', 'stop']; r.prog.f[0] = ['fwd:1', 'stop'];
      UC.run(G, r);
      for (let i = 0; i < 80; i++) UC.step(G, 0.25);
      const out = { x: r.x, run: r.running };
      r.prog.f[0] = []; r.prog.main = ['fwd:3', 'stop'];
      return out;
    }""")
    check(st['x'] == 5 and not st['run'], f'{tag}: ファンクションの停止は「ファンクション終了」で、メインの続きへもどる {st}')
    # くり返し 3 回（入れ子）と、最後まで行ったら止まる
    st = page.evaluate("""() => {
      const G = UCT.G, r = G.robots[0];
      UC.stop(G, r); r.x = 3; r.y = 2; r.dir = 0;
      r.prog.main = ['loop:3', 'loop:2', 'right', 'end', 'end'];   // 右を向く×6 回＝1 周半＝西
      UC.run(G, r);
      for (let i = 0; i < 60; i++) UC.step(G, 0.25);
      const bad = UC.loopPairs(['loop:2', 'end', 'end']).ok;
      const out = { dir: r.dir, run: r.running, bad };
      r.prog.main = ['fwd:3', 'stop'];
      return out;
    }""")
    print(tag, st)
    check(st['dir'] == 2, f'{tag}: 入れ子のくり返しが回数どおり')
    check(not st['run'], f'{tag}: 指示書は最後まで行ったら止まる')
    check(not st['bad'], f'{tag}: 1 対でないくり返しを見つける')
    # 出荷ヤードの絵の上（マスより上）をタップしてもナビが出る
    pos = page.evaluate("""() => { const b = UCT.G.bases[0], o = Object.values(b.objs).find(o => o.type === 'src'); return [o.x, o.y]; }""")
    page.evaluate('() => UCT.clearNav()')
    xy = page.evaluate(f"""() => UCT.screenOf({pos[0]} + 0.5, {pos[1]} + 0.5, 22)""")
    page.mouse.click(xy[0], xy[1]); page.wait_for_timeout(200)
    nv = page.evaluate('() => UCT.nav && UCT.nav.lines[0]')
    check(bool(nv) and '取り場' in nv, f'{tag}: 取り場の絵をタップしてナビ（{nv}）')

    # 場合わけ：持っているときだけ右を向く／持っていないときは左
    st = page.evaluate("""() => {
      const G = UCT.G, r = G.robots[0];
      UC.stop(G, r); r.dir = 0; r.hold = null;
      r.prog.main = ['if:hold', 'right', 'endif', 'if:!hold', 'left', 'endif'];
      UC.run(G, r); for (let i = 0; i < 40; i++) UC.step(G, 0.25);
      const d1 = r.dir;
      r.hold = { t: 0, packed: false }; r.dir = 0; UC.run(G, r); for (let i = 0; i < 40; i++) UC.step(G, 0.25);
      const d2 = r.dir; r.hold = null;
      const cross = UC.loopPairs(['loop:2', 'if:hold', 'end', 'endif']).ok;
      r.prog.main = ['fwd:3', 'stop'];
      return { d1, d2, cross };
    }""")
    check(st['d1'] == 3 and st['d2'] == 1, f'{tag}: 場合わけが条件どおり（{st}）')
    check(not st['cross'], f'{tag}: くり返しと場合わけの交差は 1 対ではない')

    # 拠点のレベル：S は Lv5 まで、取り場・ヤードが増える、同じものどうしは 3 マス以内に置かない、Lv5 で製品指定
    st = page.evaluate("""() => {
      const G = UCT.G, b = UC.newGame().bases[0];
      const out = [];
      for (const n of [49, 1, 50, 200, 200, 600]) {
        b.shipped += n; let nx;
        while ((nx = UC.nextLevel(b)) && b.shipped >= nx.need) { b.lv++; }
        out.push(b.lv);
      }
      return out;
    }""")
    check(st == [1, 2, 3, 4, 5, 5], f'{tag}: 累計集荷数でレベルが上がり、S は 5 で止まる（{st}）')
    st = page.evaluate("""() => {
      const G = UCT.G; G.coin = 99999; UC.buyBase(G, 2); const bi = G.bases.length - 1, b = G.bases[bi];
      UC.moveRobot(G, G.robots[0], bi);
      const yard = UC.spots(b, 'yard')[0];
      // 集荷で一気に 2000 個 → Lv8
      b.shipped = 1999; yard.stock = [{ t: 1, packed: false }];
      b.kanban = [{ t: G.time - 1, need: 1, got: null, yard: yard.x + ',' + yard.y }];
      UC.step(G, 0.01);
      const ss = UC.spots(b, 'src'), ys = UC.spots(b, 'yard');
      const near = l => l.some((a, i) => l.some((c, j) => i < j && Math.max(Math.abs(a.x - c.x), Math.abs(a.y - c.y)) <= 3));
      const spec = ys.filter(y => y.spec != null).length;
      const sy = ys.find(y => y.spec != null);
      const out = { lv: b.lv, src: ss.length, yard: ys.length, nearS: near(ss), nearY: near(ys), spec, specT: sy ? sy.spec : -1 };
      UC.moveRobot(G, G.robots[0], 0); G.bases.pop();   // 後のテストのために元へもどす
      return out;
    }""")
    check(st['lv'] == 8 and st['src'] == 8 and st['yard'] == 8, f'{tag}: L 拠点は Lv8 で取り場 8・ヤード 8（{st}）')
    check(not st['nearS'] and not st['nearY'], f'{tag}: 取り場どうし・ヤードどうしは 3 マス以内にない')
    check(0 < st['spec'] < 8, f'{tag}: Lv7〜 はヤードの製品指定あり・なしが混在')

    # BUILD：起動ピース・停止のうしろにつなげない・歩数のプルダウン
    page.click('#btnBuild'); page.wait_for_timeout(200)
    check(page.locator('#bProg .piece.start').count() == 1, f'{tag}: 指示書の左端に起動ピース')
    page.click('#bProg .piece[data-i="1"]'); page.click('#bPal .piece[data-k="left"]')
    n = page.evaluate('() => UCT.G.robots[0].prog.main.join(",")')
    check(n == 'fwd:3,stop', f'{tag}: 停止のうしろにはつなげない（{n}）')
    page.click('#bProg .piece[data-i="0"]'); page.wait_for_timeout(100)
    page.select_option('#bSteps', '5'); page.wait_for_timeout(100)
    n = page.evaluate('() => UCT.G.robots[0].prog.main[0]')
    check(n == 'fwd:5', f'{tag}: プルダウンで歩数を変えられる（{n}）')
    shot(page, tag + '-13-build-steps')
    page.click('#mClose')
    # ナビ：取り場をタップ → ルートと吹き出し
    nv = page.evaluate("""() => { UCT.clearNav(); const b = UCT.G.bases[0], o = Object.values(b.objs).find(o => o.type === "src"); UCT.inspect(o.x, o.y); return UCT.nav; }""")
    check(nv is not None and len(nv['lines']) >= 2, f'{tag}: オブジェクトをタップすると最短ルートとナビ（{nv and nv["lines"]}）')
    page.wait_for_timeout(300)
    shot(page, tag + '-14-nav')

    # 拠点を追加（L）
    page.evaluate('() => { UCT.G.coin = 99999; UC.buyBase(UCT.G, 2); UC.buyRobot(UCT.G); }')
    page.reload(); page.wait_for_timeout(400)
    page.click('#btnCont'); page.wait_for_timeout(400)
    check(page.is_visible('#spdTip'), f'{tag}: つづきからでも時間は止まっている')
    page.click('#speed button[data-s="1"]')
    nb = page.evaluate('() => UCT.G.bases.length')
    check(nb == 2, f'{tag}: 保存して、つづきから読める（拠点 2 つ）')
    page.click('#bases button[data-i="1"]'); page.wait_for_timeout(300)
    shot(page, tag + '-12-baseL')
    # きかいをタップで置く（拠点のタブが出て画面の高さが変わったあとでも、タップしたマスに置く）→ 取り消し
    page.evaluate('() => { UCT.G.coin = 5000 }')
    page.click('#btnShop'); page.wait_for_timeout(200)
    page.click('button[data-a="place:belt"]'); page.wait_for_timeout(200)
    ok = True
    for (tx, ty) in [(5, 5), (20, 10), (40, 25)]:
        xy = page.evaluate(f"() => UCT.screenOf({tx} + 0.5, {ty} + 0.5)")
        page.mouse.click(xy[0], xy[1]); page.wait_for_timeout(100)
        if page.is_visible('#lnNo'): page.click('#lnNo')   # たまたま取り場のとなりだったとき
        got = page.evaluate(f"() => !!UCT.G.bases[1].objs['{tx},{ty}']")
        ok = ok and got
    check(ok, f'{tag}: タップしたマスにきかいを置ける')
    c0 = page.evaluate('() => UCT.G.coin')
    page.click('#placeUndo'); page.wait_for_timeout(100)
    st = page.evaluate("() => ({ gone: !UCT.G.bases[1].objs['40,25'], coin: UCT.G.coin })")
    check(st['gone'] and st['coin'] == c0 + 30, f'{tag}: 取り消しで最後に置いたきかいがもどり、恋ンももどる')
    shot(page, tag + '-15-place')
    # 配置がえ：選ぶ → 90°回す → 移動 → 撤去
    page.click('#placeEnd'); page.click('#btnEdit'); page.wait_for_timeout(100)
    xy = page.evaluate("() => UCT.screenOf(20 + 0.5, 10 + 0.5)")
    page.mouse.click(*xy); page.wait_for_timeout(100)
    d0 = page.evaluate("() => UCT.G.bases[1].objs['20,10'].dir")
    page.click('#edRot'); page.wait_for_timeout(50)
    d1 = page.evaluate("() => UCT.G.bases[1].objs['20,10'].dir")
    check(d1 == (d0 + 1) % 4, f'{tag}: 配置がえで 90° 回せる')
    page.click('#edMove'); xy = page.evaluate("() => UCT.screenOf(22 + 0.5, 12 + 0.5)"); page.mouse.click(*xy); page.wait_for_timeout(100)
    if page.is_visible('#lnNo'): page.click('#lnNo')
    st = page.evaluate("() => ({ old: !!UCT.G.bases[1].objs['20,10'], now: !!UCT.G.bases[1].objs['22,12'] })")
    check(not st['old'] and st['now'], f'{tag}: 配置がえで移動できる')
    shot(page, tag + '-16-edit')
    c0 = page.evaluate('() => UCT.G.coin'); page.click('#edDel'); page.wait_for_timeout(100)
    st = page.evaluate("() => ({ gone: !UCT.G.bases[1].objs['22,12'], coin: UCT.G.coin })")
    check(st['gone'] and st['coin'] == c0 + 15, f'{tag}: 配置がえで撤去できる（半額もどる）')
    page.click('#edEnd')

    # 置いた直後に「↻ 向き」を押すと、いま置いたきかいも回る
    page.evaluate("() => { UCT.G.coin = 5000; delete UCT.G.bases[1].objs['30,20']; }")
    page.click('#btnShop'); page.wait_for_timeout(200)
    page.click('button[data-a="place:belt"]'); page.wait_for_timeout(200)
    page.evaluate('() => UCT.setDir(0)')
    xy = page.evaluate("() => UCT.screenOf(30 + 0.5, 20 + 0.5)"); page.mouse.click(*xy); page.wait_for_timeout(100)
    if page.is_visible('#lnNo'): page.click('#lnNo')
    page.click('#placeRot'); page.wait_for_timeout(50)
    d = page.evaluate("() => UCT.G.bases[1].objs['30,20'].dir")
    check(d == 1, f'{tag}: 置いた直後の「↻ 向き」で、置いたきかいも回る（{d}）')
    page.click('#placeEnd')
    # 90° 曲線は買うときに右・左を選ぶ
    page.click('#btnShop'); page.wait_for_timeout(200)
    page.click('button[data-a="place:curve-L"]'); page.wait_for_timeout(200)
    xy = page.evaluate("() => UCT.screenOf(33 + 0.5, 20 + 0.5)"); page.mouse.click(*xy); page.wait_for_timeout(100)
    if page.is_visible('#lnNo'): page.click('#lnNo')
    page.click('#placeEnd')
    h = page.evaluate("() => (UCT.G.bases[1].objs['33,20'] || {}).hand")
    check(h == 'L', f'{tag}: 90° 曲線を左曲がりで買える（{h}）')
    # 移動は恋ンがかかる（コンベア 20恋ン → 5恋ン）
    page.click('#btnEdit'); xy = page.evaluate("() => UCT.screenOf(30 + 0.5, 20 + 0.5)"); page.mouse.click(*xy); page.wait_for_timeout(100)
    c0 = page.evaluate('() => UCT.G.coin')
    page.click('#edMove'); xy = page.evaluate("() => UCT.screenOf(30 + 0.5, 22 + 0.5)"); page.mouse.click(*xy); page.wait_for_timeout(100)
    if page.is_visible('#lnNo'): page.click('#lnNo')
    st = page.evaluate("() => ({ now: !!UCT.G.bases[1].objs['30,22'], coin: UCT.G.coin })")
    check(st['now'] and st['coin'] < c0, f'{tag}: 移動すると恋ンがかかる（{c0} → {st["coin"]}）')
    page.click('#edEnd')
    # T コンベア：集約（2→1）と発散（1→2）、1本側の口
    st = page.evaluate('''() => {
      const b = UCT.G.bases[1], P = (x, y, t, d) => { delete b.objs[x + ',' + y]; return UC.put(b, t, x, y, d); };
      const run = () => { for (let i = 0; i < 40; i++) UC.stepBelts(b, 0.5); };
      // 発散：矢印は北。1本側＝左の口（西）から入って、前（北）・右（東）へ交互に出る
      const t = P(40, 10, 'tee', 3); t.mode = 'split'; t.one = 2;
      const a = P(39, 10, 'belt', 0), n = P(40, 9, 'belt', 3), e = P(41, 10, 'belt', 0);
      P(40, 8, 'pool', 0); P(42, 10, 'pool', 0);
      a.item = { t: 0, packed: false }; run(); a.item = { t: 1, packed: false }; run();
      const split = [b.objs['40,8'].stock.length, b.objs['42,10'].stock.length];
      // 集約：前（北）・右（東）から入って、左（西）へ出る
      t.mode = 'merge'; t.alt = 0;
      const n2 = P(40, 9, 'belt', 1), e2 = P(41, 10, 'belt', 2), w = P(39, 10, 'belt', 2); P(38, 10, 'pool', 0);
      n2.item = { t: 2, packed: false }; e2.item = { t: 3, packed: false }; run();
      const merge = b.objs['38,10'].stock.length;
      // 入り口でない口（西）からは入らない
      const ng = P(39, 10, 'belt', 0); ng.item = { t: 4, packed: false }; run();
      return { split, merge, blocked: !!ng.item };
    }''')
    check(st['split'] == [1, 1] and st['merge'] == 2 and st['blocked'], f'{tag}: T の発散は 2 本へ交互、集約は 2 本から 1 本へ、入り口でない口からは入らない {st}')
    page.click('#bases button[data-i="1"]'); page.wait_for_timeout(100)
    xy = page.evaluate("() => UCT.screenOf(40 + 0.5, 10 + 0.5)"); page.evaluate("() => UCT.clearNav()")
    page.evaluate("() => { UCT.inspect(40, 10); UCT.inspect(40, 10); }"); page.wait_for_timeout(200)
    ok = page.is_visible('button[data-tm="split"]')
    if ok: page.click('button[data-tm="split"]'); page.wait_for_timeout(100)
    shot(page, tag + '-17t-tee')
    check(ok and page.evaluate("() => UCT.G.bases[1].objs['40,10'].mode") == 'split', f'{tag}: T の集約・発散を画面で切りかえられる')
    page.click('#mClose')

    # 製造ラインに接続：取り場（0,4）のとなりにコンベアを置くと聞かれる。する → 製品が自動で流れる
    page.click('#bases button[data-i="0"]'); page.wait_for_timeout(200)
    page.evaluate('''() => { const G = UCT.G, b = G.bases[0], r = G.robots[0];
      r.running = false; r.prog.main = ['stop']; r.x = 5; r.y = 1; r.path = null;
      G.time = Math.floor(G.time / 1440) * 1440 + 10 * 60;
      const s = b.objs['0,4']; s.stock = [{ t: 0, packed: false }, { t: 1, packed: false }];
      for (const k of ['0,5', '1,5', '2,5']) delete b.objs[k]; }''')
    page.click('#btnShop'); page.wait_for_timeout(200)
    page.click('button[data-a="place:belt"]'); page.wait_for_timeout(200)
    page.evaluate('() => UCT.setDir && UCT.setDir(0)')
    xy = page.evaluate("() => UCT.screenOf(0 + 0.5, 5 + 0.5)"); page.mouse.click(*xy); page.wait_for_timeout(150)
    check(page.is_visible('#lnYes') and '製造ラインに接続' in page.inner_text('#mTitle'), f'{tag}: 取り場のとなりにコンベアを置くと「製造ラインに接続」を聞かれる')
    shot(page, tag + '-17-line')
    page.click('#lnYes'); page.wait_for_timeout(100)
    xy = page.evaluate("() => UCT.screenOf(1 + 0.5, 5 + 0.5)"); page.mouse.click(*xy); page.wait_for_timeout(150)
    asked = page.is_visible('#lnNo')
    if asked: page.click('#lnNo')
    check(not asked, f'{tag}: ななめのとなりでは聞かれない')
    page.evaluate("() => { const b = UCT.G.bases[0]; delete b.objs['1,5']; UC.put(b, 'belt', 1, 5, 0); }")
    xy = page.evaluate("() => UCT.screenOf(2 + 0.5, 5 + 0.5)"); page.mouse.click(*xy); page.wait_for_timeout(150)
    check(not page.is_visible('#lnYes'), f'{tag}: 取り場からはなれたコンベアでは聞かれない')
    page.click('#placeEnd')
    page.evaluate("() => { const b = UCT.G.bases[0]; delete b.objs['1,4']; }")
    page.click('#btnShop'); page.wait_for_timeout(200)
    page.click('button[data-a="place:belt"]'); page.wait_for_timeout(200)
    xy = page.evaluate("() => UCT.screenOf(1 + 0.5, 4 + 0.5)"); page.mouse.click(*xy); page.wait_for_timeout(150)
    asked = page.is_visible('#lnNo')
    if asked: page.click('#lnNo')
    check(asked, f'{tag}: 上下左右のとなりでは聞かれる（しない を選べる）')
    page.click('#placeEnd')
    page.evaluate("() => { delete UCT.G.bases[0].objs['1,4']; }")
    st = page.evaluate("() => { const b = UCT.G.bases[0]; return { f0: b.objs['0,5'].feed, f1: b.objs['1,5'].feed || null, d: b.objs['0,5'].dir } }")
    check(st['f0'] == '0,4' and st['f1'] is None, f'{tag}: する／しない が覚えられる {st}')
    page.wait_for_timeout(4000)
    st = page.evaluate("() => { const b = UCT.G.bases[0]; return { src: b.objs['0,4'].stock.length, items: ['0,5','1,5','2,5'].map(k => b.objs[k].item ? 1 : 0), mode: UCT.G.robots[0].mode } }")
    print(tag, st)
    check(st['items'][2] == 1, f'{tag}: 接続すると取り場の製品が自動でコンベアを流れる')
    shot(page, tag + '-18-flow')

    # 集荷の未達は、同じヤードの次の集荷に上乗せ（きょうの予定が無ければ、次の日の最初の集荷へ）
    st = page.evaluate('''() => { const G = UCT.G, b = G.bases[0], y = UC.spots(b, 'yard')[0], yk = UC.key(y.x, y.y);
      y.stock = [{ t: 0, packed: false }];
      b.kanban = [{ t: G.time + 0.5, need: 3, got: null, yard: yk }, { t: G.time + 300, need: 2, got: null, yard: yk }];
      UC.step(G, 1);
      const a = { got: b.kanban[0].got, next: b.kanban[1].need, carry: b.kanban[1].carry };
      b.kanban = [{ t: G.time + 0.5, need: 2, got: null, yard: yk }]; y.stock = [];
      UC.step(G, 1);
      a.left = (b.carry || {})[yk]; b.carry = {}; b.kanban = [];
      return a; }''')
    check(st['got'] == 1 and st['next'] == 4 and st['carry'] == 2 and st['left'] == 2, f'{tag}: 集荷の未達の数を次の集荷に上乗せする {st}')

    # 視点の回転：90° ずつ 4 回で 1 周。回してもタップしたマスに置ける
    page.click('#rotR'); page.wait_for_timeout(200)
    shot(page, tag + '-19-rot1')
    page.evaluate("() => { UCT.G.coin = 5000; for (const k of ['6,2', '12,6']) delete UCT.G.bases[0].objs[k]; }")
    page.click('#btnShop'); page.wait_for_timeout(200)
    page.click('button[data-a="place:pool"]'); page.wait_for_timeout(200)
    xy = page.evaluate("() => UCT.screenOf(6 + 0.5, 2 + 0.5)"); page.mouse.click(*xy); page.wait_for_timeout(150)
    page.click('#rotR'); page.click('#rotR'); page.wait_for_timeout(200)
    xy = page.evaluate("() => UCT.screenOf(12 + 0.5, 6 + 0.5)"); page.mouse.click(*xy); page.wait_for_timeout(150)
    shot(page, tag + '-20-rot3')
    page.click('#placeEnd')
    st = page.evaluate("() => ({ a: (UCT.G.bases[0].objs['6,2'] || {}).type, b: (UCT.G.bases[0].objs['12,6'] || {}).type, r: UCT.viewRot })")
    check(st['a'] == 'pool' and st['b'] == 'pool' and st['r'] == 3, f'{tag}: 視点を回しても、タップしたマスに置ける {st}')
    page.evaluate("() => UCT.clearNav()")
    xy = page.evaluate("() => UCT.screenOf(12 + 0.5, 6 + 0.5, 6)"); page.mouse.click(*xy); page.wait_for_timeout(150)
    st = page.evaluate("() => UCT.nav && [UCT.nav.x, UCT.nav.y]")
    check(st == [12, 6], f'{tag}: 視点を回しても、絵をタップして選べる {st}')
    page.click('#rotR'); page.wait_for_timeout(100)
    check(page.evaluate('() => UCT.viewRot') == 0, f'{tag}: 4 回で 1 周する')
    b.close()


with sync_playwright() as p:
    run(p, 390, 780, 'sp')
    if 'quick' not in sys.argv:
        run(p, 1200, 800, 'pc')

print('\n'.join(errors) if errors else 'エラーなし')
sys.exit(1 if errors else 0)
