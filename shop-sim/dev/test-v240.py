"""
v2.4.0 の確認：スタイルビルダー（解放の条件・お知らせ・作る・直す・消す・出店と改装で選ぶ・読み直し）。
使い方：リポジトリ直下で python3 -m http.server 8090 を起動してから
  PW_CHROME=/opt/pw-browsers/chromium python3 shop-sim/dev/test-v240.py [スクリーンショットの出力先]
"""
import os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL') or 'http://localhost:8090/shop-sim/'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shop-sim-v240'
os.makedirs(OUT, exist_ok=True)
NG = []

def check(name, ok, info=''):
    print(('OK  ' if ok else 'NG  ') + name + ('' if ok else '  ' + str(info)))
    if not ok:
        NG.append(name)

def shot(pg, name):
    pg.screenshot(path=os.path.join(OUT, name + '.png'))

DAY = """()=>{ nextDay(); if(state.phase==='prep'){ fillAll(); openShop(); }
  let g=0; while(state.phase==='open' && g++<3000){ state.paused=false; state.kama=0; tick(); } render(); }"""
CO = """()=>{ newGame('hard'); state.slots=10; state.ad=18; state.clerk=1; state.cap=100; state.money=900000000; state.happy=90;
  state.own=[0,1,2,3,4,5,6,7,8,9]; state.shelf=state.own.map(id=>({id,st:0})); state.day=14; state.prev=3000000; render();
  hireMgr(); coFound('ちくわ商店', 5000000); state.tab=4; render(); }"""

