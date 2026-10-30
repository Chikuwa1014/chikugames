#!/usr/bin/env python3
"""v2.3.0 の確認：お店のスタイル（新しいお店で選ぶ・閉店中に改装・商品とアップグレード名・店の色・ほかの店の営業）、
広告のごほうび（ふだんは出ない・?ad=test で 復活・返済不要の融資・スタイルの解放）、クリア演出。
使い方：先にリポジトリ直下で python3 -m http.server 8090 を起動してから
python3 shop-sim/dev/test-v230.py [スクリーンショットの出力先]（URL=… で変えられる）"""
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


DAYS = """(n)=>{ for(let d=0; d<n && !state.over; d++){ nextDay(); if(state.phase==='prep'){ fillAll(); openShop(); }
  let g=0; while(state.phase==='open' && g++<3000){ state.paused=false; state.kama=0; tick(); } } render(); }"""

# 会社まで作る（1号店を天井に → 店長 → 設立）
CO = """()=>{ newGame('hard'); state.slots=10; state.ad=18; state.clerk=1; state.cap=100; state.money=900000000; state.happy=90;
  state.own=[0,1,2,3,4,5,6,7,8,9]; state.shelf=state.own.map(id=>({id,st:0})); state.day=14; state.prev=3000000; render();
  hireMgr(); coFound('ちくわ商店', 5000000); state.tab=4; render(); }"""

