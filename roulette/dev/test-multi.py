# マルチプレイの通しテスト（親1＋子N）。dev/server.mjs を起動してから実行する
#   python3 roulette/dev/test-multi.py [子の人数=2] [出力先フォルダ]
import sys, time, os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:8787/roulette/")
N = int(sys.argv[1]) if len(sys.argv) > 1 else 2
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(args=["--disable-features=WebRtcHideLocalIpsWithMdns", "--use-fake-ui-for-media-stream"])
    def page(name):
        ctx = b.new_context(viewport={"width": 400, "height": 860}, device_scale_factor=1)
        ctx.add_init_script(f"localStorage.setItem('chikuwa-roulette-name', '{name}')")
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
        pg.on("console", lambda m: m.type == "error" and errors.append(f"{name} console: {m.text}"))
        return pg

    host = page("おや")
    host.goto(BASE)
    host.click("#goMulti"); host.click("#createBtn")
    host.wait_for_selector("#scr-mroom:not([hidden])", timeout=8000)
    code = host.inner_text("#roomCode")
    print("room", code)

    guests = []
    for i in range(N):
        g = page(f"こ{i+1}")
        g.goto(BASE + "?room=" + code)
        g.wait_for_selector("#scr-mroom:not([hidden])", timeout=15000)
        guests.append(g)
    host.wait_for_function(f"document.querySelectorAll('#players .pl').length === {N+1}", timeout=8000)
    print("players:", host.inner_text("#players").replace("\n", " "))

    # 項目を決める（12個）
    host.fill("#itemsIn", "\n".join(f"項目{i}" for i in range(1, 13)))
    host.click("#toPick")
    for g in guests: g.wait_for_selector("#pPick:not([hidden])", timeout=5000)
    # NG：親は項目1、子はそれぞれ別
    host.click('#picks button[data-i="0"]')
    for i, g in enumerate(guests): g.click(f'#picks button[data-i="{i+1}"]')
    time.sleep(0.5)
    print("pick:", host.inner_text("#players").replace("\n", " "))
    host.screenshot(path=f"{OUT}/m-host-pick.png")

    host.click("#spinBtn")
    for g in guests: g.wait_for_selector("#pSpin:not([hidden])", timeout=5000)
    # 回転中に子1が連打（当たったり外れたり）
    for k in range(5):
        time.sleep(0.6)
        guests[0].click("#atkBtn", force=True)
    time.sleep(0.3)
    guests[0].screenshot(path=f"{OUT}/m-guest-spin.png")
    host.wait_for_selector("#pResult:not([hidden])", timeout=30000)
    for g in guests: g.wait_for_selector("#pResult:not([hidden])", timeout=5000)
    time.sleep(0.3)
    res = [host.inner_text("#resultName")] + [g.inner_text("#resultName") for g in guests]
    print("results:", res)
    assert len(set(res)) == 1, "結果が端末ごとにちがう"
    readouts = [host.inner_text("#multiRead")] + [g.inner_text("#multiRead") for g in guests]
    print("readouts:", readouts)
    print("after:", host.inner_text("#players").replace("\n", " "))
    host.screenshot(path=f"{OUT}/m-host-result.png")
    guests[-1].screenshot(path=f"{OUT}/m-guest-result.png")

    # 子が1人抜ける → 親の一覧から消える
    guests[-1].click("#leaveBtn")
    host.wait_for_function(f"document.querySelectorAll('#players .pl').length === {N}", timeout=8000)
    print("after leave OK")

    # もう一回
    host.click("#againBtn")
    guests[0].wait_for_selector("#pPick:not([hidden])", timeout=5000)
    print("again OK")
    b.close()

print("errors:", errors or "なし")