with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': os.environ['PW_CHROME']} if os.environ.get('PW_CHROME') else {}))
    for W, H, tag in [(390, 820, 'sp'), (1280, 860, 'pc')]:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2 if W < 600 else 1)
        pg.add_init_script("try{localStorage.setItem('shop-sim-tutorial','1');localStorage.setItem('shop-sim-tutorial-co','1')}catch(e){}")
        pg.on('dialog', lambda d: d.accept())
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL)
        pg.wait_for_timeout(500)
        pg.evaluate(CO)

        # 解放前：会社タブに条件が出る
        check(tag + ' 解放前：条件のカード', pg.evaluate("()=>/スタイルビルダー 🔒/.test(byId('co').textContent) && /純資産/.test(byId('co').textContent) && !document.querySelector('[data-a=sbopen]')"))
        pg.evaluate("()=>{ while(state.stores.length<9) state.stores.push(newStore((state.stores.length+1)+'号店','suburb','food')); state.money=2e9; render(); }")
        pg.evaluate(DAY)
        check(tag + ' 9店舗では解放しない', pg.evaluate("()=>!state.co.sbU"))
        pg.evaluate("()=>{ state.stores.push(newStore('10号店','suburb','toy')); state.money=1e8; render(); }")
        pg.evaluate(DAY)
        check(tag + ' 純資産が足りないと解放しない', pg.evaluate("()=>!state.co.sbU && sbParts()[0].ok && !sbParts()[1].ok"), pg.evaluate("()=>sbParts()"))
        pg.evaluate("()=>{ state.money=2e9; }")
        pg.evaluate(DAY)
        pg.wait_for_timeout(600)
        check(tag + ' 10店舗＋純資産10億円で解放し、お知らせが出る', pg.evaluate("()=>!!state.co.sbU && !byId('sbm').hidden && /自分だけのお店/.test(byId('sbm').textContent)"))
        shot(pg, tag + '-1-hello')

        # 作る（おもちゃ屋さんをもとに）
        pg.click('#sbm [data-a=sblist]')
        pg.select_option('#sbbase', 'toy')
        pg.click('[data-a=sbnew]')
        check(tag + ' 編集：もとのスタイルの商品が入る', pg.evaluate("()=>sbDraft.items[0].n==='シャボン玉' && document.querySelectorAll('.sbit').length===12"))
        pg.click('[data-a=sbsave]')
        check(tag + ' 名前が空だと保存できない', pg.evaluate("()=>/名前を入れて/.test(byId('sberr').textContent) && sbMine().length===0"))
        pg.fill('[data-sb=n]', 'ちくわ<b>堂')
        pg.fill('[data-sb=e]', '🍢')
        pg.fill('[data-sb="0.n"]', 'ちくわ')
        pg.fill('[data-sb="0.c"]', '500000')
        pg.fill('[data-sb="1.e"]', '🍥')
        r = pg.evaluate("()=>byId('sbbal').textContent")
        check(tag + ' 入力でバランスの表示が変わる', '来店数' in r, r)
        pg.evaluate("()=>document.querySelector('.sbit details').open=true")
        shot(pg, tag + '-2-edit')
        pg.click('[data-a=sbsave]')
        r = pg.evaluate("()=>({m:sbMine().length, t:sbMine()[0]})")
        t = r['t']
        check(tag + ' 保存：記号は消え、安い順に並ぶ', r['m'] == 1 and t['n'] == 'ちくわb堂' and t['e'] == '🍢' and all(t['items'][i]['c'] <= t['items'][i + 1]['c'] for i in range(11)), t)
        check(tag + ' 保存：来店数は原価から自動、上位品の名前も自動', 0.02 <= t['cust'] < 1 and any(x['n'] == 'ちくわ' and x['up'][1] == '定番ちくわ' for x in t['items']), t['cust'])
        shot(pg, tag + '-3-list')
        pg.click('#sbm [data-a=sbclose]')

        # 出店で選べる → その店へ行くと商品が変わる
        pg.evaluate("()=>{ state.stores.splice(9,1); state.tab=4; state.co.lsel='suburb'; render(); }")
        my = t['id']
        check(tag + ' 出店のプルダウンに自作が出る', pg.evaluate("(id)=>[...byId('ssty').options].some(o=>o.value===id && !o.disabled && /自作/.test(o.textContent))", my))
        pg.select_option('#ssty', my)
        pg.fill('#sname', '自作の店')
        pg.evaluate("()=>{ state.stores.forEach(s=>s.qual=true); render(); }")
        pg.click('[data-a=coopen]')
        r = pg.evaluate("()=>({n:state.stores.length, sty:state.stores.at(-1).sty})")
        check(tag + ' 自作のスタイルでお店を出せる', r['n'] == 10 and r['sty'] == my, r)
        pg.evaluate("()=>coSwitch(9)")
        pg.wait_for_timeout(300)
        r = pg.evaluate("()=>({names:PRODUCTS.map(p=>p.n0), roof:PXT.r, cust:styCust()})")
        check(tag + ' 自作の店：商品・色・来店数', 'ちくわ' in r['names'] and r['cust'] == t['cust'] and r['roof'] == t['r'], r)
        pg.evaluate(DAY)
        check(tag + ' 自作の店で営業できる', pg.evaluate("()=>!state.over && state.tot>=0"))

        # 使っているときは原価が変えられない・消せない
        pg.evaluate("()=>sbOpen('list')")
        check(tag + ' 使っているスタイルは消せない', pg.evaluate("()=>document.querySelector('[data-a=sbdel]').disabled"))
        pg.click('[data-a=sbedit]')
        check(tag + ' 使っているスタイルは原価が変えられない', pg.evaluate("()=>document.querySelector('[data-sb=\"0.c\"]').disabled"))
        pg.fill('[data-sb=n]', 'ちくわ本舗')
        pg.click('[data-a=sbsave]')
        check(tag + ' 名前は直せて、いまの店にも反映', pg.evaluate("()=>sbMine()[0].n==='ちくわ本舗' && /ちくわ本舗/.test(styName())"))
        pg.click('#sbm [data-a=sbclose]')

        # 改装の画面にも出る
        pg.evaluate("()=>{ coSwitch(0); }")
        pg.evaluate("()=>styPanel(0)")
        check(tag + ' 改装の画面に自作が出る', pg.evaluate("()=>/ちくわ本舗/.test(byId('stym').textContent) && /自作/.test(byId('stym').textContent)"))
        pg.evaluate("()=>styPanel(-1)")

        # はじめは3つまで（広告が出ていないときは「予定」の表示）
        for k in range(2):
            pg.evaluate("()=>sbOpen('list')")
            pg.click('[data-a=sbnew]')
            pg.fill('[data-sb=n]', 'じさく' + str(k))
            pg.click('[data-a=sbsave]')
        check(tag + ' はじめは3つまで（新しく作るが出ない・広告のボタンは出ない）', pg.evaluate("()=>sbMine().length===3 && !document.querySelector('[data-a=sbnew]') && !document.querySelector('[data-a=sbslot]') && /広告で増やせるようになる予定/.test(byId('sbm').textContent)"))
        pg.click('#sbm [data-a=sbdel][data-v="' + pg.evaluate("()=>sbMine()[2].id") + '"]')
        check(tag + ' 使っていないスタイルは消せる', pg.evaluate("()=>sbMine().length===2"))
        pg.click('#sbm [data-a=sbclose]')

        # 読み直しても残る
        pg.evaluate("()=>save()")
        pg.reload()
        pg.wait_for_timeout(500)
        r = pg.evaluate("()=>({m:sbMine().length, u:!!state.co.sbU, s:allStores()[9].sty})")
        check(tag + ' 読み直し：自作と解放が残る', r['m'] == 2 and r['u'] and r['s'] == my, r)
        pg.evaluate("()=>{ state.tab=4; render(); byId('co').querySelector('.sbc').scrollIntoView(); }")
        shot(pg, tag + '-4-card')
        check(tag + ' エラーなし', not errs, errs)
        pg.close()

    # ?ad=test：広告を見て持てる数を増やす（最大5つ）
    pg = b.new_page(viewport={'width': 390, 'height': 820})
    pg.add_init_script("try{localStorage.setItem('shop-sim-tutorial','1');localStorage.setItem('shop-sim-tutorial-co','1')}catch(e){}")
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '?ad=test')
    pg.wait_for_timeout(500)
    pg.evaluate(CO)
    pg.evaluate("()=>{ state.co.sbU=1; state.co.myS=[1,2,3].map(k=>Object.assign(JSON.parse(JSON.stringify(STYLES[2])),{id:'my'+k,my:true,n:'じさく'+k})); sbOpen('list'); }")
    for k in range(2):
        pg.click('[data-a=sbslot]')
        pg.wait_for_timeout(5600)
    r = pg.evaluate("()=>({cap:sbCap(), x:state.co.sbX, slot:!!document.querySelector('[data-a=sbslot]'), nw:!!document.querySelector('[data-a=sbnew]')})")
    check('広告：2回見ると5つまで持てて、それ以上は増やせない', r['cap'] == 5 and r['x'] == 2 and not r['slot'] and r['nw'], r)
    check('広告：エラーなし', not errs, errs)
    b.close()
print('\nすべてOK' if not NG else '\nNG：' + '、'.join(NG))
sys.exit(1 if NG else 0)