with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': os.environ['PW_CHROME']} if os.environ.get('PW_CHROME') else {}))
    for W, H, tag in [(390, 820, 'sp'), (1280, 860, 'pc')]:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2 if W < 600 else 1)
        pg.add_init_script("try{localStorage.setItem('shop-sim-tutorial','1');localStorage.setItem('shop-sim-tutorial-co','1')}catch(e){}")
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL)
        pg.wait_for_timeout(500)

        # 広告はふだん出ない
        pg.evaluate("()=>{ newGame('hard'); state.tab=0; render(); }")
        check(tag + ' 広告：ふだんは ready() が false', pg.evaluate("()=>CG.ad.ready()") is False)
        check(tag + ' 広告：お金タブに返済不要の融資が出ない', pg.evaluate("()=>!document.querySelector('[data-a=adloan]')"))
        pg.evaluate("()=>{ state.over=true; state.ovx=false; render(); }")
        check(tag + ' 広告：倒産ポップアップに復活ボタンが出ない', pg.evaluate("()=>!byId('ovm').hidden && !document.querySelector('[data-a=adrev]')"))

        # 新しいお店でスタイルを選ぶ
        pg.evaluate(CO)
        r = pg.evaluate("()=>({n:byId('ssty').options.length, on:[...byId('ssty').options].filter(o=>!o.disabled).map(o=>o.value)})")
        check(tag + ' スタイル：12種、はじめはいつもの＋3つ', r['n'] == 12 and r['on'] == ['normal', 'food', 'toy', 'shoes'], r)
        pg.select_option('#ssty', 'toy')
        check(tag + ' スタイル：選ぶと説明が変わる', pg.evaluate("()=>/ミニカー|🫧/.test(document.querySelector('.stypv').textContent)"))
        pg.fill('#sname', 'おもちゃ館')
        pg.evaluate("()=>byId('ssty').scrollIntoView({block:'center'})")
        shot(pg, tag + '-1-newstore')
        pg.click('[data-a=coopen]')
        r = pg.evaluate("()=>({n:state.stores.length, sty:state.stores[1].sty, nm:state.stores[1].sname})")
        check(tag + ' スタイル：お店を出すとスタイルが付く', r['n'] == 2 and r['sty'] == 'toy' and r['nm'] == 'おもちゃ館', r)

        # ほかの店（おもちゃ屋）も営業する
        pg.evaluate(DAYS, 7)
        r = pg.evaluate("()=>({t:state.stores[1].tot||0, over:state.over})")
        check(tag + ' スタイル：店長のおもちゃ屋が売れる', r['t'] > 0 and not r['over'], r)

        # おもちゃ屋へ行く：商品・名前・色・よく買う人
        pg.evaluate("()=>{ coSwitch(1); }")
        pg.wait_for_timeout(300)
        r = pg.evaluate("()=>({p0:PRODUCTS[0].n, e0:PRODUCTS[0].e, c2:PRODUCTS[2].c, roof:PXT.r, g:gf(2,0), g2:gf(2,1)})")
        check(tag + ' スタイル：棚の商品がおもちゃ', r['p0'] == 'シャボン玉' and r['e0'] == '🫧' and r['c2'] == 180, r)
        check(tag + ' スタイル：店の色がスタイルの色', r['roof'] == '#3a9fe0', r)
        check(tag + ' スタイル：ミニカーは男性がよく買う', r['g'] == 2.5 and r['g2'] == 0.5, r)
        pg.evaluate("()=>{ state.up[0]=2; applyUp(); }")
        check(tag + ' スタイル：アップグレード名', pg.evaluate("()=>PRODUCTS[0].n") == '定番シャボン玉')
        pg.evaluate(DAYS, 3)
        check(tag + ' スタイル：おもちゃ屋で営業できる', pg.evaluate("()=>state.tot>0 && !state.over"))
        pg.evaluate("()=>{ state.tab=0; render(); }")
        shot(pg, tag + '-2-toyshop')

        # 1号店に戻ると、いつもの商品とイメージカラー
        pg.evaluate("()=>{ coSwitch(0); }")
        pg.wait_for_timeout(300)
        r = pg.evaluate("()=>({p0:PRODUCTS[0].n, roof:PXT.r})")
        check(tag + ' スタイル：1号店はいつもの', r['p0'] in ('おにぎり', 'しおむすび', 'うめ', 'こんぶ', 'しぐれ', 'ツナマヨ', 'めんたいこ', '熱ばくだん') and r['roof'] == '#2fbf97', r)

        # 1号店を改装（しょくりょうひん店）
        pg.evaluate("()=>{ state.tab=4; render(); }")
        pg.click('[data-a=costy][data-i="0"]')
        check(tag + ' 改装：スタイルの画面が開く', pg.evaluate("()=>!byId('stym').hidden && document.querySelectorAll('#stym .styr').length===12"))
        shot(pg, tag + '-3-stylepanel')
        pg.evaluate("()=>{ state.shelf.forEach(s=>s&&(s.st=5)); }")
        r0 = pg.evaluate("()=>({m:state.money, fee:styFee(state), back:state.shelf.reduce((a,s)=>a+(s?s.st*PRODUCTS[s.id].c:0),0)})")
        pg.click('#stym [data-a=stygo][data-v=food]')
        r = pg.evaluate("()=>({sty:state.sty, p0:PRODUCTS[0].n0, m:state.money, st:state.shelf.reduce((a,s)=>a+(s?s.st:0),0), hid:byId('stym').hidden, up:state.up[0]})")
        check(tag + ' 改装：しょくりょうひん店になる', r['sty'] == 'food' and r['p0'] == 'パン' and r['hid'], r)
        check(tag + ' 改装：改装費を払い、在庫は原価で引き取る', abs((r0['m'] - r0['fee'] + r0['back']) - r['m']) < 1 and r['st'] == 0, (r0, r))
        pg.evaluate("()=>{ state.phase='open'; styPanel(0); }")
        check(tag + ' 改装：開店中は押せない', pg.evaluate("()=>[...document.querySelectorAll('#stym [data-a=stygo]')].every(b=>b.disabled)"))
        pg.evaluate("()=>{ state.phase='closed'; styPanel(-1); }")
        check(tag + ' 改装：まだのスタイルには広告ボタンが出ない（広告なし）', pg.evaluate("()=>{ styPanel(0); const r=!document.querySelector('#stym [data-a=styad]'); styPanel(-1); return r; }"))

        # シーシャ屋はスタイルを選べない
        pg.evaluate("()=>{ state.co.lsel='shisha'; render(); }")
        check(tag + ' シーシャ屋：スタイルの選択が出ない', pg.evaluate("()=>!byId('ssty') && /シーシャ屋はフレーバー/.test(byId('co').textContent)"))
        pg.evaluate("()=>{ state.co.lsel='suburb'; render(); }")

        # 読み直してもスタイルが残る
        pg.evaluate("()=>save()")
        pg.reload()
        pg.wait_for_timeout(500)
        r = pg.evaluate("()=>({a:state.sty, b:state.stores[1].sty, p0:PRODUCTS[0].n0})")
        check(tag + ' 読み直し：スタイルが残る', r['a'] == 'food' and r['b'] == 'toy' and r['p0'] == 'パン', r)

        # クリア演出
        pg.evaluate("""()=>{ while(state.stores.length<5) state.stores.push(newStore((state.stores.length+1)+'号店','suburb','shoes'));
          state.sv=1e11; state.day=4200; state.stores[1].tot=1e12; render(); }""")
        check(tag + ' クリア：条件がそろう', pg.evaluate("()=>clrParts().every(p=>p.ok)"))
        pg.evaluate("()=>clrCheck()")
        pg.wait_for_timeout(1200)
        check(tag + ' クリア：カットインが出る', pg.evaluate("()=>!byId('clrm').hidden && !byId('clrm').classList.contains('s2')"))
        shot(pg, tag + '-4-clear-cutin')
        pg.wait_for_timeout(2400)
        check(tag + ' クリア：成績のカードが出る', pg.evaluate("()=>byId('clrm').classList.contains('s2') && /ちくわ商店/.test(byId('clrm').textContent)"))
        shot(pg, tag + '-5-clear-card')
        # v2.3.1〜 お店紹介 → おしまい
        pg.click('[data-a=clrtour]')
        pg.wait_for_timeout(700)
        r = pg.evaluate("()=>({i:clrTour.i, nm:document.querySelector('.clrnm').textContent, od:/1ヶ月目/.test(byId('clrm').textContent)})")
        check(tag + ' お店紹介：1号店から始まり、開店日が出る', r['i'] == 0 and r['od'], r)
        shot(pg, tag + '-6-clear-tour')
        pg.click('.clrsl')
        check(tag + ' お店紹介：タップで次のお店', pg.evaluate("()=>clrTour.i===1 && /おもちゃ館/.test(document.querySelector('.clrnm').textContent) && /通算/.test(byId('clrm').textContent)"))
        pg.wait_for_timeout(4800)
        check(tag + ' お店紹介：4.5秒で次へ進む', pg.evaluate("()=>clrTour.i===2"))
        pg.click('[data-a=clrskip]')
        pg.wait_for_timeout(500)
        check(tag + ' お店紹介：スキップでおしまい', pg.evaluate("()=>!!document.querySelector('.clrend') && /おしまい/.test(byId('clrm').textContent)"))
        check(tag + ' お店紹介：横にずれない', pg.evaluate("()=>byId('clrm').scrollLeft===0 && scrollX===0"))
        shot(pg, tag + '-7-clear-end')
        pg.click('[data-a=clrclose]')
        pg.evaluate("()=>achCheck()")
        r = pg.evaluate("()=>({hid:byId('clrm').hidden, clr:!!state.co.clr, card:!byId('clrc').hidden, ach:!!achGot.clear})")
        check(tag + ' クリア：閉じると続けられ、設定と実績に残る', r['hid'] and r['clr'] and r['card'] and r['ach'], r)
        pg.evaluate("()=>clrCheck()")
        pg.wait_for_timeout(500)
        check(tag + ' クリア：2回目は出ない', pg.evaluate("()=>byId('clrm').hidden"))
        check(tag + ' エラーなし（広告なし）', not errs, errs)

        # ?ad=test：仮の広告
        errs.clear()
        pg.goto(URL + '?ad=test')
        pg.wait_for_timeout(500)
        check(tag + ' 仮の広告：ready() が true', pg.evaluate("()=>CG.ad.ready()") is True)
        pg.evaluate("()=>{ state.tab=0; render(); }")
        check(tag + ' 仮の広告：返済不要の融資が2種類', pg.evaluate("()=>document.querySelectorAll('[data-a=adloan]').length===2"))
        m0 = pg.evaluate("()=>state.money")
        amt = pg.evaluate("()=>adLoanAmt(1)")
        pg.evaluate("()=>document.querySelector('[data-a=adloan][data-v=short]').scrollIntoView({block:'center'})")
        shot(pg, tag + '-6-adloan')
        pg.click('[data-a=adloan][data-v=short]')
        pg.wait_for_timeout(6200)
        r = pg.evaluate("()=>({d:state.money, used:state.adLoan===state.day, dis:[...document.querySelectorAll('[data-a=adloan]')].every(b=>b.disabled)})")
        check(tag + ' 仮の広告：見終わると融資がもらえ、今日はもう押せない', abs(r['d'] - m0 - amt) < 1 and r['used'] and r['dis'], (m0, amt, r))
        # スタイルの解放（1日1回）
        pg.evaluate("()=>{ state.tab=4; render(); styPanel(0); }")
        pg.click('#stym [data-a=styad][data-v=car]')
        pg.wait_for_timeout(6200)
        r = pg.evaluate("()=>({u:styOpen().includes('car'), more:[...document.querySelectorAll('#stym [data-a=styad]')].every(b=>b.disabled)})")
        check(tag + ' 仮の広告：スタイルが解放され、今日はもう解放できない', r['u'] and r['more'], r)
        pg.evaluate("()=>styPanel(-1)")
        # 倒産からの復活
        pg.evaluate("()=>{ state.money=-3000000; state.over=true; state.ovx=false; state.overMsg='テスト'; render(); }")
        check(tag + ' 仮の広告：倒産ポップアップに復活ボタン', pg.evaluate("()=>!!document.querySelector('#ovm [data-a=adrev]')"))
        shot(pg, tag + '-7-revive')
        q = pg.evaluate("()=>r100(quota()*0.5)")
        pg.click('#ovm [data-a=adrev]')
        pg.wait_for_timeout(6200)
        r = pg.evaluate("()=>({over:state.over, m:state.money, hid:byId('ovm').hidden})")
        check(tag + ' 仮の広告：復活（マイナスを0にしてノルマの50%）', not r['over'] and abs(r['m'] - q) < 1 and r['hid'], (q, r))
        check(tag + ' エラーなし（仮の広告）', not errs, errs)
        pg.close()
    b.close()

print('\n' + ('すべてOK' if not fails else 'NG：' + '、'.join(fails)))
sys.exit(1 if fails else 0)
