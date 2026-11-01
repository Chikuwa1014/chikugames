#!/usr/bin/env python3
"""v2.4.0 の確認：融資の行が枠に収まる・店舗管理の「この店へ行く」が1行・10店舗で出店の名前を入力できない・
お店の絵を左右にはらうと隣の店へ・○号店のチップで店の一覧（閉店後だけ行ける）。スマホ幅と PC 幅。
使い方：先にリポジトリ直下で python3 -m http.server 8090 を起動してから python3 shop-sim/dev/test-v240.py [スクリーンショットの出力先]"""
import os
import sys
from playwright.sync_api import sync_playwright

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


# 会社を作り、店を n 軒にする（1号店は天井・お金は多め）
SETUP = """(n)=>{ newGame('hard'); state.slots=10; state.ad=18; state.clerk=1; state.cap=100; state.money=2000000000;
  state.own=[0,1,2,3,4,5,6,7,8,9]; state.shelf=state.own.map(id=>({id,st:0})); state.day=14; state.prev=3000000;
  hireMgr(); coFound('テスト商会', 1000000); state.qual=true;
  for (let i=1;i<n;i++){ state.stores.forEach(x=>x.qual=true); state.qual=true; coOpen('店'+(i+1), ['suburb','downtown','uptown','station','dept','shisha'][i%6]); coSwitch(0); } state.tab=2; render(); }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for W, H, tag in [(390, 844, 'sp'), (1280, 860, 'pc')]:
        pg = b.new_page(viewport={'width': W, 'height': H})
        pg.add_init_script("try{localStorage.setItem('shop-sim-tutorial','1');localStorage.setItem('shop-sim-tutorial-co','1')}catch(e){}")
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL)
        pg.wait_for_timeout(400)

        # 融資：2つの選択肢と「借りる」が、カードの枠の中に収まる
        pg.evaluate(SETUP, 2)
        # 一番長い選択（150万円・60ヶ月払い）にしても、行の中に収まる
        pg.evaluate("()=>{ state.ln.a=1500000; state.ln.m=60; state.tab=2; render(); }")
        pg.wait_for_timeout(200)
        r = pg.evaluate("""()=>{ const b=document.querySelector('[data-a=loan]'), row=b.closest('.row'), R=row.getBoundingClientRect();
          const sel=[...row.querySelectorAll('select')].map(s=>s.getBoundingClientRect());
          return {btnR:Math.round(b.getBoundingClientRect().right), rowR:Math.round(R.right), selOver:sel.some(x=>x.right>R.right), wrap:row.scrollWidth>row.clientWidth+1} }""")
        check(tag + ' 融資の「借りる」が行の中に収まる', r['btnR'] <= r['rowR'] and not r['selOver'] and not r['wrap'], r)
        shot(pg, tag + '-loan')

        # 店舗管理：「この店へ行く」などが1行
        pg.evaluate("()=>{ state.tab=4; render(); }")
        r = pg.evaluate("""()=>[...document.querySelectorAll('.sti .btns')].map(bt=>({h:bt.offsetHeight, bs:[...bt.querySelectorAll('button')].map(x=>x.offsetHeight)}))""")
        check(tag + ' 店舗管理のボタンが1行', all(x['h'] <= 44 and all(v <= 44 for v in x['bs']) for x in r), r)
        shot(pg, tag + '-stores')

        # 10店舗：出店の名前と場所を入力できない
        pg.evaluate(SETUP, 10)
        pg.evaluate("()=>{ state.tab=4; render(); }")
        r = pg.evaluate("()=>({dis:document.getElementById('sname').disabled, radios:[...document.querySelectorAll('input[name=loc]')].every(x=>x.disabled)})")
        check(tag + ' 10店舗で名前と場所が入力できない', r['dis'] and r['radios'], r)
        pg.evaluate(SETUP, 2)
        pg.evaluate("()=>{ state.tab=4; render(); }")
        check(tag + ' 2店舗のときは入力できる', pg.evaluate("()=>!document.getElementById('sname').disabled"))

        # お店の絵を左右にはらうと、隣のお店へ（閉店後だけ）
        pg.evaluate(SETUP, 3)
        pg.evaluate("()=>{ state.tab=0; render(); }")
        cur0 = pg.evaluate("()=>state.cur")
        def swipe(dx):
            pg.evaluate("""(dx)=>{ const el=document.querySelector('.pxw');
              const t=(x,y)=>new Touch({identifier:1,target:el,clientX:x,clientY:y});
              const s=t(200,100), e=t(200+dx,104);
              el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[s],targetTouches:[s],changedTouches:[s]}));
              el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],targetTouches:[],changedTouches:[e]})); }""", dx)
            pg.wait_for_timeout(150)
        swipe(-120)
        check(tag + ' 左にはらうと次の店', pg.evaluate("()=>state.cur") == (cur0 + 1) % 3, [cur0, pg.evaluate("()=>state.cur")])
        swipe(120)
        check(tag + ' 右にはらうと前の店', pg.evaluate("()=>state.cur") == cur0, pg.evaluate("()=>state.cur"))
        swipe(-20)
        check(tag + ' 小さな動きでは切り替えない', pg.evaluate("()=>state.cur") == cur0)
        pg.evaluate("()=>{ state.phase='open'; render(); }")
        swipe(-120)
        check(tag + ' 営業中は切り替えない', pg.evaluate("()=>state.cur") == cur0)
        pg.evaluate("()=>{ state.phase='closed'; render(); }")

        # ○号店のチップ：店の一覧を出して、選んだ店へ行く
        pg.click('.chip.sto')
        pg.wait_for_timeout(150)
        r = pg.evaluate("()=>({open:!byId('copick').hidden, n:document.querySelectorAll('#copick [data-a=pickgo]').length, dis:[...document.querySelectorAll('#copick [data-a=pickgo]')].map(x=>x.disabled)})")
        check(tag + ' チップで店の一覧（閉店後は行ける）', r['open'] and r['n'] == 3 and r['dis'] == [True, False, False], r)
        shot(pg, tag + '-pick')
        pg.click('#copick [data-a=pickgo][data-i="2"]')
        pg.wait_for_timeout(150)
        check(tag + ' 一覧から選ぶとその店へ行く', pg.evaluate("()=>state.cur===2 && byId('copick').hidden"), pg.evaluate("()=>state.cur"))
        pg.evaluate("()=>{ state.phase='open'; render(); }")
        pg.click('.chip.sto')
        pg.wait_for_timeout(150)
        check(tag + ' 営業中は一覧の店へ行けない', pg.evaluate("()=>[...document.querySelectorAll('#copick [data-a=pickgo]')].every(x=>x.disabled)"))
        pg.evaluate("()=>{ state.phase='closed'; render(); }")

        check(tag + ' ページのエラーなし', not errs, errs)
        pg.close()
    b.close()

print('---')
print('すべて OK' if not fails else 'NG: ' + ', '.join(fails))
sys.exit(1 if fails else 0)
