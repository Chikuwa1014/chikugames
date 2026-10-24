/**
 * ui.js — 画面の描画とボタン操作。
 */

/** 営業時間の選択肢（option）を作る */
const hrs = (a, b, v) => Array.from({ length: b - a + 1 }, (_, i) => {
    const h = a + i;
    return '<option' + (h === v ? ' selected' : '') + ' value="' + h + '">' + h + ':00</option>';
}).join('');

/** 最初からやり直す（難易度選択へ戻る） */
function restart() {
    state = fresh();
    applyUp();
    state.next = roll(1);
    state.weather = state.next;
    dragMg = false;
    render();
    save();
}

/**
 * 営業タブのログ欄（v1.4.0〜）。高さ4行分の枠でスクロールし、直近 LOGN 件までさかのぼれる。
 * 新しい行は上に足す。さかのぼって読んでいる間は、新しい行が来ても読んでいる位置がずれないようにする
 */
let logSig = '';
function syncLog() {
    const el = byId('lg'), L = logList(), sig = logSeq + '|' + L.length;
    if (sig === logSig && el.innerHTML)
        return;
    logSig = sig;
    const st = el.scrollTop, sh = el.scrollHeight;
    el.innerHTML = L.map(l => '<div' + (l.s ? ' class="sale"' : '') + '>' + l.t + '</div>').join('');
    if (st > 0)
        el.scrollTop = st + (el.scrollHeight - sh);
}

