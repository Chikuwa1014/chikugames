#!/usr/bin/env python3
"""v2.1.0 の確認：店長を雇う・会社の設立・新しいお店（出店場所6種類）・店の切り替え・景気・会社のステータス。
使い方：先にリポジトリ直下で python3 -m http.server 8090 を起動してから
python3 shop-sim/dev/test-company.py [スクリーンショットの出力先]
（file:// だと、読み直したときに localStorage が消えることがあるため、サーバーで開く。URL=… で変えられる）"""
import os
import sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('URL') or 'http://localhost:8090/shop-sim/'
OUT = sys.argv[1] if len(sys.argv) > 1 else None
fails = []


def check(name, ok, info=''):
    print(('OK  ' if ok else 'NG  ') + name + (' … ' + str(info) if info and not ok else ''))
    if not ok:
        fails.append(name)


def shot(pg, name):
    if OUT:
        os.makedirs(OUT, exist_ok=True)
        pg.screenshot(path=os.path.join(OUT, name + '.png'))


# 早回しで n 日進める（ボットと同じ：補充して開店、閉店まで tick）
DAYS = """(n)=>{ for(let d=0; d<n && !state.over; d++){ nextDay(); if(state.phase==='prep'){ fillAll(); openShop(); }
  let g=0; while(state.phase==='open' && g++<3000){ state.paused=false; state.kama=0; tick(); } } render(); }"""

