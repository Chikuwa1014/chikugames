/**
 * engine.js — 時間の進行（営業中の1秒、閉店、翌日）。
 */

/** 直近の販売（営業タブのログ欄の一番上に表示。開店時に空にする） */
let lastSale = '';

/** 閉店処理（盗難・月末・倒産判定） */
function endDay() {
    LIMIT = -Math.floor(quota() * difficulty().bank / 1000) * 1000;
    state.gu = false;
    if (state.dSold > 0 && Math.random() < 0.01 * difficulty().ev) {
        state.happy = clamp100(state.happy - 5);
        const s0 = state.ss || 0, L0 = guard(state.dRev), ac = (state.ss || 0) < s0;
        state.money -= L0;
        if (!ac)
            state.mSales = 0;
        addEvent('🦹 強盗被害！本日の売上金¥' + fmt(state.dRev) + 'を狙われ、被害¥' + fmt(L0) + (!ac ? '。ノルマゲージも0に' : ''));
    }
    if (state.clerk > 0 && state.dSold > 0 && Math.random() < 0.03 * difficulty().ev) {
        const k = 0.05 + Math.random() * 0.2, a = Math.round(state.dRev * k);
        state.money -= guard(a);
        state.clerk--;
        state.happy = clamp100(state.happy - 4);
        addEvent('🕵️ 従業員の窃盗！売上金の' + Math.round(k * 100) + '%（¥' + fmt(a) + '）が盗まれ、解雇しました');
    }
    state.happy = clamp100(state.happy + (state.dOpen ? hdl(1.5 - 0.5 * (state.closeH - state.openH - 6)) : (state.cleanDay ? 0 : rec(state.happy))));
    state.low = state.happy < 20 ? (state.low || 0) + 1 : 0;
    state.low5 = state.happy < 5 ? (state.low5 || 0) + 1 : 0;
    if (difficulty().sick && state.low5 >= 7 && !state.over) {
        state.over = true;
        state.overMsg = '幸福度5%未満が7日続き、店主は限界を迎えて店を続けられなくなりました。';
        addLog(state.overMsg);
    }
    if (state.money < LIMIT && !state.over) {
        state.over = true;
        addLog('資金が' + fmt(LIMIT) + '円を下回り、倒産しました。');
    }
    if (state.up[3] === 7 && state.shelf.some(s => s && s.id === 3) && state.dSold > 0 && Math.random() < 0.1) {
        const k = 0.05 + Math.random() * 0.2, a = Math.round(state.dRev * k);
        state.money -= guard(a);
        addEvent('🥷 ダイヤモンド万年筆を狙った泥棒が侵入！売上金の' + Math.round(k * 100) + '%（¥' + fmt(a) + '）が盗まれました' + (state.clerk > 0 ? '。店員が疑われました' : ''));
        if (state.clerk > 0) {
            let f = 1;
            for (let i = 1; i < state.clerk; i++)
                if (Math.random() < 0.3)
                    f++;
            state.clerk -= f;
            let m = '';
            if (Math.random() < 0.6) {
                const dr = 1 + Math.floor(Math.random() * 10);
                state.dn = Math.min((state.dn || 0) + dr, (state.sk || 0) + (difficulty().neg ? 10 : 0));
                m = '。不当解雇で士気が下がり、残った店員の能力が' + dr + 'Lv低下';
            }
            addEvent('😢 誤解されたまま店員' + f + '名が解雇されました' + m);
        }
    }
    if (state.money < 0 && state.shelf.every(s => !s || s.st <= 0) && !state.over) {
        state.over = true;
        state.overMsg = '商品が尽き、資金もマイナス。もうダメだ…';
        addLog(state.overMsg);
    }
    if (!state.dOpen && (state.dn || 0) > 0)
        state.dn--;
    state.next = roll(state.day + 1);
    {
        const sn = seaOf(state.day + 1), pe = b => Math.min(0.5, b * difficulty().ev), fa = p => Math.random() < 0.25 * p / (1 - p);
        state.pre = { snow: false, typ: false };
        state.warn = { snow: false, typ: false };
        state.prep = { typ: false, snow: false };
        if (sn === 3 && state.next >= 1) {
            const p = pe(0.1), h = Math.random() < p;
            state.pre.snow = h;
            state.warn.snow = h || fa(p);
        }
        if ((sn === 1 || sn === 2) && (state.next === 1 || state.next === 2)) {
            const p = pe(0.05), h = Math.random() < p;
            state.pre.typ = h;
            state.warn.typ = h || fa(p);
        }
    }
    if (state.day > 0 && state.day % MD === 0) {
        const f = tenantFee(), q = quota(), ok = state.mSales >= q, cf = Math.round(state.mSales * 0.0375 * state.pays.length), lp = loanPay();
        const wg = Math.round(state.mWage || 0);
        state.money -= f + cf + lp + state.sal + wg;
        state.mWage = 0;
        state.prev = state.mSales;
        (state.msl = state.msl || []).push(state.mSales);
        state.happy = clamp100(state.happy + (difficulty().sal ? (state.sal - 330000) / 330000 * 8 : 0) + (ok ? 3 : -3));
        state.loans.forEach(l => l.left--);
        state.loans = state.loans.filter(l => l.left > 0);
        state.rep = '月末: テナント料¥' + fmt(f) + (cf ? '・決済手数料¥' + fmt(cf) : '') + (lp ? '・融資返済¥' + fmt(lp) : '') + (state.sal ? '・自分の給料¥' + fmt(state.sal) : '') + (wg ? '・店員の給料¥' + fmt(wg) : '') + 'を支払い。売上¥' + fmt(state.mSales) + ' / ノルマ¥' + fmt(q) + ' → ' + (ok ? '達成' : '未達');
        addLog(state.rep);
        state.mSales = 0;
        if (state.money < 0 && (state.sv || 0) > 0) {
            const w = Math.min(state.sv, Math.ceil(-state.money));
            state.money += w;
            state.sv -= w;
            addLog('🏦 預金から¥' + fmt(w) + 'を自動で引き出しました。');
        }
        if (state.day % (MD * 3) === 0) {
            if (!state.slotQ && state.slots < MAX.slot) {
                const c = cost.slot();
                state.money -= c;
                addSlot();
                addEvent('🏗️ 3ヶ月ごとの投資チェック：棚を強制的に増設（¥' + fmt(c) + '）。テナント料は月¥' + fmt(tenantFee()) + 'に');
            }
            else if (state.slotQ)
                addLog('投資チェック：期間中に棚を増やしたのでスキップ');
            state.slotQ = 0;
        }
        if (state.money < LIMIT) {
            state.over = true;
            addLog('資金が' + fmt(LIMIT) + '円を下回り、倒産しました。');
        }
    }
    state.phase = 'closed';
}