/** 画面全体の描画 */
/** 閉店後以外は、お金の欄を無効化してグレーアウトする（？アイコンは押せるまま） */
const lockMoney = h => state.phase === 'closed' ? h : h.replace(/class="card"/g, 'class="card off"').replace(/<(input|select)/g, '<$1 disabled').replace(/<button data-a="sv/g, '<button disabled data-a="sv').replace(/<button class="alt" data-a="sv/g, '<button class="alt" disabled data-a="sv');

function render() {
    const d = Math.max(state.day, 1), m = Math.floor((d - 1) / MD) + 1, sea = SEA[seaOf(d)], we = WE[state.weather];
    byId('m').innerHTML = '<small>¥</small>' + (state.money < 0 ? '-' : '') + fmt(Math.abs(state.money));
    byId('m').className = 'money' + (state.money < 0 ? ' neg' : '');
    byId('dt').textContent = state.day === 0 ? '開業前' : sea.e + sea.n + ' / ' + calOf(d) + '月' + ((d - 1) % MD + 1) + '日目（通算' + m + 'ヶ月' + state.day + '日）' + we.e + we.n;
    byId('sp').innerHTML = Object.keys(PHN).map(k => '<span class="' + (state.phase === k ? 'on' : '') + '">' + PHN[k] + '</span>').join('');
    byId('gl').innerHTML = state.boost > 0 ? '<span class="boost">🔥ブースト中 残り' + state.boost + '秒</span>' : Math.floor(state.gauge) + ' / 100';
    byId('gb').style.width = state.gauge + '%';
    const pw = pwr(state.day);
    byId('pw').textContent = state.day === 0 ? '' : '購買力×' + (Math.round(pw * 1000) / 1000);
    byId('pw').title = '季節×' + sea.p + ' 天気×' + we.p;
    const q = quota();
    byId('ql').textContent = '¥' + fmt(state.mSales) + ' / ¥' + fmt(q);
    byId('qi').style.width = Math.min(100, state.mSales / q * 100) + '%';
    byId('qb').className = 'bar' + (state.mSales >= q ? '' : ' low');
    const left = state.day === 0 ? MD : MD - ((d - 1) % MD) - 1;
    byId('fe').textContent = 'テナント料 月¥' + fmt(tenantFee()) + '（棚' + state.slots + '台）' + (loanPay() ? ' / 返済 月¥' + fmt(loanPay()) : '') + (state.mWage > 0 ? ' / 給料未払 ¥' + fmt(state.mWage) : '');
    byId('qd').textContent = (left === 0 ? '本日が月末' : '月末まであと' + left + '日') + ' / 棚増設チェック' + (state.slotQ > 0 ? '済' : 'あと' + (3 - (Math.floor((d - 1) / MD) % 3)) + 'ヶ月');
    let a = '';
    if (state.over)
        a = '<div class="card over">' + (state.overMsg || '倒産しました。') + '</div><button class="big" data-a="ovshow">📣 結果を見る・シェアする</button>';
    else if (state.phase === 'prep')
        a = '<button class="big" data-a="fillall"' + (ill() ? ' disabled' : '') + ' style="background:transparent;color:var(--ink);border:1.5px solid var(--ink)">一括満タン（所持金の範囲で）</button><button class="big" data-a="open">開店する</button>';
    else if (state.phase === 'open')
        a = state.kama ? '<div class="hint">⛄ かまくら作り中（12:00から甘酒ボーナス）</div>' : '';
    else
        a = '<button class="big" data-a="next">' + (state.day === 0 ? '開業する' : state.hol ? '店休日を過ごす' : '翌日へ進む') + '</button>';
    byId('act').innerHTML = a;
    {
        const n = state.ss || 0, e = byId('secn');
        e.hidden = n <= 0;
        e.textContent = '🛡×' + n;
        e.title = 'セキュリティのストック ' + n + '/5';
    }
    // 営業中の現在時刻（v1.4.1〜。購買欲ゲージの上に大きく）
    byId('clk').hidden = state.phase !== 'open' || state.over;
    if (state.phase === 'open')
        byId('clk').innerHTML = '<span class="clkt">🕘 ' + (state.openH + Math.floor(state.t / 5)) + ':' + String((state.t % 5) * 12).padStart(2, '0') + '</span><span class="clkr">' + (state.paused ? '⏸ 一時停止中 / ' : '営業中 ') + state.openH + ':00〜' + state.closeH + ':00</span>';
    syncOver();
    syncSave();
    syncAma();
    syncLog();
    let pn = '';
    if (state.evs.length)
        pn += '<div class="card"><b>本日のできごと</b>' + state.evs.map(t => '<div class="meta">' + t + '</div>').join('') + '</div>';
    const tags = [state.fem > 0 ? '🍌女性客×5（あと' + state.fem + '日）' : '', state.rb > 0 ? '🍙おにぎりブーム（あと' + state.rb + '日）' : '', state.flame > 0 ? '🔥炎上中（あと' + state.flame + '日）' : ''].filter(Boolean);
    if (tags.length)
        pn += '<div class="card meta">' + tags.join('　') + '</div>';
    if (state.boom > 0 || state.pays.length)
        pn += '<div class="card meta">' + (state.boom > 0 ? '🎉 ブーム中（あと' + state.boom + '日）：まとめ買い増　' : '') + (state.pays.length ? '💳 ' + state.pays.join('・') + '（客足×' + Math.round(Math.pow(1.2, state.pays.length) * 100) / 100 + '）' : '') + '</div>';
    if (state.phase === 'closed' && !state.over) {
        const nd = state.day + 1, nw = WE[state.next], ns = SEA[seaOf(nd)];
        if (state.day > 0)
            pn += '<div class="card"><b>本日の結果</b><div class="meta">売上 ¥' + fmt(state.dRev) + ' / 販売 ' + state.dSold + '個 / 取り逃がし ' + state.dMiss + '人 / 来店 男' + (state.dM || 0) + '・女' + (state.dF || 0) + (state.dWage ? ' / 給料 ¥' + fmt(state.dWage) : '') + '</div></div>';
        pn += '<div class="card fc"><span class="emo">' + nw.e + '</span><div style="flex:1"><b>翌日の天気予報：' + nw.n + '</b><div class="meta">' + ns.e + ns.n + ' ／ 購買力 ×' + (Math.round(ns.p * nw.p * 1000) / 1000) + (nd % MD === 0 ? ' ／ 明日は月末（テナント料¥' + fmt(tenantFee()) + '）' : '') + '</div>' + (state.warn && state.warn.snow ? '<div class="meta" style="color:var(--red);font-weight:700">⚠ 大雪の予報（交通マヒの恐れ・信頼度約80%）</div>' : '') + (state.warn && state.warn.typ ? '<div class="meta" style="color:var(--red);font-weight:700">⚠ 台風の予報（浸水の恐れ・信頼度約80%）</div>' : '') + '</div></div>';
        if (state.warn && (state.warn.typ || state.warn.snow)) {
            const k = state.warn.typ ? 'typ' : 'snow', on = state.prep && state.prep[k];
            pn += '<div class="card up"><div class="tx"><div class="nm">' + (k === 'typ' ? '🧱 土嚢を積んで耐える' + helpIcon('sandbag') : '⛄ かまくらを作る' + helpIcon('kama')) + '</div><div class="meta">無料・成功率55%</div></div><button class="' + (on ? '' : 'alt') + '" data-a="prep" data-v="' + k + '" style="flex:0 0 96px">' + (on ? '準備済み✓' : '備える') + '</button></div>';
        }
        pn += '<div class="card up"><div class="tx"><div class="nm">🛌 翌日を店休日にする' + helpIcon('hol') + '</div></div><button class="' + (state.hol ? '' : 'alt') + '" data-a="hol" style="flex:0 0 96px">' + (state.hol ? '休む✓' : '休まない') + '</button></div>';
        pn += '<div class="card"><b>🏦 融資</b>' + helpIcon('loan') + '<div class="row" style="margin:6px 0"><select data-a="la">' + LA.map(v => '<option' + (v >= 1500000 && v > loanCap() ? ' disabled' : '') + (state.ln.a === v ? ' selected' : '') + ' value="' + v + '">¥' + fmt(v) + '</option>').join('') + '</select><select data-a="lm">' + (state.ln.a >= 1500000 ? [3, 6, 12, 36, 48, 60] : [3, 6, 12]).map(v => '<option' + (state.ln.m === v ? ' selected' : '') + ' value="' + v + '">' + v + 'ヶ月払い</option>').join('') + '</select><button data-a="loan" style="flex:0 0 80px"' + (state.loans.length >= 3 || (state.ln.a >= 1500000 && state.ln.a > loanCap()) ? ' disabled' : '') + '>借りる</button></div><div class="meta">150万円以上の上限 ¥' + fmt(loanCap()) + '</div><div class="meta">利子' + Math.round(intr(state.ln.m) * 100) + '% → 総返済¥' + fmt(state.ln.a * (1 + intr(state.ln.m))) + '（月¥' + fmt(Math.round(state.ln.a * (1 + intr(state.ln.m)) / state.ln.m)) + '）</div>' + state.loans.map(l => '<div class="meta">返済中：月¥' + fmt(l.pay) + ' × 残り' + l.left + 'ヶ月</div>').join('') + '</div>';
    }
    byId('hp').textContent = Math.floor(state.happy) + '%';
    byId('hb').style.width = state.happy + '%';
    byId('hb').parentNode.className = 'bar' + (state.happy < 15 ? ' low' : '');
    byId('hs').textContent = state.sick > 0 ? '🤒 病気中（復帰まであと' + state.sick + '日）' + (state.clerk > 0 ? '・店員が営業中（給料150%）' : '・強制休業') : '15%未満で病気になります';
    byId('hs').textContent = state.dep > 0 ? '😔 うつ病で休養中（あと' + state.dep + '日）補充・投資不可' + (state.clerk > 0 ? '・店員が営業中（給料150%）' : '・休業') : state.sick > 0 ? '🤒 病気中（あと' + state.sick + '日）補充・投資不可' + (state.clerk > 0 ? '・店員が営業中（給料150%）' : '・休業') : (state.low || 0) >= 7 ? '⚠ 幸福度が20%未満の日が' + state.low + '日続いています' : '';
    {
        const e = eff();
        if (state.clerk > 0 && e < 0)
            byId('hs').textContent += ' 😡負の感情モード（店員Lv' + e + '・盗難中）休業か投資で回復';
        else if (state.mbDay && state.day === state.mbDay && state.clerk > 0)
            byId('hs').textContent += ' 💪士気アップ（店員+1Lv・本日のみ）';
        else if ((state.dn || 0) > 0)
            byId('hs').textContent += ' 😞士気低下（-' + state.dn + 'Lv）休業で1Lv/日回復';
    }
    byId('pn').innerHTML = pn;
    if (!dragMg)
        byId('mnyA').innerHTML = '';
    if (!dragMg)
        byId('mg').innerHTML = !state.over ? lockMoney('<div class="card"><div class="row"><b>粗利率の設定' + helpIcon('mg') + '</b><span id="mgv"></span></div><input type="range" min="10" max="70" step="1" value="' + state.margin + '" data-a="mg" style="width:100%"></div>' + '<div class="card"><div class="row"><b>自分の月収' + helpIcon('sal') + '</b><span id="slv"></span></div><input type="range" min="0" max="600000" step="10000" value="' + state.sal + '" data-a="sal" style="width:100%"></div><div class="card"><b>営業時間</b>' + helpIcon('hours') + '<div class="row" style="margin-top:6px"><select data-a="oh">' + hrs(5, 22, state.openH) + '</select><select data-a="ch">' + hrs(6, 23, state.closeH) + '</select></div></div>' + '<div class="card"><div class="row"><b>🏦 預金' + helpIcon('sv') + '</b><span>残高 ¥' + fmt(state.sv || 0) + '</span></div><input type="range" min="0" max="' + Math.max(Math.floor(Math.max(0, state.money) / 1000) * 1000, state.sv || 0) + '" step="1000" value="' + (state.svs || 0) + '" data-a="svx" style="width:100%"><div class="row"><span id="svv"></span></div><div class="btns"><button data-a="svin">預ける</button><button class="alt" data-a="svout">引き出す</button></div></div>') : '';
    const mv = byId('mgv');
    if (mv)
        mv.textContent = state.margin + '%（来店数 ×' + Math.round(demandFactor() * 100) / 100 + '）';
    const sv = byId('slv');
    if (sv)
        sv.textContent = '¥' + fmt(state.sal) + (state.sal >= 330000 ? '（中央値以上）' : '（中央値未満）');
    {
        const dd = difficulty();
        [['[data-a="mg"]', dd.full], ['[data-a="sal"]', dd.sal], ['[data-a="la"]', dd.full]].forEach(([q, v]) => {
            const e = document.querySelector(q);
            if (e && !v)
                e.closest('.card').style.display = 'none';
        });
        byId('dt').textContent = dd.n + ' / ' + byId('dt').textContent;
        byId('dfc').style.display = state.diff ? 'none' : 'block';
    }
    {
        const sw = byId('svv');
        if (sw)
            sw.textContent = '金額 ¥' + fmt(state.svs || 0);
        const A = byId('mnyA'), B = byId('mnyB');
        B.innerHTML = '';
        const lc = document.querySelector('[data-a="la"]');
        if (lc)
            B.appendChild(lc.closest('.card'));
        if (!dragMg) {
            A.innerHTML = '';
            ['mg', 'sal', 'svx'].forEach(k => {
                const e = document.querySelector('[data-a="' + k + '"]');
                if (e)
                    A.appendChild(e.closest('.card'));
            });
            if (A.children.length && state.phase !== 'closed')
                A.insertAdjacentHTML('afterbegin', '<div class="meta svwarn">粗利率・月収・預金は、閉店後に変更できます。</div>');
        }
        byId('mny').style.display = (A.children.length + B.children.length) ? '' : 'none';
        byId('ph').textContent = PHN[state.phase] || '';
        // タブの右端に一時停止と倍速（v1.4.0〜。倍速は押すたび×1→×2→×4→×8）
        byId('tabs').innerHTML = ['🏪 営業', '🛒 投資', '💰 お金', '⚙ 設定'].map((t, i) => '<button class="' + ((state.tab || 0) === i ? '' : 'alt') + '" data-a="tab" data-v="' + i + '">' + t + '</button>').join('') +
            '<span class="spd"><button class="' + (state.paused ? '' : 'alt') + '" data-a="pause"' + (state.phase === 'open' ? '' : ' disabled') + ' aria-label="' + (state.paused ? '再開' : '一時停止') + '">' + (state.paused ? '▶' : '⏸') + '</button><button class="' + ((state.spd || 1) > 1 ? '' : 'alt') + '" data-a="spdc" aria-label="倍速">×' + (state.spd || 1) + '</button></span>';
        [0, 1, 2, 3].forEach(i => {
            const e = byId('p' + i);
            if (e)
                e.style.display = (state.tab || 0) === i ? '' : 'none';
        });
    }
    const can = state.phase !== 'closed' && !state.over && !ill();
    byId('sh').innerHTML = state.shelf.map((s, i) => {
        if (!s)
            return '<div class="shelf empty">空き棚<br>新商品を扱うと並びます</div>';
        const p = PRODUCTS[s.id], dis = (!can || state.money < p.c || s.st >= state.cap) ? ' disabled' : '';
        return '<div class="shelf"><div class="top"><span class="emo">' + p.e + '</span><div><div class="nm">' + p.n + (state.up[s.id] ? ' <small>Lv' + state.up[s.id] + '</small>' : '') + '</div><span class="price">¥' + fmt(priceOf(p)) + '</span></div></div>' +
            '<div class="bar' + (s.st <= Math.ceil(state.cap * .2) ? ' low' : '') + '"><i style="width:' + (s.st / state.cap * 100) + '%"></i></div>' +
            '<div class="cnt"><span>' + s.st + ' / ' + state.cap + '個</span><span>原価 ¥' + fmt(p.c) + '</span></div>' +
            '<div class="btns"><button class="alt" data-a="r" data-i="' + i + '" data-n="5"' + dis + '>+5</button><button data-a="r" data-i="' + i + '" data-n="999"' + dis + '>満タン</button></div></div>';
    }).join('');
    const ok = state.phase === 'closed' && !state.over && !ill();
    const row = (k, id, t, dsc, price, done) => '<div class="card up"><div class="tx"><div class="nm">' + t + '</div><div class="d">' + dsc + '</div></div><button data-a="b" data-k="' + k + '" data-id="' + id + '"' + (done || !ok || state.money < price ? ' disabled' : '') + '>' + (done === 1 ? '未解放' : done ? '最大' : '¥' + fmt(price)) + '</button></div>';
    const R = [];
    R.push(row('slot', '', '🪜 棚を増やす（' + state.slots + '/' + MAX.slot + '）', '次の解放: ' + (state.own.length < PRODUCTS.length ? PRODUCTS[state.own.length].e + ' ' + PRODUCTS[state.own.length].n : 'なし') + (state.slots < MAX.slot ? '。テナント料 月¥' + fmt(tenantFee()) + ' → <b>月¥' + fmt(tenantFee(state.slots + 1)) + '</b>' : ''), cost.slot(), state.slots >= MAX.slot));
    R.push(row('cap', '', '📦 棚の容量アップ（' + state.cap + '個）', '次の容量: ' + (CAPS[CAPS.indexOf(state.cap) + 1] || '最大') + '個', cost.cap(), state.cap >= MAX.cap));
    R.push(row('ad', '', '📣 広告（Lv.' + state.ad + '）', '来店数とまとめ買いが増える', cost.ad(), state.ad >= MAX.ad));
    R.push(row('clerk', '', '🧑‍🍳 店員（' + state.clerk + '人）', '営業中、毎秒ランダムな棚へ自動補充（補充量は能力で上がる）。時給¥' + fmt(WAGE) + '（〜7時・22時〜は125%）・給料は月末払い', cost.clerk(), state.clerk >= MAX.clerk));
    PRODUCTS.forEach((p, id) => {
        if (false)
            R.push(row('new', id, p.e + ' ' + p.n + 'を扱う', '原価¥' + fmt(p.c) + ' → 売値¥' + fmt(priceOf(p)) + '（利益¥' + fmt(priceOf(p) - p.c) + '）', p.u, false));
    });
    const SECR = [];
    SECR.push(row('seclv', '', '🛡 セキュリティ Lv.' + (state.sl || 0) + '/10' + (state.sl ? ' ' + SECN[state.sl - 1] : ''), (state.sl >= 10 ? '最大レベル' : '次: ' + SECN[state.sl || 0] + '（' + SECX[state.sl || 0] + '）'), cost.seclv(), (state.sl || 0) >= 10));
    SECR.push(row('secbuy', '', '🛡 ストックを買う（' + (state.ss || 0) + '/5）', (state.sl > 0 ? SECN[state.sl - 1] + '：' + SECX[state.sl - 1] + '。破損まで' + ((state.ss || 0) > 0 ? Math.max(0, (state.sb || 0) - state.day) + '日' : (SECD[state.sl - 1] / 7) + 'ヶ月') + '（盗難1回ごとに1つ消費）' : 'まずレベルを上げてください'), cost.secbuy(), !(state.sl > 0) ? 1 : (state.ss || 0) >= 5));
    R.push(row('skill', '', '🧠 店員の能力（Lv.' + eff() + '/10）', '1回の補充量: ' + (eff() >= 10 ? '満タン' : eff() < 0 ? '0（盗難中）' : 5 * Math.pow(2, eff()) + '個') + '。投資ごとに2倍、Lv10で満タン', cost.skill(), (state.sk || 0) >= 10));
    R.push(...SECR);
    PRODUCTS.forEach((p, i) => {
        if (!state.own.includes(i))
            return;
        const L = state.up[i];
        let d, pc = 0, dn = false;
        if (L >= 7) {
            d = '最大レベル';
            dn = true;
        }
        else if (state.sd[i] < TH[L]) {
            d = '解放まであと' + (TH[L] - state.sd[i]) + '個販売 → ' + NM[i][L];
            dn = 1;
        }
        else {
            pc = upCost(i, L);
            d = '→ ' + NM[i][L] + '（原価・売価アップ）';
        }
        R.push(row('upg', i, '⬆ ' + p.e + ' ' + p.n + ' Lv.' + L + '/7', d, pc, dn));
    });
    const ib = investBlock();
    byId('up').innerHTML = (ib ? '<div class="meta svwarn ivb">⚠ ' + ib + '</div>' : '') + R.join('');
}

document.addEventListener('click', e => {
    if (!e.target.closest('[data-a="help"]'))
        hideHelp();
}, true);
document.addEventListener('scroll', hideHelp, true);
addEventListener('resize', hideHelp);

document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled)
        return;
    const a = b.dataset.a;
    if (a === 'help') {
        e.preventDefault();
        showHelp(b);
        return;
    }
    if (a === 'r')
        restock(+b.dataset.i, +b.dataset.n);
    if (a === 'b')
        buy(b.dataset.k, b.dataset.id === '' ? null : +b.dataset.id);
    if (a === 'diff')
        newGame(b.dataset.v);
    if (a === 'tab') {
        state.tab = +b.dataset.v;
        render();
        save();
        byId('scr').scrollTop = 0;
    }
    if (a === 'svin')
        svMove(1);
    if (a === 'svout')
        svMove(-1);
    if (a === 'pause') {
        state.paused = !state.paused;
        render();
    }
    if (a === 'fillall')
        fillAll();
    if (a === 'ovshow' || a === 'ovclose') {
        state.ovx = a === 'ovclose';
        render();
        save();
    }
    if (a === 'restart')
        restart();
    if (a === 'fsave')
        exportSave();
    if (a === 'fload') {
        svMsg = null;
        byId('svf').click();
    }
    if (a === 'fok')
        applyLoad();
    if (a === 'ccopy')
        makeCode();
    if (a === 'cin' || a === 'cno') {
        svIn = a === 'cin';
        svCode = '';
        svMsg = null;
        syncSave();
        const t = byId('svci');
        if (t)
            t.focus();
    }
    if (a === 'cread')
        readCode();
    if (a === 'fno') {
        svPend = null;
        svMsg = null;
        syncSave();
    }
    if (a === 'share')
        shareResult();
    if (a === 'shimg')
        saveResultImage();
    if (a === 'shcopy')
        copyShareText(b);
    if (a === 'spd' || a === 'spdc') {
        const S = [1, 2, 4, 8];
        state.spd = a === 'spd' ? +b.dataset.v : S[(S.indexOf(state.spd || 1) + 1) % S.length];
        render();
        save();
    }
    if (a === 'loan')
        takeLoan();
    if (a === 'open')
        openShop();
    if (a === 'next')
        nextDay();
    if (a === 'prep') {
        state.prep = state.prep || { typ: false, snow: false };
        state.prep[b.dataset.v] = !state.prep[b.dataset.v];
        render();
        save();
    }
    if (a === 'amaclose')
        amaClose();
    if (a === 'hol') {
        state.hol = !state.hol;
        render();
        save();
    }
    if (a === 'reset') {
        if (!window.rs) {
            window.rs = 1;
            b.textContent = '⚠ もう一度押すとリセットします';
            b.classList.add('arm');
            setTimeout(() => {
                window.rs = 0;
                b.textContent = '最初からやり直す';
                b.classList.remove('arm');
            }, 4000);
        }
        else {
            window.rs = 0;
            b.textContent = '最初からやり直す';
            b.classList.remove('arm');
            restart();
        }
    }
});

