# バトルオセロ 1.0.0 の確認テスト（ヘッドレス Chromium 2台）
#   python3 battle-othello/dev/test-v1.py [出力先フォルダ]
# 1) 手元の仲介（roulette/dev/server.mjs）で親子をつなぎ、名前・盤面の色・防御の輪（円を描く＋連打）・
#    攻撃と防御の画面がダメージ数値より上に出ることを確かめる
# 2) デバッグログの送信（shop-sim/dev/server.mjs。D1 のまねで /battle-othello/debug を受ける）
import sys, os, time, math, subprocess, pathlib, json, urllib.request
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
errors = []

def start(script, port):
    s = subprocess.Popen(["node", str(ROOT / script), str(port)], stdout=subprocess.PIPE)
    s.stdout.readline(); return s

def page(b, name):
    pg = b.new_context(viewport={"width": 400, "height": 860}).new_page()
    pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
    pg.on("console", lambda m: m.type == "error" and "ERR_TUNNEL" not in m.text and "qrcode" not in m.text
          and "Failed to load resource" not in m.text and errors.append(f"{name} console: {m.text}"))
    return pg

def draw_circles(pg, n):
    box = pg.locator("#ring").bounding_box()
    cx, cy, r = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, box["width"] / 2
    pg.mouse.move(cx + r, cy); pg.mouse.down()
    steps = 24
    for k in range(1, n * steps + 2):
        a = 2 * math.pi * k / steps
        pg.mouse.move(cx + r * math.cos(a), cy + r * math.sin(a))
    pg.mouse.up()

srv = start("roulette/dev/server.mjs", 8788)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--disable-features=WebRtcHideLocalIpsWithMdns"])
        base = "http://localhost:8788/battle-othello/"
        host = page(b, "親"); host.goto(base)
        host.click('#themeSeg button[data-theme="shogi"]')
        host.click('#modeSeg button[data-mode="battle"]')
        host.screenshot(path=f"{OUT}/v1-lobby.png")
        host.click("#createBtn"); host.wait_for_selector("#waiting:not(.hidden)"); time.sleep(0.4)
        code = host.inner_text("#codeView")
        guest = page(b, "子"); guest.goto(base)
        guest.fill("#nameInput", "テスト子"); guest.dispatch_event("#nameInput", "change")   # 名前は端末に保存される
        guest.goto(base + "?room=" + code)
        for pg in (host, guest): pg.wait_for_selector("#game:not(.hidden)", timeout=15000)
        time.sleep(4.2)
        names = lambda pg: (pg.inner_text("#nameB"), pg.inner_text("#nameW"))
        print("名前 親", names(host), "子", names(guest))
        assert set(names(host)) == {"ちくわ", "テスト子"}, "名前が出ていない"
        assert names(host) == names(guest), "両端末の名前の並びがずれている"
        # 何手か打ってダメージを作る
        first = host if host.locator("#board .cell.can").count() else guest
        second = guest if first is host else host
        for turn in range(2):
            atk, dfn = (first, second) if turn % 2 == 0 else (second, first)
            atk.wait_for_selector("#board .cell.can", timeout=8000)
            atk.locator("#board .cell.can").first.click()
            time.sleep(0.45); atk.click("#battle")             # 攻撃のゲージを止める
            dfn.wait_for_selector("#ring:not(.hidden)")
            if turn == 0:
                draw_circles(dfn, 3)                          # 円を3周
                dfn.mouse.click(200, 300)                       # 連打を1回（組み合わせ）
                v = int(dfn.inner_text("#battleValue"))
                print("防御（3周＋1回タップ）：", v, "/ 輪の表示", dfn.inner_text("#ringCount"))
                assert v >= 3 * 4 + 1 * 3, "円の防御が数えられていない"
                dfn.screenshot(path=f"{OUT}/v1-defend.png")
            time.sleep(3.6)
        # バトル画面がダメージ数値より上か（数値があれば、その上に重なる要素がバトル画面であること）
        z = host.evaluate("() => [getComputedStyle(document.getElementById('battle')).zIndex, document.querySelectorAll('.dmg').length]")
        print("バトル画面の z-index・ダメージ表示の数：", z)
        assert int(z[0]) > 2
        host.screenshot(path=f"{OUT}/v1-host.png"); guest.screenshot(path=f"{OUT}/v1-guest.png")
        cnt = lambda pg: (pg.inner_text("#countB"), pg.inner_text("#countW"))
        assert cnt(host) == cnt(guest), "両端末の盤面がずれている"
        for t in ["green", "brown", "chikuwa"]:
            host.evaluate(f"setTheme('{t}')"); host.locator(".board-wrap").screenshot(path=f"{OUT}/v1-board-{t}.png")
        b.close()
finally:
    srv.terminate()

srv = start("shop-sim/dev/server.mjs", 8791)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = page(b, "報告"); pg.goto("http://localhost:8791/battle-othello/")
        pg.click("#dbgBox summary"); pg.fill("#dbgNote", "テストの報告")
        pg.click("#dbgSend"); pg.wait_for_function("document.getElementById('dbgMsg').textContent.includes('受付番号') || document.getElementById('dbgMsg').classList.contains('err')", timeout=8000)
        print("送信：", pg.inner_text("#dbgMsg"))
        rows = json.loads(urllib.request.urlopen("http://localhost:8791/__debug").read())
        last = rows[-1] if isinstance(rows, list) else rows
        print("受け取ったログ：", str(last)[:160])
        assert "受付番号" in pg.inner_text("#dbgMsg")
        b.close()
finally:
    srv.terminate()

print("エラー：", errors or "なし")
sys.exit(1 if errors else 0)
