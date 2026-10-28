#!/usr/bin/env python3
"""v1.5.1 の確認：デバッグ報告 #9（店員の解雇）・#3（空が赤い理由）・#6（夜に窓の裏へ隠れる）・#10（営業ログ）。
使い方：python3 shop-sim/dev/test-v151.py [スクリーンショットの出力先]
サーバー不要（file:// で index.html を開く）。"""
import os
import sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.abspath(os.path.join(HERE, '..', 'index.html'))
OUT = sys.argv[1] if len(sys.argv) > 1 else None
fails = []


def check(name, ok, info=''):
    print(('OK  ' if ok else 'NG  ') + name + (' … ' + str(info) if info and not ok else ''))
    if not ok:
        fails.append(name)


def new_page(b, w=390, h=760):
    pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=2)
    pg.add_init_script("try{localStorage.setItem('shop-sim-tutorial','1')}catch(e){}")  # v2.0.0：遊び方（チュートリアル）を出さない
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_timeout(600)
    pg.evaluate("""()=>{ state.diff='normal'; state.over=false; state.phase='closed'; state.dOpen=true; state.dSold=100; state.dRev=1000000;
      state.up[3]=7; state.shelf[0]={id:3,st:5}; state.money=50000000; state.happy=80; state.sick=0; state.dep=0; }""")
    return pg, errs