/** 翌日へ（イベント・病気・休業の判定） */
function nextDay() {
    if (state.phase !== 'closed' || state.over)
        return;
    state.day++;
    state.weather = state.next;
    state.t = 0;
    state.dRev = state.dSold = state.dMiss = 0;
    state.evs = [];
    if (state.boom > 0)
        state.boom--;
    if (state.fem > 0)
        state.fem--;
    if (state.rb > 0)
        state.rb--;
    if (state.flame > 0)
        state.flame--;
    let snow = rollEvents();
    state.pre = null;
    state.dOpen = false;
    state.dWage = 0;
    state.dM = state.dF = 0;
    state.cleanDay = false;
    if ((state.ss || 0) > 0 && state.day >= (state.sb || 0)) {
        state.ss = 0;
        addEvent('🛡 セキュリティが破損し、ストックが0になりました');
    }
    if (state.clean > 0) {
        state.clean--;
        state.cleanDay = true;
        snow = true;
        state.hol = false;
        addEvent('🧹 店の清掃のため休業中（あと' + state.clean + '日）');
    }
    if (state.dep > 0) {
        state.dep--;
        if (state.dep === 0) {
            state.happy = 50;
            state.low = 0;
            state.low5 = 0;
            addEvent('💪 うつ病の休養を終えて復帰しました（幸福度50%）');
        }
    }
    else if (difficulty().sick && (state.low || 0) >= 14) {
        state.dep = 14;
        state.sick = 0;
        state.low = 0;
        addEvent('😔 幸福度の低迷が続き、うつ病になりました。2ヶ月（14日）の休養が必要です' + (state.clerk > 0 ? '（店員が営業を続けます）' : ''));
    }
    if (state.sick > 0) {
        state.sick--;
        if (state.sick === 0) {
            state.happy = Math.max(state.happy, 25);
            addEvent('💪 病気から復帰しました（幸福度' + Math.floor(state.happy) + '%）');
        }
    }
    else if (state.dep <= 0 && difficulty().sick && Math.random() < sickP(state.happy)) {
        state.sick = 7;
        addEvent('🤒 病気になりました。7日間' + (state.clerk > 0 ? 'は店員が営業します（給料150%）' : '休業します'));
    }
    if ((state.sick > 0 || state.dep > 0) && state.clerk === 0) {
        snow = true;
        state.hol = false;
    }
    if (snow) {
        state.kama = 0;
        endDay();
    }
    else if (state.kama) {
        state.hol = false;
        state.phase = 'open';
        state.t = 0;
        state.paused = false;
        lastSale = '';
        addLog('⛄ かまくらを作っています…（12:00から甘酒ボーナス）');
        if (state.openH >= 12)
            amaStart();
    }
    else if (state.hol) {
        state.hol = false;
        state.gauge = Math.min(99, state.gauge + 8);
        addLog('店休日。お客さんが開店を待ちわびています（購買欲+8）。');
        endDay();
    }
    else {
        state.phase = 'prep';
        addLog('開店準備。商品を補充しましょう。');
    }
    render();
    save();
}

