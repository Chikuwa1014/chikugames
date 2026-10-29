#!/usr/bin/env python3
"""v2.2.0 の確認：デバッグ報告#13（ログが店ごと）・通算の表示・千円単位・月末の支払い予想の縮小・お店のダッシュボード・
会社の遊び方・預金のスライダー・拡大縮小を止める指定。スマホ幅と PC 幅。
使い方：先にリポジトリ直下で python3 -m http.server 8090 を起動してから
python3 shop-sim/dev/test-v220.py [スクリーンショットの出力先]"""
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


# 1日営業する（補充して開店、閉店まで tick。休業の日はそのまま）
DAY = """()=>{ state.warn={}; state.pre={}; nextDay(); if(state.phase==='prep'){ fillAll(); openShop(); }
  let g=0; while(state.phase==='open' && g++<3000){ state.paused=false; state.kama=0; tick(); } render(); }"""

# 店長を雇って会社を作り、2店舗目を出す（1号店は「天井」・お金は多め）
SETUP = """()=>{ newGame('hard'); state.slots=10; state.ad=18; state.clerk=1; state.cap=100; state.money=200000000; state.happy=90;
  state.own=[0,1,2,3,4,5,6,7,8,9]; state.shelf=state.own.map(id=>({id,st:0})); state.day=14; state.prev=3000000;
  hireMgr(); coFound('テスト商会', 1000000); state.qual=true; coOpen('2号店', 'downtown'); state.tab=0; render(); }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for W, H, tag in [(390, 820, 'sp'), (1280, 860, 'pc')]:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2 if W < 600 else 1)
        pg.add_init_script("try{localStorage.setItem('shop-sim-tutorial','1');localStorage.removeItem('shop-sim-payf')}catch(e){}")
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL)
        pg.wait_for_timeout(500)

        # 拡大・縮小を止める指定（ピンチそのものはヘッドレスでは確かめられない）
        r = pg.evaluate("""()=>({vp:document.querySelector('meta[name=viewport]').content,
          html:getComputedStyle(document.documentElement).touchAction, btn:getComputedStyle(document.querySelector('#scr button')).touchAction})""")
        check(tag + ' viewport と touch-action', 'user-scalable=no' in r['vp'] and r['html'] == 'pan-x pan-y' and r['btn'] == 'pan-x pan-y', r)

        # 千円単位
        r = pg.evaluate("()=>[yen(9999999), yen(10000000), yen(13964053), yen(-12345678), yen(-500), yen(0)]")
        check(tag + ' 千円単位', r == ['¥9,999,999', '10,000千円', '13,964千円', '-12,345千円', '-¥500', '¥0'], r)

        # 会社の遊び方：店長を雇った直後に出る・6場面・次からは出ない
        pg.evaluate("()=>{ newGame('hard'); state.slots=10; state.ad=18; state.clerk=1; state.cap=100; state.money=200000000; state.own=[0,1,2,3,4,5,6,7,8,9]; state.shelf=state.own.map(id=>({id,st:0})); state.day=14; state.prev=3000000; state.tab=1; render(); }")
        pg.click('[data-a=hiremgr]')
        pg.wait_for_timeout(600)
        r = pg.evaluate("()=>[byId('tut').hidden, byId('tutt').textContent, byId('tutn').textContent]")
        check(tag + ' 店長を雇うと会社の遊び方が出る', r == [False, '会社タブ', '1 / 6'], r)
        shot(pg, tag + '-1-tutco')
        for _ in range(6):
            pg.click('#tutgo')
            pg.wait_for_timeout(200)
        check(tag + ' 最後まで見ると閉じて覚える', pg.evaluate("()=>byId('tut').hidden && localStorage.getItem('shop-sim-tutorial-co')==='1'"))
        pg.click('#tabs [data-v="0"]')
        pg.click('#tabs [data-v="4"]')
        pg.wait_for_timeout(400)
        check(tag + ' 2回目に会社タブを開いても出ない', pg.evaluate("()=>byId('tut').hidden"))
        pg.click('#tabs [data-v="3"]')
        pg.click('#tutcob')
        pg.wait_for_timeout(300)
        check(tag + ' 設定タブから見直せる', pg.evaluate("()=>!byId('tut').hidden && byId('tutt').textContent==='会社タブ'"))
        pg.click('[data-a=tutskip]')

        # 店を2つにして、1号店で1日営業 → 2号店へ行くと、2号店のログ（1号店の販売の行は出ない）→ 戻ると1号店の履歴
        pg.evaluate(SETUP)
        pg.evaluate(DAY)
        pg.evaluate(DAY)
        n1 = pg.evaluate("()=>logList().length")
        pg.evaluate("()=>{ coSwitch(1); render(); }")
        r = pg.evaluate("()=>({n:logList().length, sale:logList().some(l=>l.s), top:logList()[0].t, dom:byId('lg').children.length})")
        check(tag + ' #13 2号店へ行くと前のお店の販売の行が出ない', not r['sale'] and '2号店' in r['top'] and r['dom'] == r['n'], r)
        pg.evaluate("()=>{ coSwitch(0); render(); }")
        check(tag + ' #13 1号店へ戻ると1号店の履歴', pg.evaluate("()=>logList().length") == n1 + 1, [n1, pg.evaluate("()=>logList().length")])
        check(tag + ' ほかの店にも state.log が入る', pg.evaluate("()=>Array.isArray(state.stores[1].log)"))

        # 通算の表示
        r = pg.evaluate("()=>{ state.day=433; render(); return byId('dt').textContent; }")
        check(tag + ' 通算は「62ヶ月目（433日）」', '62ヶ月目（433日）' in r and '通算' not in r, r)
        r = pg.evaluate("()=>{ state.money=13964053; render(); return byId('m').textContent; }")
        check(tag + ' 所持金も千円単位', r == '13,964千円', r)

        # 月末の支払い予想：タップで💵 → タップで吹き出し → ひらくで戻る
        pg.evaluate("()=>{ state.tab=0; render(); }")
        pg.click('#payf')
        r = pg.evaluate("()=>[byId('payf').classList.contains('mini'), byId('payf').textContent, byId('payb').hidden, localStorage.getItem('shop-sim-payf')]")
        check(tag + ' タップで💵に縮む', r == [True, '💵', True, '1'], r)
        pg.click('#payf')
        r = pg.evaluate("()=>[byId('payb').hidden, byId('payb').textContent]")
        check(tag + ' 縮めた💵をタップで吹き出しに正確な額', not r[0] and '¥' + format(pg.evaluate("()=>Math.round(payForecast())"), ',') in r[1], r)
        shot(pg, tag + '-2-payf')
        pg.click('#m')
        check(tag + ' ほかを押すと吹き出しが閉じる', pg.evaluate("()=>byId('payb').hidden && byId('payf').classList.contains('mini')"))
        pg.click('#payf')
        pg.click('[data-a=payopen]')
        check(tag + ' ひらくで元に戻る', pg.evaluate("()=>!byId('payf').classList.contains('mini') && localStorage.getItem('shop-sim-payf')==='0'"))

        # お店のダッシュボード
        pg.evaluate("()=>{ state.tab=4; render(); }")
        pg.click('[data-a=codash]')
        pg.wait_for_timeout(200)
        r = pg.evaluate("()=>({open:!byId('codash').hidden, n:document.querySelectorAll('.dbc').length, here:document.querySelector('.dbc.here').disabled})")
        check(tag + ' ダッシュボードに全店のカード', r == {'open': True, 'n': 2, 'here': True}, r)
        shot(pg, tag + '-3-dash')
        pg.click('.dbc[data-i="1"]')
        pg.wait_for_timeout(200)
        check(tag + ' カードを押すとその店へ行く', pg.evaluate("()=>state.cur===1 && byId('codash').hidden"))

        # 預金のスライダーは操作後に0へ
        pg.evaluate("()=>{ state.tab=2; state.svs=5000000; render(); svMove(1); }")
        check(tag + ' 預けたらスライダーが0', pg.evaluate("()=>state.svs===0 && document.querySelector('[data-a=svx]').value==='0'"))
        pg.evaluate("()=>{ state.svs=1000000; render(); svMove(-1); }")
        check(tag + ' 引き出してもスライダーが0', pg.evaluate("()=>state.svs===0"))

        check(tag + ' ページのエラーなし', not errs, errs)
        pg.close()
    b.close()

print('---')
print('すべて OK' if not fails else 'NG: ' + ', '.join(fails))
sys.exit(1 if fails else 0)
