"""v1.3.0 実績の確認。ファイルを直接開くのでサーバーはいらない。
python3 shop-sim/dev/test-achv.py [スクショの出力先] [開くURL（省略時は shop-sim/index.html）]
- 閉店（endDay）・預金（svMove）のあとに解除されること、トースト、やり直しても消えないこと
- インフェルノ以外ではインフェルノの実績が解除されないこと、倒産した日は解除されないこと"""
import sys, pathlib
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
URL = sys.argv[2] if len(sys.argv) > 2 else (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 844})
    pg.add_init_script("try{localStorage.setItem('shop-sim-tutorial','1')}catch(e){}")  # v2.0.0：遊び方（チュートリアル）を出さない
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.evaluate("localStorage.clear()")
    pg.reload()
    got = lambda: sorted(pg.evaluate('Object.keys(achGot)'))

    # ハードで：売上1億・通算840日（10年）→ 閉店で解除。インフェルノの実績は解除されない
    pg.click('[data-a="diff"][data-v="hard"]')
    pg.evaluate("state.tot = 1e8; state.day = 840; state.money = 1e9; endDay(); render()")
    print('ハード閉店後:', got())
    assert got() == ['day840', 'tot100000000'], got()
    print('トースト:', pg.inner_text('#cg-toast'))

    # 預金1000万 → 預けた瞬間に解除
    pg.evaluate("state.phase = 'closed'; state.over = false; state.svs = 1e7; svMove(1)")
    print('預金後:', got())
    assert 'sv10000000' in got()

    # やり直しても消えない
    pg.evaluate("restart()")
    pg.click('[data-a="diff"][data-v="inferno"]')
    assert len(got()) == 3, got()

    # インフェルノ：倒産した日は解除されない → 倒産していなければ 6ヶ月(42日)・1年(84日)
    pg.evaluate("state.day = 84; state.money = -1e12; endDay(); render()")
    print('インフェルノ倒産の日:', state_over := pg.evaluate('state.over'), got())
    assert not any(k.startswith('inf') for k in got())
    pg.evaluate("state.over = false; state.money = 1e9; state.day = 84; endDay(); render()")
    print('インフェルノ84日:', got())
    assert 'inf42' in got() and 'inf84' in got() and 'inf420' not in got()

    # 所持金の横のバッジとポップアップ（v1.4.0〜。スマホ幅と横画面）
    print('バッジ:', pg.inner_text('#achb'))
    pg.click('#achb')
    pg.wait_for_timeout(300)
    print('ポップアップの見出し:', pg.inner_text('#achm .achtop'))
    pg.screenshot(path=OUT + '/achv-p.png')
    pg.set_viewport_size({'width': 844, 'height': 390})
    pg.wait_for_timeout(200)
    pg.screenshot(path=OUT + '/achv-l.png')
    pg.set_viewport_size({'width': 390, 'height': 844})
    # リセット：確認画面 →「やめる」で消えない →「消す」で 0 個
    n0 = len(got())
    pg.click('[data-a="achask"]'); pg.click('[data-a="achno"]')
    assert len(got()) == n0
    pg.click('[data-a="achask"]'); pg.wait_for_timeout(200)
    pg.screenshot(path=OUT + '/achv-reset.png')
    pg.click('[data-a="achdel"]'); pg.wait_for_timeout(200)
    print('リセット後:', got(), pg.inner_text('#achb'))
    assert got() == {} or got() == []
    pg.click('[data-a="achclose"]')
    sw = pg.evaluate('document.documentElement.scrollWidth')
    print('横スクロール:', 'なし' if sw <= 844 else sw)
    b.close()
print('ページのエラー:', errs or 'なし')
sys.exit(1 if errs else 0)