# Math.random を決まった順に返す（足りなくなったら 0.9）
SEQ = """(a)=>{ let i=0; Math.random=()=> i<a.length ? a[i++] : 0.9; }"""

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---- #9 店員の解雇 ----
    # 順序：強盗 0.9（なし）・従業員の窃盗 0.9（なし）・万年筆の泥棒 0.0（あり）・盗まれる割合 0.5・
    #       解雇人数の判定（店員数-1回）・士気低下 0.0（あり）・低下量 0.99（=10）
    pg, errs = new_page(b)
    pg.evaluate("()=>{ state.clerk=6; state.sk=10; state.dn=0; state.evs=[]; }")
    pg.evaluate(SEQ, [0.9, 0.9, 0.0, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.0, 0.99])
    pg.evaluate("()=>endDay()")
    r = pg.evaluate("()=>({clerk:state.clerk, dn:state.dn, ev:state.evs.filter(t=>/解雇/.test(t))[0]||''})")
    check('#9 士気低下が付く（0→10）', r['clerk'] == 5 and r['dn'] == 10, r)
    check('#9 文面は実際に下がった10Lv', '10Lv低下' in r['ev'], r)

    pg.evaluate("()=>{ state.clerk=6; state.sk=10; state.dn=5; state.evs=[]; state.dOpen=true; state.dSold=100; state.over=false; }")
    pg.evaluate(SEQ, [0.9, 0.9, 0.0, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.0, 0.99])
    pg.evaluate("()=>endDay()")
    r = pg.evaluate("()=>({dn:state.dn, ev:state.evs.filter(t=>/解雇/.test(t))[0]||''})")
    check('#9 上限で切られたとき、文面は実際の5Lv（5→10）', r['dn'] == 10 and '5Lv低下' in r['ev'] and '10Lv低下' not in r['ev'], r)

    pg.evaluate("()=>{ state.clerk=6; state.sk=10; state.dn=10; state.evs=[]; state.dOpen=true; state.dSold=100; state.over=false; }")
    pg.evaluate(SEQ, [0.9, 0.9, 0.0, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.0, 0.99])
    pg.evaluate("()=>endDay()")
    r = pg.evaluate("()=>({dn:state.dn, ev:state.evs.filter(t=>/解雇/.test(t))[0]||''})")
    check('#9 すでに上限なら能力低下の文面は出さない', r['dn'] == 10 and '能力が' not in r['ev'] and '解雇' in r['ev'], r)

    pg.evaluate("()=>{ state.clerk=2; state.sk=10; state.dn=0; state.evs=[]; state.dOpen=true; state.dSold=100; state.over=false; }")
    pg.evaluate(SEQ, [0.9, 0.9, 0.0, 0.5, 0.0, 0.0, 0.99])
    pg.evaluate("()=>endDay()")
    r = pg.evaluate("()=>({clerk:state.clerk, dn:state.dn, ev:state.evs.filter(t=>/解雇/.test(t))[0]||''})")
    check('#9 全員解雇のとき士気低下は付かない', r['clerk'] == 0 and r['dn'] == 0 and '能力が' not in r['ev'], r)

    pg.evaluate("()=>{ state.clerk=6; state.sk=10; state.dn=10; state.phase='closed'; render(); }")
    pg.evaluate("()=>{ const t=[...document.querySelectorAll('button')].find(e=>/投資/.test(e.textContent)); t&&t.click(); }")
    pg.wait_for_timeout(200)
    txt = pg.evaluate("()=>[...document.querySelectorAll('.card.up .nm')].map(e=>e.textContent).find(t=>/店員の能力/.test(t))||''")
    check('#9 能力カードに本来Lvと士気低下を併記', 'Lv.0/10' in txt and '本来Lv.10' in txt and '士気低下-10' in txt, txt)
    pg.evaluate("()=>{ state.dn=0; render(); }")
    txt = pg.evaluate("()=>[...document.querySelectorAll('.card.up .nm')].map(e=>e.textContent).find(t=>/店員の能力/.test(t))||''")
    check('#9 士気低下がなければ併記しない', '本来' not in txt, txt)
    if OUT:
        pg.evaluate("()=>{ state.dn=10; render(); }")
        pg.screenshot(path=os.path.join(OUT, 'v151-9-card.png'))
    check('#9 ページのエラーなし', not errs, errs)
    pg.close()

    # ---- #3 空が赤い理由：v1.5.2 のお知らせ、v1.5.3 で左下ラベル（#badw）は廃止（dev/test-v152.py・test-v153.py を参照） ----

    # ---- #6 夜に窓の裏へ隠れる ----
    pg, errs = new_page(b)
    pg.evaluate("""()=>{ state.day=2; state.phase='closed'; state.weather=1; state.fx=['boom','pay']; state.fxd=2; state.bad=undefined; render(); }""")
    pg.wait_for_timeout(700)
    LIT = (255, 243, 196)

    def px(x, y):
        # v2.0.0〜 canvas の実体は 768×368（実ピクセル 384×184 の2倍）
        return pg.evaluate("([x,y])=>Array.from(cx.getImageData(x*2,y*2,1,1).data).slice(0,3)", [x, y])

    # 行列の2人目（論理 x=113、頭のかみの毛は実ピクセル (X+2..X+8, Y)）。窓の下端は論理 y=60 → 実 120
    head = px(113 * 2 + 4, 57 * 2 + 1)
    check('#6 夜：行列の人の頭が窓に隠れない', tuple(head) != LIT and head[0] < 200, head)
    st = px(56 * 2 + 2, 44 * 2 + 2)
    check('#6 夜：窓のステッカーが見える', st[2] > 150 and st[0] < 120, st)
    if OUT:
        pg.locator('#px').screenshot(path=os.path.join(OUT, 'v151-6-night.png'))
    # 昼（開店中）でも変わらない
    pg.evaluate("()=>{ state.phase='open'; state.t=10; state.openH=9; render(); }")
    pg.wait_for_timeout(500)
    head = px(113 * 2 + 4, 57 * 2 + 1)
    check('#6 昼：行列の人の頭が見える', head[0] < 200, head)
    # ほかの夜のイベント人物（万年筆泥棒）でもエラーが出ない
    pg.evaluate("()=>{ state.phase='closed'; state.fx=['ninja','flood','snow','crash6','bomb','quake','flame','mama','papa','thief','robber']; state.fxd=state.day; render(); }")
    pg.wait_for_timeout(700)
    check('#6 ページのエラーなし（全イベントの絵を夜に描く）', not errs, errs)
    pg.close()

    # ---- #10 営業ログが 15:00 ごろからしか読めない（営業時間 5:00〜23:00） ----
    pg, errs = new_page(b)
    pg.evaluate("""()=>{ state.diff='easy'; state.openH=5; state.closeH=23; state.ad=20; state.cap=100000;
      state.shelf.forEach(s=>{ if(s) s.st=100000; }); state.phase='open'; state.t=0; state.paused=false; state.kama=0; state.hol=false;
      state.dOpen=true; state.dSold=0; state.dRev=0; state.clerk=0; state.over=false; render(); }""")
    n = pg.evaluate("""()=>{ let n=0; while(state.phase==='open' && n<200){ tick(); n++; } return n; }""")
    r = pg.evaluate("""()=>{ const L=logList(), sales=L.filter(l=>l.s).map(l=>l.t);
      const hrs=sales.map(t=>parseInt((t.match(/🛒 (\\d+):/)||[])[1])).filter(x=>!isNaN(x));
      return {len:L.length, sales:sales.length, first:Math.min(...hrs), last:Math.max(...hrs), el:byId('lg').children.length}; }""")
    check('#10 1日分（18時間）を最後まで進めた', n >= 85, n)
    check('#10 履歴が50件を超えて残る', r['len'] > 50 and r['sales'] > 50, r)
    check('#10 開店直後（5時台）の行が読める', r['first'] == 5, r)
    check('#10 閉店ごろ（22時台）の行も読める', r['last'] >= 22, r)
    check('#10 ログ欄にも全部並ぶ', r['el'] == r['len'], r)
    check('#10 ページのエラーなし', not errs, errs)
    pg.close()
    b.close()

print('\n失敗：' + ', '.join(fails) if fails else '\nすべて OK')
sys.exit(1 if fails else 0)
