#!/usr/bin/env python3
"""v2.3.3 の確認：文字を入力している間（キーボードが出ている間）は、上の部分とタブバーをたたんで入力欄の周りを広くする。
スマホ幅（キーボードで高さが縮んだつもりの 390×400）ではたたみ、入力をやめると戻る。PC 幅（2列）ではたたまない。
使い方：先にリポジトリ直下で python3 -m http.server 8090 を起動してから python3 shop-sim/dev/test-v233.py"""
import os
import sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL') or 'http://localhost:8090/shop-sim/'
fails = []


def check(name, ok, info=''):
    print(('OK  ' if ok else 'NG  ') + name + (' … ' + str(info) if info and not ok else ''))
    if not ok:
        fails.append(name)


# 会社を設立して、会社タブ（新しいお店の名前の欄）を開く
SETUP = """()=>{ newGame('hard'); state.slots=10; state.ad=18; state.clerk=1; state.cap=100; state.money=200000000;
  state.own=[0,1,2,3,4,5,6,7,8,9]; state.shelf=state.own.map(id=>({id,st:0})); state.day=14; state.prev=3000000;
  hireMgr(); coFound('テスト商会', 1000000); state.tab=4; render(); }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for W, H, tag, fold in [(390, 400, 'sp', True), (1280, 800, 'pc', False)]:
        pg = b.new_page(viewport={'width': W, 'height': H})
        pg.add_init_script("try{localStorage.setItem('shop-sim-tutorial','1');localStorage.setItem('shop-sim-tutorial-co','1')}catch(e){}")
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL)
        pg.wait_for_timeout(400)
        pg.evaluate(SETUP)
        pg.wait_for_timeout(200)
        h0 = pg.evaluate("()=>byId('scr').clientHeight")
        pg.click('#sname')
        pg.wait_for_timeout(300)
        r = pg.evaluate("()=>({kb:document.documentElement.classList.contains('kb'), h:byId('scr').clientHeight, open:document.querySelector('details.shop').open})")
        if fold:
            check(tag + ' 入力欄に触れると上の部分とタブバーをたたむ', r['kb'] and r['h'] > h0 * 3 and r['open'], [h0, r])
        else:
            check(tag + ' 2列のときはたたまない', not r['kb'] and r['h'] == h0, [h0, r])
        pg.keyboard.type('テスト')
        pg.click('#m')
        pg.wait_for_timeout(300)
        r = pg.evaluate("()=>({kb:document.documentElement.classList.contains('kb'), h:byId('scr').clientHeight, v:byId('sname').value})")
        check(tag + ' 入力をやめると元に戻る（入力した文字は残る）', not r['kb'] and r['h'] == h0 and r['v'] == 'テスト', [h0, r])
        check(tag + ' ページのエラーなし', not errs, errs)
        pg.close()
    b.close()

print('---')
print('すべて OK' if not fails else 'NG: ' + ', '.join(fails))
sys.exit(1 if fails else 0)
