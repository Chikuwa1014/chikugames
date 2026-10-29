#!/usr/bin/env python3
"""v1.5.2 の確認：営業ログの折り返し（2行目以降1文字下げ）・悪いイベントのお知らせ（0.8秒→フェード→順番）。
使い方：python3 shop-sim/dev/test-v152.py [スクリーンショットの出力先]。サーバー不要（file://）。"""
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

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 760}, device_scale_factor=2)
    pg.add_init_script("try{localStorage.setItem('shop-sim-tutorial','1');localStorage.setItem('shop-sim-tutorial-co','1')}catch(e){}")  # v2.0.0：遊び方（チュートリアル）を出さない
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_timeout(600)
    pg.evaluate("()=>{ state.diff='normal'; state.over=false; state.phase='closed'; state.evs=[]; render(); }")

    # ---- ログの折り返し ----
    pg.evaluate("()=>{ addEvent('📢 テナント料の改定：+34%（月¥7,500に）これはとても長い文章で一行には収まらないはずの説明がつづきます。さらにつづきます'); syncLog(); }")
    r = pg.evaluate("""()=>{ const d=byId('lg').children[0], cs=getComputedStyle(d), lh=parseFloat(cs.lineHeight);
      return {h:d.getBoundingClientRect().height, lh, ws:cs.whiteSpace, to:cs.textOverflow, pl:cs.paddingLeft, ti:cs.textIndent, fs:cs.fontSize}; }""")
    check('ログ：長い行は2行以上に折り返す', r['h'] > r['lh'] * 1.5, r)
    check('ログ：「...」で切らない', r['to'] != 'ellipsis' and r['ws'] != 'nowrap', r)
    check('ログ：2行目以降は1文字分下げる', r['pl'] == r['fs'] and r['ti'] == '-' + r['fs'], r)
    if OUT:
        pg.locator('#lg').screenshot(path=os.path.join(OUT, 'v152-log.png'))

    # ---- お知らせ ----
    pg.evaluate("()=>{ window.__seen=[]; setInterval(()=>{ const e=byId('bnote'); window.__seen.push(e.hidden?'':e.textContent+(e.classList.contains('out')?'(out)':'')); },50); }")
    pg.evaluate("()=>{ addEvent('🌋 大地震！投資がすべてリセットされました', 1); addEvent('🚗 車が店に突っ込みました。修繕費¥10,000', 1); addEvent('🌸 お花見ブーム！'); }")
    pg.wait_for_timeout(300)
    if OUT:
        pg.locator('.pxw').screenshot(path=os.path.join(OUT, 'v152-note.png'))
    t0 = pg.evaluate("()=>byId('bnote').textContent")
    check('お知らせ：最初は1つ目だけ表示', '大地震' in t0 and '車が' not in t0, t0)
    pg.wait_for_timeout(2500)
    seen = pg.evaluate("()=>window.__seen")
    n1 = sum(1 for s in seen if '大地震' in s); n2 = sum(1 for s in seen if '車が' in s)
    check('お知らせ：悪いイベントは2件とも順に出る（良いイベントは出ない）', n1 > 0 and n2 > 0 and not any('お花見' in s for s in seen), seen)
    first2 = next(i for i, s in enumerate(seen) if '車が' in s)
    last1 = max(i for i, s in enumerate(seen) if '大地震' in s)
    check('お知らせ：1つ目が消えてから2つ目', last1 < first2, (last1, first2))
    check('お知らせ：フェードアウト（out）を経由', any('(out)' in s for s in seen))
    dur = n1 * 50
    check('お知らせ：1つ目は約1.1秒（0.8秒＋フェード0.3秒）', 800 <= dur <= 1500, dur)
    check('お知らせ：最後は消える', pg.evaluate("()=>byId('bnote').hidden"))
    check('ページのエラーなし', not errs, errs)
    b.close()

print('\n失敗：' + ', '.join(fails) if fails else '\nすべて OK')
sys.exit(1 if fails else 0)