document.addEventListener('input', e => {
    const a = e.target.dataset.a;
    if (a === 'mg') {
        dragMg = true;
        state.margin = +e.target.value;
        render();
    }
    if (a === 'sal') {
        dragMg = true;
        state.sal = +e.target.value;
        render();
    }
    if (a === 'svx') {
        dragMg = true;
        state.svs = +e.target.value;
        render();
    }
});

document.addEventListener('change', e => {
    const t = e.target, a = t.dataset.a;
    if (t.id === 'svf') {
        importFile(t.files && t.files[0]);
        t.value = '';
    }
    if (a === 'mg') {
        dragMg = false;
        state.margin = +t.value;
        render();
        save();
    }
    if (a === 'sal') {
        dragMg = false;
        state.sal = +t.value;
        render();
        save();
    }
    if (a === 'svx') {
        dragMg = false;
        state.svs = +t.value;
        render();
        save();
    }
    if (a === 'oh') {
        state.openH = +t.value;
        if (state.closeH <= state.openH)
            state.closeH = state.openH + 1;
        render();
        save();
    }
    if (a === 'ch') {
        state.closeH = +t.value;
        if (state.closeH <= state.openH)
            state.openH = state.closeH - 1;
        render();
        save();
    }
    if (a === 'la') {
        state.ln.a = +t.value;
        if (state.ln.a < 1500000 && state.ln.m > 12)
            state.ln.m = 12;
        render();
    }
    if (a === 'lm') {
        state.ln.m = +t.value;
        render();
    }
});

