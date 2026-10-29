// ちいさなお店（ハード）を本物の計算のまま早回しで遊ぶボット。ページの中で動かす。
// 戦略：ふつうに上手なプレイヤー。予備のお金を残してから投資する。
window.SIM = function (opt) {
    opt = Object.assign({ days: 252, slotRule: 'margin', seed: 0 }, opt || {}, window.SIMOPT || {});
    render = () => {};
    const EV = [];
    const AE = addEvent;
    addEvent = (t, b) => { EV.push(state.day + ':' + t); return AE(t, b); };
    Storage.prototype.setItem = function () {};
    newGame('hard');
    state.paused = false;
    const T = tick;
    const months = [];
    let spent = 0, firstClerkFull = null, cashOk = null, ceiling = null;
    const fixed = () => tenantFee() + loanPay() + state.sal + wageDay() * MD;
    const restockCost = () => state.shelf.filter(Boolean).reduce((a, s) => a + state.cap * PRODUCTS[s.id].c, 0);
    let missWeek = [], noManual = 0;
    const pay = c => { spent += c; };
    for (let d = 0; d < opt.days && !state.over; d++) {
        nextDay();
        if (state.over)
            break;
        state.kama = 0;
        if (state.phase === 'open' && !state.dOpen)
            state.phase = 'prep';
        if (state.phase === 'prep') {
            fillAll();
            openShop();
            state.paused = false;
            let guard = 0;
            while (state.phase === 'open' && guard++ < 2000) {
                // 店員がいないうちは、店主が手で補充する（3割を切った棚を満タンに）
                if (state.clerk === 0 && state.t % 3 === 0)
                    state.shelf.forEach((s, i) => { if (s && s.st < state.cap * 0.3) restock(i, state.cap); });
                T();
            }
        }
        // 1週間（=1ヶ月）の欠品で「店員だけで回るか」を見る
        missWeek.push(state.dMiss);
        if (missWeek.length > 7)
            missWeek.shift();
        if (firstClerkFull === null && state.clerk > 0 && missWeek.length === 7 && missWeek.reduce((a, b) => a + b, 0) <= 3)
            firstClerkFull = state.day;
        if (state.phase !== 'closed')
            continue;
        // 休み：幸福度が40を切ったら翌日を店休日に
        state.hol = state.happy < 40;
        // 月末の直後：記録と、自分の月収の見直し
        if (state.day % MD === 0) {
            const s = state.prev || 0;
            months.push({ m: state.day / MD, sales: s, fixed: fixed(), tenant: tenantFee(), slots: state.slots, ad: state.ad, cap: state.cap, clerk: state.clerk, sk: state.sk || 0, money: Math.round(state.money), happy: Math.round(state.happy) });
            const gp = s * (state.margin / 100 - 0.0375 * state.pays.length) - (fixed() - state.sal);
            state.sal = Math.max(0, Math.min(330000, Math.floor(gp * 0.4 / 10000) * 10000));
        }
        // 手元が固定費1.5ヶ月分を切ったら、小口の融資（3万円・12ヶ月）でしのぐ
        if (state.money < Math.max(15000, fixed() * 1.5) && state.loans.length < 3) {
            state.ln = { a: 30000, m: 12 };
            const need = Math.max(15000, fixed() * 1.5) - state.money;
            state.ln.a = LA.filter(v => v < 1500000).find(v => v >= need) || 1000000;
            takeLoan();
        }
        // 投資：予備（固定費2ヶ月分＋全部の棚を満タンにする仕入れ代）を残して、優先度の高い順に
        const reserve = () => fixed() * (opt.rs || 3) + restockCost() * 2;
        const can = c => state.money - c > reserve();
        for (let k = 0; k < 20; k++) {
            let did = false;
            // 1) 棚があるのに並べる商品がないなら、新しい商品を扱う
            for (let id = 0; id < PRODUCTS.length; id++)
                if (!state.own.includes(id) && PRODUCTS[id].u && state.own.length < state.slots && can(PRODUCTS[id].u)) {
                    pay(PRODUCTS[id].u);
                    buy('new', id);
                    did = true;
                }
            // 2) 商品のアップグレード
            for (let id = 0; id < PRODUCTS.length; id++) {
                const L = state.up[id];
                if (L < 7 && state.sd[id] >= TH[L] && can(upCost(id, L))) {
                    pay(upCost(id, L));
                    upgrade(id);
                    did = true;
                }
            }
            // 3) 欠品が多ければ棚の容量
            const miss = missWeek.reduce((a, b) => a + b, 0);
            if (miss > 10 && state.cap < MAX.cap && can(cost.cap())) {
                pay(cost.cap());
                buy('cap');
                did = true;
            }
            // 4) 広告
            if (state.ad < MAX.ad && can(cost.ad())) {
                pay(cost.ad());
                buy('ad');
                did = true;
            }
            // 5) 店員（売上が給料の3倍を超えたら）とその能力
            const last = months.length ? months[months.length - 1].sales : 0;
            if (state.clerk < 3 && last * 0.4 > wageDay() / Math.max(1, state.clerk) * MD * (state.clerk + 1) * 3 + 1 && can(cost.clerk())) {
                pay(cost.clerk());
                buy('clerk');
                did = true;
            }
            if (state.clerk > 0 && (state.sk || 0) < MAX.skill && can(cost.skill())) {
                pay(cost.skill());
                buy('skill');
                did = true;
            }
            // 5.5) セキュリティ（Lv3まで上げて、ストックを切らさない）
            if ((state.sl || 0) < (opt.sec || 3) && can(cost.seclv())) {
                pay(cost.seclv());
                buy('seclv');
                did = true;
            }
            if ((state.sl || 0) > 0 && (state.ss || 0) < 2 && can(cost.secbuy())) {
                pay(cost.secbuy());
                buy('secbuy');
                did = true;
            }
            // 6) 棚：増える家賃より、増える粗利が見込めるときだけ（1棚あたりの今の粗利で見積もる）
            if (state.slots < MAX.slot && can(cost.slot())) {
                const dTen = tenantFee(state.slots + 1) - tenantFee();
                const perShelf = last * 0.4 / state.slots;
                if (opt.slotRule === 'always' || perShelf > dTen * 1.2) {
                    pay(cost.slot());
                    buy('slot');
                    did = true;
                }
            }
            if (!did)
                break;
        }
        // 2店舗目のお金の備え：2店舗分の固定費3ヶ月＋1店舗目と同じ設備（棚・容量・広告にかけた額）
        if (cashOk === null && months.length >= 3 && state.money >= fixed() * 2 * 3 + spent)
            cashOk = state.day;
    }
    // 天井：3ヶ月平均の伸びが月+3%（ハードのノルマの伸び）を下回りはじめた月
    for (let i = 6; i < months.length; i++) {
        const a = (months[i].sales + months[i - 1].sales + months[i - 2].sales) / 3, b = (months[i - 3].sales + months[i - 4].sales + months[i - 5].sales) / 3;
        if (b > 0 && a / b < Math.pow(1.03, 3) && months[i].ad >= MAX.ad - 2) {
            ceiling = months[i].m;
            break;
        }
    }
    return { ev: EV.slice(-6), money: Math.round(state.money), limit: LIMIT, over: state.over, overMsg: state.overMsg || '', day: state.day, months, firstClerkFull, cashOk, ceiling, spent };
};
