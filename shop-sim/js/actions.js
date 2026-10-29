/**
 * actions.js — プレイヤーの操作（補充・投資・融資・預金・開店など）。
 */

/** 空き棚に未陳列の商品を並べる */
function fill() {
    for (let i = 0; i < state.shelf.length; i++) {
        if (state.shelf[i])
            continue;
        const sh = state.shelf.filter(Boolean).map(s => s.id);
        const nx = state.own.find(id => !sh.includes(id));
        if (nx !== undefined)
            state.shelf[i] = { id: nx, st: 0 };
    }
}

/** 1つの棚を補充 */
function restock(i, n) {
    if (state.phase === 'closed' || state.over || ill())
        return;
    const s = state.shelf[i];
    if (!s)
        return;
    const p = PRODUCTS[s.id];
    const q = Math.min(n, state.cap - s.st, Math.floor(state.money / p.c));
    if (q <= 0)
        return;
    s.st += q;
    state.money -= q * p.c;
    render();
    save();
}

/** 投資ボタンの処理 */
function buy(k, id) {
    if (state.phase !== 'closed' || state.over || ill())
        return;
    if (k === 'upg') {
        upgrade(id);
        return;
    }
    if (k === 'new') {
        const p = PRODUCTS[id];
        if (state.money < p.u || state.own.includes(id))
            return;
        state.money -= p.u;
        state.own.push(id);
        fill();
        addLog(p.e + ' ' + p.n + 'を扱い始めました。');
    }
    else {
        const c = cost[k]();
        const cur = {
            slot: state.slots, cap: state.cap, ad: state.ad, clerk: state.clerk, skill: state.sk || 0, seclv: state.sl || 0, secbuy: state.ss || 0
        }[k];
        if (state.money < c || cur >= MAX[k] || (k === 'secbuy' && !(state.sl > 0)))
            return;
        state.money -= c;
        if (k === 'slot') {
            state.slotQ = (state.slotQ || 0) + 1;
            addSlot();
            addLog('棚が' + state.slots + '台に。テナント料は月' + yen(tenantFee()) + 'になります。');
        }
        if (k === 'cap') {
            state.cap = CAPS[CAPS.indexOf(state.cap) + 1] || state.cap;
            addLog('1棚' + state.cap + '個まで置けます。');
        }
        if (k === 'ad') {
            state.ad++;
            addLog('広告を出しました。来店数が増えます。');
        }
        if (k === 'seclv') {
            state.sl = (state.sl || 0) + 1;
            addLog('🛡 ' + SECN[state.sl - 1] + 'を導入できるようになりました。');
        }
        if (k === 'secbuy') {
            if ((state.ss || 0) === 0)
                state.sb = state.day + SECD[state.sl - 1];
            state.ss = (state.ss || 0) + 1;
            addLog('🛡 ' + SECN[state.sl - 1] + 'を購入（ストック' + state.ss + '/5）');
        }
        if (k === 'skill') {
            state.sk = (state.sk || 0) + 1;
            addLog('🧠 店員の能力が上がりました。');
        }
        if (k === 'clerk') {
            state.clerk++;
            addLog('店員を雇いました。営業中に自動補充します。');
        }
    }
    render();
    save();
}

/** 棚を1台増やす（上位商品を解放） */
function addSlot() {
    state.slots++;
    state.shelf.push(null);
    if (state.own.length < state.slots && state.own.length < kindN()) {
        state.own.push(state.own.length);
        const q = PRODUCTS[state.own.length - 1];
        addLog(q.e + ' ' + q.n + 'が解放されました。');
    }
    fill();
}

/** 開店前の一括満タン */
function fillAll() {
    if (state.phase !== 'prep' || state.over || ill())
        return;
    state.shelf.map((s, i) => i).filter(i => state.shelf[i]).sort((a, b) => PRODUCTS[state.shelf[a].id].c - PRODUCTS[state.shelf[b].id].c).forEach(i => {
        const s = state.shelf[i], p = PRODUCTS[s.id], q = Math.min(state.cap - s.st, Math.floor(state.money / p.c));
        if (q > 0) {
            s.st += q;
            state.money -= q * p.c;
        }
    });
    addLog('📦 一括補充しました。');
    render();
    save();
}

/** 商品のアップグレード */
function upgrade(id) {
    const L = state.up[id];
    if (L >= 7 || state.sd[id] < TH[L])
        return;
    const c = upCost(id, L);
    if (state.money < c)
        return;
    state.money -= c;
    state.up[id]++;
    applyUp();
    addLog('⬆ ' + PRODUCTS[id].e + ' ' + PRODUCTS[id].n + 'にアップグレード！');
    render();
    save();
}

/** 難易度を選んで新規開始 */
function newGame(v) {
    const d = DF[v];
    if (!d)
        return;
    state = fresh();
    state.diff = v;
    state.money = d.money;
    state.margin = d.mg;
    state.sal = 0;
    applyDiff();
    applyUp();
    state.next = roll(1);
    state.weather = state.next;
    render();
    save();
}

/** 預金の預け入れ・引き出し */
function svMove(dir) {
    if (state.phase !== 'closed' || state.over)
        return;
    const a = dir > 0 ? Math.min(state.svs || 0, Math.floor(Math.max(0, state.money) / 1000) * 1000) : Math.min(state.svs || 0, state.sv || 0);
    if (a <= 0)
        return;
    if (dir > 0) {
        state.money -= a;
        state.sv = (state.sv || 0) + a;
    }
    else {
        state.money += a;
        state.sv -= a;
    }
    // 預けた・引き出したら、スライダーは最初の位置（0）に戻す（v2.2.0〜）
    state.svs = 0;
    addLog('🏦 預金' + (dir > 0 ? 'に' + yen(a) + 'を預けました' : 'から' + yen(a) + 'を引き出しました'));
    render();
    save();
}

/** 融資を借りる */
function takeLoan() {
    if (state.phase !== 'closed' || state.over || state.loans.length >= 3)
        return;
    const a = state.ln.a, m = state.ln.m;
    if (a >= 1500000 && a > loanCap())
        return;
    if (m > 12 && a < 1500000)
        return;
    const p = Math.round(a * (1 + intr(m)) / m);
    state.money += a;
    state.loans.push({ left: m, pay: p });
    addLog('🏦 ' + yen(a) + 'を借りました。月' + yen(p) + '×' + m + 'ヶ月');
    render();
    save();
}

/** 開店する */
function openShop() {
    if (state.phase !== 'prep')
        return;
    state.phase = 'open';
    lastSale = '';
    state.t = 0;
    state.dOpen = true;
    addLog('開店！');
    state.paused = false;
    openEv();
    render();
    save();
}
