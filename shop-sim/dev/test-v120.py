"""v1.2.0 の確認（node shop-sim/dev/server.mjs を先に起動）。
セーブコード（コピー→やり直し→貼り付けで復元・書き換えたコードをはじく）、
v1.1.x の形のセーブファイルの読み込み、ファイルの書き出し、最初からやり直す（2回押し）、横画面のスクショ。
python3 shop-sim/dev/test-v120.py [スクショの出力先]"""
import sys, json, os, tempfile
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
BASE = 'http://localhost:8788/shop-sim/'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin='http://localhost:8788')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE)
    pg.evaluate("localStorage.clear()")
    pg.reload()
    pg.click('[data-a="diff"][data-v="hard"]')
    pg.evaluate("state.money = 123456; state.day = 9; render(); save()")
    pg.click('[data-a="tab"][data-v="3"]')

    # セーブコードをコピー
    pg.click('[data-a="ccopy"]')
    pg.wait_for_selector('textarea.svcode[readonly]')
    code = pg.input_value('textarea.svcode[readonly]')
    clip = pg.evaluate('navigator.clipboard.readText()')
    print('コード:', code[:40] + '…', len(code), '文字', '／クリップボードと一致' if clip == code else '／クリップボード不一致')
    assert code.startswith('CK1.') and clip == code
    pg.screenshot(path=OUT + '/v120-code.png', full_page=False)

    # 最初からやり直す（1回目は確認、2回目でリセット）
    rst = pg.locator('[data-a="reset"]')
    rst.scroll_into_view_if_needed()
    rst.click()
    print('1回目:', rst.inner_text())
    pg.screenshot(path=OUT + '/v120-reset-arm.png')
    rst.click()
    pg.click('[data-a="diff"][data-v="easy"]')
    print('やり直し後の所持金:', pg.evaluate('state.money'))
    assert pg.evaluate('state.money') != 123456

    # コードで読み込む
    pg.click('[data-a="tab"][data-v="3"]')
    pg.click('[data-a="cin"]')
    pg.fill('#svci', code[:-3] + 'zzz')                      # 書き換えたコード
    pg.click('[data-a="cread"]')
    pg.wait_for_selector('.svwarn')
    print('書き換え:', pg.locator('#svd .svwarn').last.inner_text())
    pg.fill('#svci', '  ' + code + '\n')
    pg.click('[data-a="cread"]')
    pg.wait_for_selector('.svpend')
    print('概要:', pg.locator('.svpend .meta').first.inner_text().replace('\n', ' '))
    pg.click('[data-a="fok"]')
    print('復元後:', pg.evaluate('[state.money, state.day, state.diff]'))
    assert pg.evaluate('state.money') == 123456 and pg.evaluate('state.day') == 9

    # v1.1.x の形（state に中身）のファイルを読む
    old = {'game': 'shop-sim', 'v': 2, 'key': 'shopsim8', 'at': '2026-10-22T10:00:00Z', 'state': pg.evaluate('Object.assign({}, state, {money: 777})')}
    f = os.path.join(tempfile.mkdtemp(), 'old.json')
    open(f, 'w', encoding='utf-8').write(json.dumps(old, ensure_ascii=False))
    pg.click('[data-a="tab"][data-v="3"]')
    pg.set_input_files('#svf', f)
    pg.wait_for_selector('.svpend')
    pg.click('[data-a="fok"]')
    print('古いファイル:', pg.evaluate('state.money'))
    assert pg.evaluate('state.money') == 777

    # ファイルに書き出す
    pg.click('[data-a="tab"][data-v="3"]')
    with pg.expect_download() as d:
        pg.click('[data-a="fsave"]')
    box = json.loads(open(d.value.path(), encoding='utf-8').read())
    print('書き出し:', d.value.suggested_filename, box['game'], box['v'], box['key'], 'data' in box, box['data']['money'])
    assert box['game'] == 'shop-sim' and box['data']['money'] == 777

    # 横画面
    for w, h in [(844, 390), (932, 430)]:
        pg.set_viewport_size({'width': w, 'height': h})
        pg.click('[data-a="tab"][data-v="0"]')
        pg.wait_for_timeout(200)
        pg.screenshot(path=f'{OUT}/v120-land-{w}.png')
        pg.click('[data-a="tab"][data-v="3"]')
        pg.locator('[data-a="reset"]').scroll_into_view_if_needed()
        pg.screenshot(path=f'{OUT}/v120-land-{w}-set.png')
        sw = pg.evaluate('document.documentElement.scrollWidth')
        print(f'横 {w}x{h}: 横スクロール', 'なし' if sw <= w else f'あり({sw})')
    b.close()
print('ページのエラー:', errs or 'なし')
sys.exit(1 if errs else 0)