/** 営業中の1秒ごとの処理（客の来店・販売） */
function tick() {
    if (state.phase !== 'open' || state.paused)
        return;
    if (state.kama) {
        kamaTick();
        return;
    }
    state.t++;
    const pw = pwr(state.day), sh = state.shelf.filter(Boolean);
    if (state.boost > 0) {
        state.boost--;
        state.gauge = 100;
        if (state.boost === 0) {
            state.gauge = 50;
            addLog('ブースト終了。');
        }
    }
    else
        state.gauge = Math.max(0, state.gauge + (pw - 1) * 4 - 0.6);
    const rate = (0.35 + 0.18 * state.ad + 0.08 * sh.length) * pw * (0.8 + state.gauge / 250) * (state.boost > 0 ? 2 : 1) * demandFactor() * Math.pow(1.2, state.pays.length) * difficulty().cust;
    const cnt = x => Math.floor(x) + (Math.random() < x % 1 ? 1 : 0), gs = [];
    for (let i = cnt(rate / 2); i > 0; i--)
        gs.push(0);
    for (let i = cnt(rate / 2 * (state.fem > 0 ? 5 : 1)); i > 0; i--)
        gs.push(1);
    let bc = 0, sy = 0;
    const sl = {};
    for (const g of gs) {
        if (g)
            state.dF = (state.dF || 0) + 1;
        else
            state.dM = (state.dM || 0) + 1;
        const wt = sh.map(t => Math.pow(80 / PRODUCTS[t.id].c, 0.6) * gf(t.id, g) * (state.rb > 0 && t.id === 0 ? 1.8 : 1));
        let x = Math.random() * wt.reduce((a, b) => a + b, 0), s = sh[sh.length - 1];
        for (let i = 0; i < sh.length; i++) {
            if ((x -= wt[i]) < 0) {
                s = sh[i];
                break;
            }
        }
        if (!s || s.st <= 0) {
            state.miss++;
            state.dMiss++;
            if (state.boost === 0)
                state.gauge = Math.max(0, state.gauge - 3);
            continue;
        }
        const p = PRODUCTS[s.id], pp = priceOf(p), q = Math.min(s.st, Math.round((1 + (Math.random() < 0.25 + 0.05 * state.ad ? 1 : 0) + (state.boom > 0 && Math.random() < 0.5 ? 1 : 0)) * (state.rb > 0 && s.id === 0 ? 1.8 : 1)));
        s.st -= q;
        state.sd[s.id] += q;
        bc++;
        state.money += q * pp;
        state.mSales += q * pp;
        state.tot = (state.tot || 0) + q * pp;
        state.dRev += q * pp;
        state.dSold += q;
        state.sold += q;
        sl[s.id] = (sl[s.id] || 0) + q;
        sy += q * pp;
        if (state.boost === 0)
            state.gauge = Math.min(100, state.gauge + 2);
        if (q * pp >= 1000)
            addLog(p.e + ' ' + p.n + 'が売れました +¥' + fmt(q * pp));
    }
    if (bc)
        lastSale = Object.keys(sl).map(i => PRODUCTS[i].e + PRODUCTS[i].n + '×' + sl[i]).join('・') + ' +¥' + fmt(sy);
    pxArrive(gs, bc);
    if (state.flame > 0)
        state.gauge = Math.min(state.gauge, 4);
    if (state.boost === 0 && state.gauge >= 100) {
        state.boost = 10;
        addLog('🔥 購買欲MAX！10秒間、来店数2倍');
    }
    for (let k = 0; k < state.clerk; k++) {
        const c = state.shelf.filter(s => s && s.st < state.cap && state.money >= PRODUCTS[s.id].c);
        if (!c.length)
            break;
        const b = c[Math.floor(Math.random() * c.length)], q = Math.min(clAmt(), state.cap - b.st, Math.floor(state.money / PRODUCTS[b.id].c));
        b.st += q;
        state.money -= q * PRODUCTS[b.id].c;
    }
    if (state.clerk > 0 && eff() < 0)
        for (let k = 0; k < state.clerk; k++) {
            const c = state.shelf.filter(s => s && s.st > 0);
            if (!c.length)
                break;
            const b = c[Math.floor(Math.random() * c.length)];
            b.st = Math.max(0, b.st - Math.ceil(b.st * 0.01 * -eff()));
        }
    if (state.clerk > 0) {
        const h = state.openH + Math.floor((state.t - 1) / 5), w = WAGE * (h < 7 || h >= 22 ? 1.25 : 1) * state.clerk / 5 * (state.sick > 0 || state.dep > 0 ? 1.5 : 1);
        state.mWage = (state.mWage || 0) + w;
        state.dWage += w;
    }
    if (state.t >= dayTicks()) {
        addLog('閉店。本日の売上 ¥' + fmt(state.dRev) + (state.dWage ? ' / 給料 ¥' + fmt(state.dWage) : ''));
        endDay();
    }
    render();
    save();
}
