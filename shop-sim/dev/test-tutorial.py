#!/usr/bin/env python3
"""v2.0.0 の確認：遊び方（チュートリアル）。最初の難易度えらびの直後に1回だけ出る・説明10場面＋1日目の練習5場面を進める・スキップ・次からは出ない・
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
    check('1場面目の番号（説明10＋練習5）', pg.inner_text('#tutn') == '1 / 15', pg.inner_text('#tutn'))
    tabs = []
    for i in range(9):
        pg.click('#tutgo')
        pg.wait_for_timeout(350)
        tabs.append(pg.evaluate('()=>state.tab'))
        if OUT and i in (2, 6):
            pg.screenshot(path=os.path.join(OUT, 'tut-%d.png' % (i + 2)))
    check('タブを自動で切り替える（投資・お金・設定・営業時間）', tabs[-4:] == [1, 2, 3, 3], tabs)
    r = pg.evaluate("()=>{const h=byId('tuth').getBoundingClientRect(), t=document.querySelector('[data-a=\"oh\"]').getBoundingClientRect(); return [h.left<=t.left && h.right>=t.right && h.top<=t.top && h.bottom>=t.bottom, h.width]}")
    check('営業時間の場面：営業時間の欄を光らせる', r[0], r)
    check('営業時間の場面：時給125%の説明', '125%' in pg.inner_text('#tutm'))
    pg.click('#tutgo')
    pg.wait_for_timeout(400)
    # 1日目の練習：光っている所だけ押せる
    check('練習1：開業するを待つ（次へは出さない）', pg.inner_text('#tutt') == '実際にやってみよう！' and not pg.is_visible('#tutgo'))
    pg.mouse.click(5, 5)
    pg.wait_for_timeout(200)
    check('練習1：光っていない所はふさぐ', pg.evaluate('()=>state.day') == 0)
    pg.click('#act [data-a="next"]')
    pg.wait_for_timeout(600)
    check('練習2：開店準備に進む', pg.inner_text('#tutt') == '開店準備' and pg.evaluate('()=>state.phase') == 'prep')
    check('練習2：補充するまで次へは押せない', pg.is_disabled('#tutgo'))
    pg.click('#sh [data-n="999"]')
    pg.wait_for_timeout(500)
    check('練習2：補充すると次へが押せる', not pg.is_disabled('#tutgo'))
    pg.click('#tutgo')
    pg.wait_for_timeout(400)
    pg.click('#act [data-a="open"]')
    pg.wait_for_timeout(700)
    check('練習4：営業中は暗くせず、ゲームを動かす', pg.inner_text('#tutt') == '営業中' and pg.evaluate("()=>state.phase==='open' && !state.paused && getComputedStyle(byId('tuth')).display==='none'"))
    pg.evaluate("()=>{ state.spd = 8; }")
    for i in range(200):
        if pg.evaluate('()=>state.phase') != 'open':
            break
        pg.wait_for_timeout(300)
    pg.wait_for_timeout(600)
    check('練習5：閉店後に本日の結果を光らせる', pg.inner_text('#tutt') == '1日おつかれさま！' and pg.evaluate('()=>state.phase') == 'closed')
    check('最後は「はじめる！」', pg.inner_text('#tutgo') == 'はじめる！', pg.inner_text('#tutgo'))
    if OUT:
        pg.screenshot(path=os.path.join(OUT, 'tut-end.png'))
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
    check('見直しは説明だけ（10場面）', pg.inner_text('#tutn') == '1 / 10', pg.inner_text('#tutn'))
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