# 1号店を「天井」にして、お金を多めにする
CEIL = """()=>{ newGame('hard'); state.slots=10; state.ad=18; state.clerk=1; state.cap=100; state.money=200000000; state.happy=90;
  state.own=[0,1,2,3,4,5,6,7,8,9]; state.shelf=state.own.map(id=>({id,st:0})); state.day=14; state.prev=3000000; render(); }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for W, H, tag in [(390, 820, 'sp'), (1280, 860, 'pc')]:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2 if W < 600 else 1)
        pg.add_init_script("try{localStorage.setItem('shop-sim-tutorial','1');localStorage.setItem('shop-sim-tutorial-co','1')}catch(e){}")
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL)
        pg.wait_for_timeout(500)
        pg.evaluate("()=>{ newGame('hard'); state.tab=1; render(); }")
        r = pg.evaluate("()=>({row:!!document.querySelector('[data-a=hiremgr]'), tabs:byId('tabr').children.length})")
        check(tag + ' 最初は「店長を雇う」も会社タブも出ない', not r['row'] and r['tabs'] == 4, r)

        pg.evaluate(CEIL)
        pg.evaluate("()=>{ state.money=1000; render(); }")
        check(tag + ' お金が足りないと出ない', not pg.evaluate("()=>!!document.querySelector('[data-a=hiremgr]')"))
        pg.evaluate("()=>{ state.money=200000000; state.tab=1; render(); }")
        check(tag + ' 条件を満たすと投資タブに出る', pg.evaluate("()=>!!document.querySelector('[data-a=hiremgr]') && /店長を雇ってオーナーになる/.test(byId('up').textContent)"))
        shot(pg, tag + '-1-invest')
        pg.click('[data-a=hiremgr]')
        r = pg.evaluate("()=>({co:!!state.co, tabs:byId('tabr').children.length, tab:state.tab, vis:byId('p4').style.display, mgr:state.mgr})")
        check(tag + ' 雇うと会社タブが出て開く', r['co'] and r['tabs'] == 5 and r['tab'] == 4 and r['vis'] == '' and r['mgr'], r)
        check(tag + ' 雇ったあとは投資タブから消える', not pg.evaluate("()=>!!document.querySelector('[data-a=hiremgr]')"))
        shot(pg, tag + '-2-found')

        # 会社の設立
        pg.fill('#coname', 'ちくわ商店')
        pg.select_option('#cocap', '5000000')
        m0 = pg.evaluate("()=>state.money")
        pg.click('[data-a=cofound]')
        r = pg.evaluate("()=>({est:state.co.est, name:state.co.name, cap:state.co.cap, money:state.money})")
        check(tag + ' 設立：屋号と資本金', r['est'] and r['name'] == 'ちくわ商店' and r['cap'] == 5000000 and m0 - r['money'] == 5000000 + 250000, r)
        check(tag + ' 景気は 0.75〜1.25', pg.evaluate("()=>{ const k=state.co.ek; let ok=true; for(let i=0;i<600;i++){ state.co.ek=i; const e=econ(); if(e<0.75||e>1.25) ok=false; } state.co.ek=k; return ok; }"))
        check(tag + ' 出店枠は1', pg.evaluate("()=>storeSlots()") == 1)
        check(tag + ' 増資（¥1,000万）はまだできない', len(pg.evaluate("()=>capNext().why")) > 0)

        # 新しいお店（繁華街）
        pg.fill('#sname', '駅前店')
        pg.click('label.loc:has(input[value=downtown])')
        pg.click('[data-a=coopen]')
        r = pg.evaluate("()=>({n:state.stores.length, s:state.stores[1].sname, loc:state.stores[1].loc, slots:state.stores[1].slots, sl:storeSlots()})")
        check(tag + ' 出店：名前と場所・ちいさなお店の初期状態', r['n'] == 2 and r['s'] == '駅前店' and r['loc'] == 'downtown' and r['slots'] == 2 and r['sl'] == 0, r)
        shot(pg, tag + '-3-company')

        # 1ヶ月進める：店長の店も売れて、月末に会社の記録が付く
        pg.evaluate(DAYS, 7)
        r = pg.evaluate("()=>({tot:state.stores[1].tot, hist:state.co.hist.length, over:state.over, rep:state.rep})")
        check(tag + ' 店長の店にも売上', r['tot'] > 0, r)
        check(tag + ' 月末に会社の記録', r['hist'] >= 1 and not r['over'], r)
        check(tag + ' 月末の支払いに店長の給料', '店長の給料' in r['rep'], r)

        # 店の切り替え
        # （3ヶ月ごとの棚の増設や車の事故で棚の数が変わることがあるので、切り替える前の数とくらべる）
        b0, b1 = pg.evaluate("()=>[state.slots, state.stores[1].slots]")
        pg.evaluate("()=>coSwitch(1)")
        r = pg.evaluate("()=>({cur:state.cur, loc:state.loc, slots:state.slots, s0:state.stores[0].slots, chip:byId('dt').textContent})")
        check(tag + ' 切り替え：行き先の店が出る', r['cur'] == 1 and r['loc'] == 'downtown' and r['slots'] == b1 and r['s0'] == b0 and '駅前店' in r['chip'], r)
        pg.evaluate("()=>{ state.tab=0; render(); drawPx(); }")
        shot(pg, tag + '-4-downtown')
        pg.evaluate("()=>coSwitch(0)")
        check(tag + ' 戻ると1号店', pg.evaluate("(b0)=>state.cur===0 && state.slots===b0 && state.loc==='suburb'", b0))

        # ほかの出店場所の絵（出店枠を足して出す）
        for loc in ['uptown', 'dept', 'station']:
            pg.evaluate("(l)=>{ state.stores.forEach(s=>s.qual=true); state.qual=true; coOpen(l+'店', l); coSwitch(state.stores.length-1); state.tab=0; render(); drawPx(); }", loc)
            check(tag + ' ' + loc + ' に出店して切り替え', pg.evaluate("(l)=>state.loc===l", loc))
            shot(pg, tag + '-5-' + loc)
            pg.evaluate("()=>coSwitch(0)")
        check(tag + ' シーシャ屋が解放', pg.evaluate("()=>shishaOpen()"))
        pg.evaluate("()=>{ state.stores.forEach(s=>s.qual=true); state.qual=true; coOpen('けむり亭', 'shisha'); coSwitch(state.stores.length-1); state.tab=0; render(); drawPx(); }")
        r = pg.evaluate("()=>({loc:state.loc, n:PRODUCTS[0].n, e:PRODUCTS[0].e, k:kindN(), up:upName(0,1)})")
        check(tag + ' シーシャ屋はフレーバー7種', r['loc'] == 'shisha' and r['n'] == 'Wアップル' and r['k'] == 7 and r['up'] == 'Wアップル・ミックス', r)
        pg.evaluate(DAYS, 2)
        shot(pg, tag + '-6-shisha')
        pg.evaluate("()=>coSwitch(0)")
        check(tag + ' 1号店に戻ると元の商品', pg.evaluate("()=>PRODUCTS[0].e==='🍙' && kindN()===PRODUCTS.length"))

        # 方針・ステータス画面
        pg.evaluate("()=>{ state.tab=4; render(); }")
        pg.select_option('select.cosel', 'daily')
        check(tag + ' 会社方針の変更', pg.evaluate("()=>state.co.pol") == 'daily')
        pg.evaluate(DAYS, 7)
        check(tag + ' 地域密着の取引収入', pg.evaluate("()=>state.co.trTot") > 0)
        pg.evaluate("()=>{ state.tab=4; render(); }")
        shot(pg, tag + '-7-company2')
        pg.click('[data-a=costat]')
        r = pg.evaluate("()=>({vis:!byId('costm').hidden, bars:document.querySelectorAll('.cob').length, rows:document.querySelectorAll('.cotb tr').length})")
        check(tag + ' 会社のステータス（グラフと店舗の表）', r['vis'] and r['bars'] >= 2 and r['rows'] == 7, r)
        pg.wait_for_timeout(450)
        shot(pg, tag + '-8-status')
        pg.click('[data-a=costclose]')

        # セーブして読み直しても続きから
        pg.evaluate("()=>save()")
        pg.reload()
        pg.wait_for_timeout(500)
        r = pg.evaluate("()=>({co:state.co && state.co.name, n:(state.stores || []).length, tabs:byId('tabr').children.length})")
        check(tag + ' 読み直しても会社とお店が残る', r['co'] == 'ちくわ商店' and r['n'] == 6 and r['tabs'] == 5, r)
        check(tag + ' エラーなし', not errs, errs)
        pg.close()
    b.close()

print('---')
print('NG: ' + ', '.join(fails) if fails else 'すべて OK')
sys.exit(1 if fails else 0)
