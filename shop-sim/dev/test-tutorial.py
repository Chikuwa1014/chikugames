#!/usr/bin/env python3
"""v2.0.0 の確認：遊び方（チュートリアル）。最初の難易度えらびの直後に1回だけ出る・9場面を進める・スキップ・次からは出ない・
設定タブから見直せる（営業中は一時停止して、終わったら戻す）・セーブがある人には自動で出ない。
使い方：python3 shop-sim/dev/test-tutorial.py [出力先]。サーバー不要（file://）。"""
import os, sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.abspath(os.path.join(HERE, '..', 'index.html'))
OUT = sys.argv[1] if len(sys.argv) > 1 else None
fails = []

def check(name, ok, info=''):
    print(('OK  ' if ok else 'NG  ') + name + (' … ' + str(info) if info and not ok else ''))
    if not ok:
        fails.append(name)

shown = "()=>!!byId('tut') && !byId('tut').hidden"

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_timeout(500)
    check('難易度えらびの前は出ない', not pg.evaluate(shown))
    pg.click('[data-a="diff"][data-v="hard"]')
    pg.wait_for_timeout(600)
    check('最初の難易度えらびの直後に出る', pg.evaluate(shown))
    check('1場面目の番号', pg.inner_text('#tutn') == '1 / 9', pg.inner_text('#tutn'))
    tabs = []
    for i in range(8):
        pg.click('#tutgo')
        pg.wait_for_timeout(350)
        tabs.append(pg.evaluate('()=>state.tab'))
        if OUT and i in (2, 6):
            pg.screenshot(path=os.path.join(OUT, 'tut-%d.png' % (i + 2)))
    check('タブを自動で切り替える（投資・お金・設定）', tabs[-3:] == [1, 2, 3], tabs)
    check('最後は「はじめる！」', pg.inner_text('#tutgo') == 'はじめる！', pg.inner_text('#tutgo'))
    r = pg.evaluate("()=>{const h=byId('tuth').getBoundingClientRect(), t=document.querySelector('#tabs [data-v=\"3\"]').getBoundingClientRect(); return [h.left<=t.left && h.right>=t.right && h.top<=t.top && h.bottom>=t.bottom, h.width]}")
    check('光らせる枠が設定タブのボタンを囲む', r[0], r)
    pg.click('#tutgo')
    pg.wait_for_timeout(300)
    check('最後まで見ると閉じる', not pg.evaluate(shown))
    check('元のタブ（営業）に戻る', pg.evaluate('()=>state.tab') == 0)
    check('見たことを保存', pg.evaluate("()=>localStorage.getItem('shop-sim-tutorial')") == '1')

    # もう一度やり直しても出ない
    pg.click('[data-a="tab"][data-v="3"]')
    pg.click('[data-a="reset"]')
    pg.click('[data-a="reset"]')
    pg.wait_for_timeout(300)
    if pg.is_visible('[data-a="diff"][data-v="easy"]'):
        pg.click('[data-a="diff"][data-v="easy"]')
        pg.wait_for_timeout(600)
    check('見たあとは、やり直しても自動で出ない', not pg.evaluate(shown))

    # 設定タブから見直す（営業中は一時停止し、スキップで元に戻す）
    pg.evaluate("()=>{ state.phase='open'; state.paused=false; state.t=5; state.tab=3; render(); }")
    pg.click('[data-a="tutorial"]')
    pg.wait_for_timeout(300)
    check('設定の「遊び方を見る」で出る', pg.evaluate(shown))
    check('営業中は一時停止する', pg.evaluate('()=>state.paused') is True)
    pg.click('[data-a="tutskip"]')
    pg.wait_for_timeout(300)
    check('スキップで閉じる', not pg.evaluate(shown))
    check('一時停止を元に戻す', pg.evaluate('()=>state.paused') is False)
    check('開いていたタブ（設定）に戻る', pg.evaluate('()=>state.tab') == 3)
    check('ページのエラーなし', not errs, errs)
    ctx.close()

    # 初めての端末でスキップした場合と、セーブがある人
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page()
    pg.goto(URL)
    pg.wait_for_timeout(400)
    pg.click('[data-a="diff"][data-v="easy"]')
    pg.wait_for_timeout(600)
    pg.click('[data-a="tutskip"]')
    pg.wait_for_timeout(200)
    check('初回にスキップしても保存する', pg.evaluate("()=>localStorage.getItem('shop-sim-tutorial')") == '1')
    pg.evaluate("()=>localStorage.removeItem('shop-sim-tutorial')")
    pg.reload()
    pg.wait_for_timeout(600)
    check('セーブがある人には自動で出ない（見た記録がなくても）', not pg.evaluate(shown))
    ctx.close()
    b.close()

print('すべて OK' if not fails else 'NG: ' + ', '.join(fails))
sys.exit(1 if fails else 0)