/** 画面の組み替え（固定の上部・タブ・スクロール領域）。起動時に1回だけ呼ぶ */
function initLayout() {
    const tp = document.createElement('div');
    tp.id = 'top';
    document.querySelector('.awning').after(tp);
    const hr = document.createElement('div');
    // 1行目に所持金と実績のバッジ（v1.4.0〜）、2行目に難易度・季節・日付・天気（右揃え。v1.3.0〜）
    hr.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;gap:0';
    byId('dt').style.cssText = 'font-size:12px;text-align:right';
    const mr = document.createElement('div');
    mr.className = 'mrow';
    mr.append(byId('m'));
    mr.insertAdjacentHTML('beforeend', '<button class="alt achb" id="achb" data-a="achopen" aria-label="実績"></button>');
    hr.append(mr, byId('dt'));
    tp.append(hr);
    const dd = byId('px').closest('details');
    dd.style.margin = '4px 0';
    // ドット絵の右上にセキュリティのストック残数（v1.4.2〜。0のときは出さない）
    const pw = document.createElement('div');
    pw.className = 'pxw';
    byId('px').before(pw);
    pw.append(byId('px'));
    pw.insertAdjacentHTML('beforeend', '<span class="secn" id="secn" hidden></span>');
    tp.append(dd);
    byId('sd').remove();
    const tb = document.createElement('div');
    tb.id = 'tabs';
    tb.className = 'sd';
    tp.append(tb);
    const mk = i => {
        const d = document.createElement('div');
        d.id = 'p' + i;
        return d;
    }, P0 = mk(0), P1 = mk(1), P2 = mk(2), P3 = mk(3);
    P0.insertAdjacentHTML('afterbegin', '<div class="clk" id="clk" hidden></div>');
    [byId('gl').closest('.card'), byId('act'), byId('lg'), byId('pn'), byId('sh').previousElementSibling, byId('sh')].forEach(e => P0.append(e));
    P1.append(byId('up').previousElementSibling, byId('up'));
    const my = byId('mny');
    my.open = true;
    P2.append(my);
    P3.append(byId('mg'), byId('svd'), byId('svf'), byId('dbg'), document.querySelector('.rst'), byId('chg'), document.querySelector('.foot'));
    const sc = document.createElement('div');
    sc.id = 'scr';
    sc.append(P0, P1, P2, P3);
    tp.after(sc);
}
