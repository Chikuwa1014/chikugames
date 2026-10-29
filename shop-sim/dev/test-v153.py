#!/usr/bin/env python3
"""v1.5.3 の確認：月末の支払い予想（店の絵の左下）・幸福度ゲージの下のプルダウン・旧「空が赤い理由」ラベルの廃止。
使い方：python3 shop-sim/dev/test-v153.py [出力先]。サーバー不要（file://）。"""
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
    pg.evaluate("()=>{ state.diff='normal'; state.over=false; state.phase='closed'; state.day=5; state.mSales=200000; state.pays=[1]; state.loans=[{pay:10000,left:3}]; state.sal=100000; state.mWage=5000; render(); }")
    exp = pg.evaluate("()=>tenantFee()+Math.round(200000*0.0375*1)+10000+100000+5000")
    t = pg.evaluate("()=>byId('payf').textContent")
    check('支払い予想：月末の閉店処理と同じ合計を表示', ('¥' + format(exp, ',')) in t, (t, exp))
    check('支払い予想：常に表示', not pg.evaluate("()=>byId('payf').hidden"))
    st = pg.evaluate("()=>{const c=getComputedStyle(byId('payf')); return {bg:c.backgroundColor, fg:c.color}}")
    check('支払い予想：黒背景（透過60%）・白字', st['bg'] == 'rgba(0, 0, 0, 0.6)' and st['fg'] == 'rgb(255, 255, 255)', st)
    pg.evaluate("()=>{ state.mSales=0; state.mWage=0; state.loans=[]; state.pays=[]; state.sal=0; render(); }")
    t = pg.evaluate("()=>byId('payf').textContent")
    pg.click('#payf button.hp')
    h = pg.evaluate("()=>({vis:!byId('hlp').hidden, t:byId('hlp').textContent})")
    check('支払い予想：？をタップで説明（月末に近づくほど増える）', h['vis'] and '月末に近づくほど額が増えます' in h['t'], h)
    pg.click('#payf button.hp')
    check('支払い予想：もう一度タップで閉じる', pg.evaluate("()=>byId('hlp').hidden"))
    t = t.rstrip('?')
    check('支払い予想：売上や返済が無ければテナント料だけ', t.endswith('¥' + format(pg.evaluate("()=>tenantFee()"), ',')), t)
    check('旧ラベル（#badw）は無い', pg.evaluate("()=>!byId('badw') && state.badWhy===undefined"))
    pg.evaluate("()=>{ addEvent('🌋 大地震！投資がすべてリセットされました', 1); render(); }")
    check('悪いイベントの日も badWhy は記録しない', pg.evaluate("()=>state.badWhy===undefined"))
    # プルダウン
    pg.wait_for_timeout(1500)
    d = pg.evaluate("()=>({open:byId('dtl').open, sum:byId('dsum').textContent, vis:byId('fe').getBoundingClientRect().height>0})")
    check('プルダウン：初期は閉じて要約（月末まであと◯日）', (not d['open']) and '月末まで' in d['sum'], d)
    pg.evaluate("()=>{ state.sick=3; render(); }")
    s2 = pg.evaluate("()=>byId('dsum').textContent")
    check('プルダウン：病気中は状態の一言が要約', '病気中' in s2, s2)
    pg.evaluate("()=>{ state.sick=0; render(); }")
    pg.click('#dsum')
    d = pg.evaluate("()=>({open:byId('dtl').open, fe:byId('fe').getBoundingClientRect().height>0, qx:byId('qx').getBoundingClientRect().height>0})")
    check('プルダウン：タップで詳細（テナント料・ノルマ内訳）が開く', d['open'] and d['fe'] and d['qx'], d)
    pg.evaluate("()=>render()")
    check('プルダウン：再描画しても開いたまま', pg.evaluate("()=>byId('dtl').open"))
    if OUT:
        pg.screenshot(path=os.path.join(OUT, 'v153-open.png'))
        pg.click('#dsum')
        pg.screenshot(path=os.path.join(OUT, 'v153-closed.png'))
    check('ページのエラーなし', not errs, errs)
    b.close()

print('\n失敗：' + ', '.join(fails) if fails else '\nすべて OK')
sys.exit(1 if fails else 0)
