#!/usr/bin/env python3
"""v2.4.3 の確認：預金があるのに倒産しない（閉店時の倒産判定の前に預金から自動で引き出す・ほかの店の売上が入ったあとで判定）。
預金が足りないときは今までどおり倒産する。商品が尽きて資金がマイナスのときも同じ。
使い方：先にリポジトリ直下で python3 -m http.server 8090 を起動してから python3 shop-sim/dev/test-v243.py"""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL') or 'http://localhost:8090/shop-sim/'
fails = []


def check(name, ok, info=''):
    print(('OK  ' if ok else 'NG  ') + name + (' … ' + str(info) if info and not ok else ''))
    if not ok:
        fails.append(name)


# 会社と3店（1号店は天井）。閉店の直前（営業中・今日は売れた）にする。乱数は 0.99 にしてイベントを起こさない
SETUP = """(o)=>{ newGame('normal'); state.slots=10; state.ad=18; state.clerk=1; state.cap=100; state.money=2000000000;
  state.own=[0,1,2,3,4,5,6,7,8,9]; state.shelf=state.own.map(id=>({id,st:50})); state.day=14; state.prev=30000000;
  hireMgr(); coFound('テスト商会', 1000000); state.qual=true;
  for (let i=1;i<3;i++){ state.stores.forEach(x=>x.qual=true); state.qual=true; coOpen('店'+(i+1), ['suburb','downtown'][i-1]); coSwitch(0); }
  state.day=o.day; state.phase='open'; state.dSold=10; state.dRev=1000000; state.money=o.money; state.sv=o.sv;
  if (o.empty) state.shelf.forEach(s=>{ if (s) s.st=0; });
  const R=Math.random; Math.random=()=>0.99; try { endDay(); } finally { Math.random=R; }
  return { over: !!state.over, money: state.money, sv: state.sv, limit: LIMIT, log: (state.log||[]).slice(-6) }; }"""

with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': os.environ['PW_CHROME']} if os.environ.get('PW_CHROME') else {}))
    pg = b.new_page(viewport={'width': 390, 'height': 844})
    pg.add_init_script("try{localStorage.setItem('shop-sim-tutorial','1');localStorage.setItem('shop-sim-tutorial-co','1')}catch(e){}")
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_timeout(400)

    # 月の途中：所持金が倒産ラインを大きく下回っても、預金があれば引き出して倒産しない
    r = pg.evaluate(SETUP, {'day': 10, 'money': -50000000, 'sv': 1000000000})
    check('月の途中・預金あり → 倒産しない', not r['over'] and r['money'] >= 0 and r['sv'] < 1000000000, r)
    check('自動で引き出したことをログに出す', any('預金から' in x for x in r['log']), r['log'])
    # 月末の日も同じ
    r = pg.evaluate(SETUP, {'day': 14, 'money': -50000000, 'sv': 1000000000})
    check('月末・預金あり → 倒産しない', not r['over'], r)
    # 倒産ラインより上のマイナスなら、月の途中は引き出さない（今までどおり）
    r = pg.evaluate(SETUP, {'day': 10, 'money': -1000, 'sv': 1000000000})
    check('月の途中・倒産ラインより上のマイナス → 引き出さない', not r['over'] and r['sv'] == 1000000000, r)
    # 預金が足りないときは倒産する
    r = pg.evaluate(SETUP, {'day': 10, 'money': -50000000, 'sv': 1000})
    check('預金が足りない → 倒産する', r['over'] and r['sv'] == 0, r)
    r = pg.evaluate(SETUP, {'day': 10, 'money': -50000000, 'sv': 0})
    check('預金0 → 倒産する', r['over'], r)
    # 商品が尽きて資金がマイナス：預金があれば倒産しない・なければ倒産
    r = pg.evaluate(SETUP, {'day': 10, 'money': -1000000, 'sv': 5000000, 'empty': True})
    check('商品切れ・預金あり → 倒産しない', not r['over'] and r['money'] >= 0, r)
    r = pg.evaluate(SETUP, {'day': 10, 'money': -1000000, 'sv': 0, 'empty': True})
    check('商品切れ・預金0 → 倒産する', r['over'], r)
    # ほかの店のその日の売上が入ったあとで判定する（倒産ラインを少し下回っても、ほかの店の利益で戻れば倒産しない）
    r = pg.evaluate("""()=>{ newGame('normal'); state.slots=10; state.ad=18; state.clerk=1; state.money=2000000000; state.prev=30000000;
      state.own=[0,1,2,3,4,5,6,7,8,9]; state.shelf=state.own.map(id=>({id,st:50})); hireMgr(); coFound('テスト商会', 1000000); state.qual=true;
      for (let i=1;i<3;i++){ state.stores.forEach(x=>x.qual=true); state.qual=true; coOpen('店'+(i+1), 'suburb'); coSwitch(0); }
      state.day=10; state.phase='open'; state.dSold=10; state.sv=0;
      LIMIT = -Math.floor(quota() * difficulty().bank / 1000) * 1000;
      const lim=LIMIT; let m0=0; const cd=coDaily; coDaily=function(){ m0=state.money; cd(); };
      state.money = lim - 1;
      const R=Math.random; Math.random=()=>0.99; try { endDay(); } finally { Math.random=R; coDaily=cd; }
      return { over: !!state.over, before: m0, after: state.money, lim }; }""")
    check('ほかの店の売上が入ってから判定する', (r['after'] >= r['lim']) == (not r['over']) and r['before'] < r['lim'], r)
    check('ページのエラーなし', not errs, errs)
    b.close()

print('すべて OK' if not fails else 'NG：' + '、'.join(fails))
