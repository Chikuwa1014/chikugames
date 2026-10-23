# ひとりで冒険を自動で遊ぶテスト（まわす→すぐとめる をくり返す）
#   python3 roulette/dev/test-solo.py [出力先フォルダ] [最大手数=400]
import sys, time, os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:8787/roulette/")
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
LIMIT = int(sys.argv[2]) if len(sys.argv) > 2 else 400
errors, shots = [], set()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 400, "height": 900})
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE)
    pg.screenshot(path=f"{OUT}/s-title.png")
    pg.click("#goSolo")
    stats = {"battle": 0, "over": 0, "shop": 0}
    for step in range(LIMIT):
        if not pg.is_hidden("#shop"):
            stats["shop"] += 1
            if "shop" not in shots: pg.screenshot(path=f"{OUT}/s-shop.png"); shots.add("shop")
            for _ in range(6):   # 買えるものを順に買う
                btn = pg.query_selector("#shopList button:not([disabled])")
                if not btn: break
                btn.click()
            pg.click("#shopGo"); continue
        if not pg.is_hidden("#dialog"):
            title = pg.inner_text("#dlgTitle")
            print("dialog:", title, "| step", step)
            if "平和" in title:
                pg.screenshot(path=f"{OUT}/s-ending.png"); break
            stats["over"] += 1
            pg.click("#dlgBtns button"); continue
        btn = pg.query_selector("#soloBtn")
        if btn.is_disabled(): time.sleep(0.15); continue
        if not pg.is_hidden("#battleWrap"):
            stats["battle"] += 1
            if "battle" not in shots: pg.screenshot(path=f"{OUT}/s-battle.png"); shots.add("battle")
        elif "board" not in shots and step > 3:
            pg.screenshot(path=f"{OUT}/s-board.png"); shots.add("board")
        btn.click(); time.sleep(0.25)
        if not btn.is_disabled(): btn.click()
        pg.wait_for_function("!document.getElementById('soloBtn').disabled || !document.getElementById('dialog').hidden || !document.getElementById('shop').hidden", timeout=15000)
    print("stage:", pg.inner_text("#stName"), "|", pg.inner_text("#hpNum"), "| LV", pg.inner_text("#stLv"))
    print(stats)
    b.close()
print("errors:", errors or "なし")
