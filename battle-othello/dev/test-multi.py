# バトルオセロの通信対戦テスト（ヘッドレス Chromium 2台＋満員確認の3台目）
#   python3 battle-othello/dev/test-multi.py [出力先フォルダ] [ルール normal|battle]
# 手元の仲介（roulette/dev/server.mjs。本物の worker/index.js の MultiRoom）を自動で起動・終了する
import sys, os, time, subprocess, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
MODE = sys.argv[2] if len(sys.argv) > 2 else "normal"
PORT = os.environ.get("PORT", "8788")
BASE = f"http://localhost:{PORT}/battle-othello/"
errors = []

srv = subprocess.Popen(["node", str(ROOT / "roulette/dev/server.mjs"), PORT], stdout=subprocess.PIPE)
srv.stdout.readline()   # 起動の表示を待つ
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--disable-features=WebRtcHideLocalIpsWithMdns"])
        def page(name):
            pg = b.new_context(viewport={"width": 400, "height": 860}).new_page()
            pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
            pg.on("console", lambda m: m.type == "error" and "ERR_TUNNEL" not in m.text and "qrcode" not in m.text
                  and errors.append(f"{name} console: {m.text}"))
            return pg

        host = page("親")
        host.goto(BASE)
        host.screenshot(path=f"{OUT}/o-lobby.png")
        if MODE == "battle":
            host.click('#modeSeg button[data-mode="battle"]')
        host.click("#createBtn")
        host.wait_for_selector("#waiting:not(.hidden)")
        time.sleep(0.5)
        code = host.inner_text("#codeView")
        print("部屋", code)
        host.screenshot(path=f"{OUT}/o-waiting.png")

        guest = page("子")
        guest.goto(BASE + "?room=" + code)
        for pg in (host, guest):
            pg.wait_for_selector("#game:not(.hidden)", timeout=15000)
        print("接続OK：対局画面に入った")

        # 3台目は満員になる
        third = page("3台目")
        third.goto(BASE + "?room=" + code)
        third.wait_for_function("document.getElementById('lobbyMsg').textContent.length > 0", timeout=8000)
        print("3台目：", third.inner_text("#lobbyMsg"))

        # コイントスが終わるまで待ち、先攻（置ける場所が光っている側）が1手打つ
        time.sleep(4)
        first = host if host.locator("#board .cell.can").count() else guest
        second = guest if first is host else host
        print("先攻：", "親" if first is host else "子", first.inner_text("#youAre").replace("\n", " "))
        first.locator("#board .cell.can").first.click()
        if MODE == "battle":
            time.sleep(0.6); first.click("#battle")          # 攻撃のゲージを止める
            for _ in range(5): second.click("#battle")       # 防御の連打
            time.sleep(3.5)
        time.sleep(1)
        cnt = lambda pg: (pg.inner_text("#countB"), pg.inner_text("#countW"))
        print("コマ数 親", cnt(host), "子", cnt(guest))
        assert cnt(host) == cnt(guest), "両端末の盤面がずれている"
        assert cnt(host) != ("2", "2"), "手が反映されていない"
        host.screenshot(path=f"{OUT}/o-host.png"); guest.screenshot(path=f"{OUT}/o-guest.png")
        print("横スクロール幅", host.evaluate("document.documentElement.scrollWidth"))
        b.close()
finally:
    srv.terminate()

print("エラー：", errors or "なし")
sys.exit(1 if errors else 0)
