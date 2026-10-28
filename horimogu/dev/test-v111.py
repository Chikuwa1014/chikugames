# v1.1.1 の確認（デバッグ報告#11：スティックの「指が離れた」合図が届かず、歩きっぱなしで方向を変えられない）
#   node horimogu/dev/server.mjs &
#   python3 horimogu/dev/test-v111.py
import sys, os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:8787/horimogu/")
IGNORE = ("ERR_TUNNEL", "Failed to load resource", "ERR_NAME_NOT_RESOLVED", "ERR_CONNECTION", "GPU stall", "GL Driver")
errors = []

def check(c, msg):
    print(("OK  " if c else "NG  ") + msg)
    if not c: errors.append(msg)

PD = """([id,x,y])=>{ const a=document.querySelector('#touchArea');
  a.dispatchEvent(new PointerEvent('pointerdown',{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})); }"""
PM = """([id,x,y])=>{ const a=document.querySelector('#touchArea');
  a.dispatchEvent(new PointerEvent('pointermove',{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})); }"""
TE = """()=>{ window.dispatchEvent(new TouchEvent('touchend',{touches:[],bubbles:true})); }"""

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = b.new_context(viewport={"width": 390, "height": 760}, has_touch=True, is_mobile=True, device_scale_factor=2)
    pg = ctx.new_page()
    pg.on("console", lambda m: m.type == "error" and not any(s in m.text for s in IGNORE) and errors.append("console: " + m.text))
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.goto(BASE); pg.wait_for_timeout(600)
    pg.click("#home [data-size=short]"); pg.click("#soloBtn")
    pg.wait_for_function("window.__HM && __HM.G.running && document.querySelector('#loading').hidden", timeout=20000)
    pg.wait_for_timeout(500)
    st = "(()=>{ const k=document.querySelector('#stick'); return !k.hidden; })()"

    # 1) 指が残っている（正常）：スティックは効いたまま
    pg.evaluate(PD, [1, 80, 560]); pg.evaluate(PM, [1, 80, 500])
    check(pg.evaluate(st), "スティックを倒すと出る")
    check(pg.evaluate("__HM.inp && true"), "入力が読める")
    # 2) 離れた合図が届かず、新しく別の指でスティックの位置を触る → つかみ直せる
    pg.evaluate(PD, [2, 90, 580]); pg.evaluate(PM, [2, 150, 580])
    pg.wait_for_timeout(100)
    mx = pg.evaluate("(()=>{ const m=document.querySelector('#knob').style.transform; return m; })()")
    check("calc" in mx and pg.evaluate(st), "古い指が残っていても、新しい指でスティックを倒せる（横へ倒した）")
    # 3) touchend（指が 0 本）の合図だけ届いたとき、スティックをやめる
    pg.evaluate(TE)
    check(not pg.evaluate(st), "指が 0 本になったらスティックが消える（歩きっぱなしにならない）")
    # 4) 一時停止の出入りで、残った操作を捨てる
    pg.evaluate(PD, [3, 80, 560]); pg.evaluate(PM, [3, 80, 500])
    pg.evaluate("__HM.held.main = true")
    pg.click("#pauseBtn"); pg.wait_for_timeout(100)
    check(not pg.evaluate(st) and not pg.evaluate("__HM.held.main"), "一時停止でスティックと押しっぱなしの掘るを離す")
    pg.click("#resume"); pg.wait_for_timeout(100)
    check(not pg.evaluate(st), "つづけるのあとも残らない")
    # 5) 見回し（右側）は今までどおり
    y0 = pg.evaluate("__HM.G.me.yaw")
    pg.evaluate(PD, [4, 300, 300]); pg.evaluate(PM, [4, 250, 300])
    check(abs(pg.evaluate("__HM.G.me.yaw") - y0) > 0.1, "右側の見回しは今までどおり効く")
    pg.evaluate(TE)
    b.close()

print("\n失敗：" + ", ".join(errors) if errors else "\nすべて OK")
sys.exit(1 if errors else 0)
