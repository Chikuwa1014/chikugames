# 共通部品 room.js の通しテスト（親1＋子2、3台目で満員、退出でメンバーが減る、データのやりとり）
#   node roulette/dev/server.mjs 8787 を起動してから
#   python3 common/dev/test-room.py [出力先フォルダ]
import sys, os, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:8787/common/dev/room-test.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(args=["--disable-features=WebRtcHideLocalIpsWithMdns"])
    def page(name):
        ctx = b.new_context(viewport={"width": 400, "height": 760})
        ctx.add_init_script(f"localStorage.setItem('cg-room-test-name', '{name}')")
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
        pg.on("console", lambda m: m.type == "error" and "ERR_TUNNEL" not in m.text and errors.append(f"{name} console: {m.text}"))
        return pg

    host = page("おや")
    host.goto(BASE)
    host.click('[data-cg="create"]')
    host.wait_for_selector(".cg-room-num", timeout=8000)
    code = host.inner_text(".cg-room-num")
    print("部屋コード", code)

    g1 = page("こ1"); g1.goto(BASE + "?room=" + code)       # リンクで参加
    g1.wait_for_selector(".cg-room-num", timeout=15000)
    g2 = page("こ2"); g2.goto(BASE)                          # コードを入れて参加
    g2.fill(".cg-room-code", code); g2.click('[data-cg="join"]')
    g2.wait_for_selector(".cg-room-num", timeout=15000)
    host.wait_for_function("document.querySelectorAll('.cg-room-members li').length === 3", timeout=8000)
    g1.wait_for_function("document.querySelectorAll('.cg-room-members li').length === 3", timeout=8000)
    print("メンバー（親）:", host.inner_text(".cg-room-members").replace("\n", " / "))
    print("メンバー（子1）:", g1.inner_text(".cg-room-members").replace("\n", " / "))
    host.screenshot(path=f"{OUT}/room-host.png")
    g2.screenshot(path=f"{OUT}/room-guest.png")

    # 3台までの部屋に4台目 → 満員
    g3 = page("こ3"); g3.goto(BASE + "?room=" + code)
    g3.wait_for_selector(".cg-room-err", timeout=15000)
    print("4台目:", g3.inner_text(".cg-room-err"))

    # 子→親→全員
    for _ in range(3): g1.click("#tap")
    g2.click("#tap"); host.click("#tap")
    time.sleep(0.8)
    t = [host.inner_text("#taps"), g1.inner_text("#taps"), g2.inner_text("#taps")]
    print("タップ数（親・子1・子2）:", t)
    assert t == ["5", "5", "5"], t

    # 子2が退出 → 親・子1のメンバーが2人に
    g2.click('[data-cg="leave"]')
    host.wait_for_function("document.querySelectorAll('.cg-room-members li').length === 2", timeout=8000)
    g1.wait_for_function("document.querySelectorAll('.cg-room-members li').length === 2", timeout=8000)
    print("退出後:", host.inner_text(".cg-room-members").replace("\n", " / "))

    # 親が退出 → 子1は「切れました」
    host.click('[data-cg="leave"]')
    g1.wait_for_selector(".cg-room-err", timeout=10000)
    print("親が抜けた後の子1:", g1.inner_text(".cg-room-err"))
    g1.screenshot(path=f"{OUT}/room-lost.png")
    b.close()

print("エラー:", errors or "なし")
sys.exit(1 if errors else 0)
