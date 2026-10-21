/**
 * events.js — イベント（盗難・セキュリティ・最終段階の商品イベントなど）。
 */

/** イベントで商品を直接売る */
function sellUnit(s, q, m) {
    const a = Math.round(priceOf(PRODUCTS[s.id]) * m) * q;
    s.st -= q;
    state.sd[s.id] += q;
    state.money += a;
    state.mSales += a;
    state.tot = (state.tot || 0) + a;
    state.dRev += a;
    state.dSold += q;
    state.sold += q;
    return a;
}

/** 開店時のイベント（超セレブ・パパ活） */
function openEv() {
    const on = id => state.up[id] === 7 && state.shelf.some(s => s && s.id === id), sh = state.shelf.filter(Boolean);
    if (on(5) && Math.random() < 0.05) {
        let t = 0;
        sh.forEach(s => {
            if (s.st > 0)
                t += sellUnit(s, s.st, 1.15);
        });
        addEvent('💎 超セレブが来店！全商品を+15%の価格で買い占め（+¥' + fmt(t) + '）');
    }
    if (on(9) && Math.random() < 0.15) {
        const top = sh.filter(s => s.st > 0).sort((a, b) => PRODUCTS[b.id].c - PRODUCTS[a.id].c).slice(0, 3);
        let t = 0;
        for (let i = 0; i < 3; i++) {
            const c = top.filter(s => s.st > 0);
            if (!c.length)
                break;
            t += sellUnit(c[Math.floor(Math.random() * c.length)], 1, 1);
        }
        if (t)
            addEvent('💸 パパ活カップルが来店。高額商品を3つ購入（+¥' + fmt(t) + '）');
    }
}

/** 最終段階の商品によるイベント抽選 */
function rollProd() {
    const R = Math.random, on = id => state.up[id] === 7 && state.shelf.some(s => s && s.id === id);
    if (on(0) && R() < 0.02) {
        resetInv(1);
        addEvent('💣 熱ばくだんおにぎりが爆発！棚が1つだけ残り、投資がすべてリセットされました');
    }
    if (on(1) && R() < 0.02) {
        state.happy = clamp100(state.happy - 25);
        addEvent('🀄 黒烏龍茶がツモでアガった…！（幸福度-25%）');
    }
    if ((on(2) && R() < 0.18) || (on(4) && R() < 0.15)) {
        state.fem = 3;
        addEvent('🍌 皮が剥けた！女性客が5倍に（3日間）');
    }
    if (on(6) && R() < 0.05) {
        const f = 0.75 + R() * 1.2;
        state.cm[6] = Math.min(5, Math.max(0.5, state.cm[6] * f));
        applyUp();
        addEvent('📈 アップレの原価が' + (f >= 1 ? '+' : '') + Math.round((f - 1) * 100) + '%変動しました');
    }
    if (on(7) && R() < 0.25) {
        state.rb = 3;
        addEvent('🍙 おにぎりブーム到来！おにぎりの購入客とまとめ買いが80%増（3日間）');
    }
    if (on(8) && R() < 0.05) {
        state.up[4] = 0;
        applyUp();
        addEvent('👩‍🏫 教育ママが来店。雑誌のアップグレードがリセットされました');
    }
    if (on(10) && R() < 0.05) {
        state.flame = 14;
        state.boost = 0;
        state.gauge = Math.min(state.gauge, 4);
        addEvent('📱 無断撮影（盗撮）トラブルがSNSで炎上。2ヶ月間、購買欲が5以上になりません');
    }
    if (on(11) && R() < 0.05) {
        let n = 0;
        for (let i = 0; i < 6; i++) {
            if (lose())
                n++;
            state.money -= 10000;
            state.happy = clamp100(state.happy - 5);
        }
        addEvent('🛴💥 店前で大事故！6台の車が店に突っ込み、棚' + n + '台を失い修繕費¥60,000');
    }
}

/** セキュリティで盗難被害を軽減（1日1ストック消費） */
function guard(a) {
    const L = state.sl || 0;
    if (L < 1 || a <= 0)
        return a;
    if (!state.gu) {
        if ((state.ss || 0) < 1)
            return a;
        state.ss--;
        state.gu = true;
        if (L === 10) {
            state.clean = 7;
            state.gm = 1;
        }
    }
    let r = L === 1 ? 5000 : L === 2 ? 10000 : L === 3 ? 100000 : L === 4 ? Math.max(a * 0.1, 100000) : L === 5 ? Math.max(a * 0.5, 100000) : L === 6 ? Math.max(a * 0.8, 100000) : a;
    r = Math.min(a, Math.round(r));
    addEvent('🛡 ' + SECN[L - 1] + 'が盗難被害を¥' + fmt(r) + '軽減（残りストック' + state.ss + '）');
    if (L === 10 && state.gm) {
        state.gm = 0;
        addEvent('🧹 侵入者が撃退されました。店の清掃のため、1ヶ月休業します');
    }
    return a - r;
}

/** イベントを記録してログに出す */
function addEvent(t) {
    state.evs.push(t);
    addLog(t);
}

/** 棚を1つ失う */
function lose() {
    if (state.slots > 1 && state.day > MD) {
        state.shelf.splice(Math.floor(Math.random() * state.shelf.length), 1);
        state.slots--;
        return true;
    }
    return false;
}

/** 日の始まりのイベント抽選 */
function rollEvents() {
    const R = Math.random, r = () => {
        const x = R();
        return x < 0.5 ? x / difficulty().ev : 9;
    }, se = seaOf(state.day);
    let snow = false;
    if (state.day > 1 && state.day % MD === 1 && r() < 0.05) {
        const f = Math.round((0.9 + R() * 0.8) * 100) / 100;
        state.feeMul = Math.round(state.feeMul * f * 100) / 100;
        addEvent('📢 テナント料の改定：' + (f >= 1 ? '+' : '') + Math.round((f - 1) * 100) + '%（月¥' + fmt(tenantFee()) + 'に）');
    }
    if (r() < 0.0001) {
        resetInv(2);
        state.happy = clamp100(state.happy - 20);
        addEvent('🌋 大地震！投資がすべてリセットされました');
    }
    if (r() < 0.01) {
        const lost = lose();
        state.money -= 10000;
        state.happy = clamp100(state.happy - 5);
        addEvent('🚗 車が店に突っ込みました。' + (lost ? '棚が減り、' : '') + '修繕費¥10,000');
    }
    if ((se === 1 || se === 2) && (state.pre ? state.pre.typ : r() < 0.05)) {
        lose();
        state.happy = clamp100(state.happy - 5);
        state.shelf.forEach(s => {
            if (s)
                s.st = 0;
        });
        addEvent('🌀 台風で浸水。棚が減り、在庫がすべて0に');
    }
    if (se === 3 && (state.pre ? state.pre.snow : r() < 0.1)) {
        snow = true;
        state.hol = false;
        state.weather = 3;
        addEvent('❄️ 大雪で交通マヒ。強制休業（購買力0）');
    }
    if (r() < 0.05) {
        state.boom = 3;
        addEvent(['🌸 お花見ブーム', '🏖️ 夏休みブーム', '🍂 行楽シーズンのブーム', '🎄 クリスマス・年末ブーム'][se] + '！まとめ買いが増えます（3日間）');
    }
    if (state.pays.length < 3 && r() < 0.02) {
        const n = ['クレジットカード', '交通系IC', 'バーコード決済'][state.pays.length];
        state.pays.push(n);
        addEvent('💳 ' + n + 'に対応！客足×1.2（月末に手数料）');
    }
    rollProd();
    return snow;
}
