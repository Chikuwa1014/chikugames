"""デバッグログと「投資できない理由」の確認（node shop-sim/dev/server.mjs を先に起動）。
python3 shop-sim/dev/test-debuglog.py [スクショの出力先]"""
import sys, json, urllib.request
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
BASE = 'http://localhost:8788'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 844})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/shop-sim/')
    pg.evaluate("localStorage.clear()")
    pg.reload()
    pg.click('[data-a="diff"][data-v="hard"]')
    pg.click('[data-a="tab"][data-v="1"]')
    assert pg.locator('.ivb').count() == 0, '閉店後なのに理由が出ている'
    m0 = pg.evaluate('state.money')
    pg.click('[data-a="b"][data-k="slot"]')
    assert pg.evaluate('state.money') < m0, '棚が買えない'
    # うつ病の休養中にする
    pg.evaluate('state.dep = 5; state.clerk = 1; render()')
    print('理由:', pg.locator('.ivb').inner_text())
    pg.evaluate("buy('ad')")
    pg.screenshot(path=OUT + '/invest.png')
    pg.evaluate('state.dep = 0; state.clerk = 0; render()')
    pg.evaluate("setTimeout(() => { undefinedFunc(); }, 0)")
    pg.wait_for_timeout(200)
    pg.click('[data-a="tab"][data-v="3"]')
    pg.fill('#dbgn', 'テスト送信：投資できない')
    pg.click('[data-a="dbgsend"]')
    pg.wait_for_selector('#dbg .svok', timeout=5000)
    print('結果:', pg.locator('#dbg .svok').inner_text())
    pg.locator('#dbg').scroll_into_view_if_needed()
    pg.screenshot(path=OUT + '/settings.png')
    b.close()
d = json.loads(urllib.request.urlopen(BASE + '/__debug').read())
body = d[-1]['body']
print('受信:', d[-1]['code'], d[-1]['note'], '記録', len(body['log']), '件')
for e in body['log']:
    print(' ', e['ev'], {k: v for k, v in e.items() if k in ('ph0', 'ph', 'dm', 'ign', 'msg', 'a')})
print('ページのエラー:', errs)
