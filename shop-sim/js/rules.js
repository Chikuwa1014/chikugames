/**
 * rules.js — ゲームのルール計算（購買力・費用・ノルマなど。状態は変えない純粋な計算が中心）。
 */

/** 購買力＝季節×天気（×炎上） */
const pwr = d => SEA[seaOf(d)].p * WE[d === state.day ? state.weather : state.next].p * (state.flame > 0 ? difficulty().fl : 1);

/** 月のテナント料（棚数で指数的に増加） */
const tenantFee = (n = state.slots) => r100(4000 * Math.pow(1.6, n - 2) * state.feeMul * difficulty().fee);

/** 現在の売値（原価÷(1-粗利率)） */
const priceOf = p => Math.max(p.c + 1, Math.round(p.c / (1 - state.margin / 100)));

/** 粗利率が高いほど来店数が減る補正 */
const demandFactor = () => Math.min(1.6, Math.max(0.5, 1 - (state.margin - 40) * 0.015));

/** 融資の月々の返済額の合計 */
const loanPay = () => state.loans.reduce((a, l) => a + l.pay, 0);

/** 1日の営業ティック数 */
const dayTicks = () => (state.closeH - state.openH) * 5;

/** 店員の1日あたり給料（基準） */
const wageDay = () => {
    let w = 0;
    for (let h = state.openH; h < state.closeH; h++)
       w += WAGE * (h < 7 || h >= 22 ? 1.25 : 1);
    return w * state.clerk;
};

/** 今月の売上ノルマ（損益分岐点＋前月比） */
function quota() {
    const b = (tenantFee() + loanPay() + state.sal + wageDay() * MD) / Math.max(0.05, state.margin / 100 - 0.0375 * state.pays.length);
    return r100(state.prev == null ? b : Math.max(b, state.prev * difficulty().gr));
}

/** 投資の費用 */
const cost = {
    slot: () => r100(1500 * Math.pow(1.7, state.slots - 2)),
    cap: () => r100(600 * Math.pow(1.6, Math.max(0, CAPS.indexOf(state.cap)))),
    ad: () => r100(800 * Math.pow(1.5, state.ad)),
    clerk: () => r100(4000 * Math.pow(1.5, state.clerk)),
    skill: () => r100(5000 * Math.pow(2.5, state.sk || 0) * Math.max(1, state.clerk)),
    seclv: () => PRL[state.sl || 0] * 3,
    secbuy: () => PR[Math.max(0, (state.sl || 1) - 1)]
};

/** 投資の上限レベル */
const MAX = {
    slot: 12,
    cap: 5000,
    ad: 20,
    clerk: 12,
    skill: 10,
    seclv: 10,
    secbuy: 5 
};

/** 休業日の幸福度の回復量 */
const rec = h => h >= 80 ? 20 : h >= 50 ? 18 : h >= 35 ? 10 : h >= 15 ? 5 : h >= 5 ? 2 : 1;

/** 幸福度に応じた病気の確率 */
const sickP = h => h >= 80 ? 0 : h >= 50 ? 0.05 : h >= 35 ? 0.1 : h >= 15 ? 0.15 : h >= 5 ? 0.25 : 0.45;

/** 商品アップグレードの費用 */
const upCost = (id, L) => r100(PRODUCTS[id].b * 15 * Math.pow(1.8, L));

/** 客の性別による商品の買いやすさ */
const gf = (id, g) => (id === 6 || id === 9) ? (g ? 0.5 : 2.5) : (id === 5 || id === 7) ? (g ? 2.5 : 0.5) : 1;

/** アップグレードと原価変動を商品へ反映 */
function applyUp() {
    PRODUCTS.forEach((p, i) => {
        const L = state.up[i] || 0;
        p.c = Math.round(p.b * (1 + 0.4 * L) * (state.cm ? state.cm[i] : 1));
        p.n = L > 0 ? NM[i][L - 1] : p.n0;
    });
}

/** 投資のリセット（地震・爆発） */
function resetInv(n) {
    state.slots = n;
    state.cap = 10;
    state.ad = 0;
    state.clerk = 0;
    state.sk = 0;
    state.dn = 0;
    state.sl = 0;
    state.ss = 0;
    state.own = n > 1 ? [0, 1] : [0];
    state.shelf = n > 1 ? [{ id: 0, st: 0 }, { id: 1, st: 0 }] : [{ id: 0, st: 0 }];
    state.up = PRODUCTS.map(() => 0);
    applyUp();
}

/** 月平均売上 */
const avgSales = () => {
    const a = state.msl || [];
    return a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0;
};

/** 大口融資の上限（月平均売上×10） */
const loanCap = () => Math.floor(avgSales() * 10);

/** 現在の難易度の設定を返す */
const difficulty = () => DF[state.diff] || DF.hard;

/** 長時間営業の幸福度低下に難易度補正をかける */
const hdl = d => d < 0 ? d * difficulty().hd : d;

/** 融資の利子率 */
const intr = m => (state.diff === 'inferno' ? 0.25 : 0.15) * (1 + Math.max(0, m - 12) / 48);

/** 難易度を時給へ反映 */
function applyDiff() {
    WAGE = Math.round(BASEW * difficulty().wage);
}

/** 店員の実効レベル */
const eff = () => Math.max(difficulty().neg ? -10 : 0, (state.sk || 0) - (state.dn || 0) + (state.mbDay && state.day === state.mbDay ? 1 : 0));

/** 店員の1回の補充量 */
const clAmt = () => {
    const e = eff();
    return e >= 10 ? 1e9 : e < 0 ? 0 : 5 * Math.pow(2, e);
};

/** 病気またはうつ病で休養中か */
function ill() {
    return state.sick > 0 || state.dep > 0;
}

/** いま投資できない理由（できるときは空文字）。投資タブの表示とデバッグログで使う */
function investBlock() {
    if (state.over)
        return '倒産しているため投資できません。';
    if (!state.diff)
        return '難易度を選ぶと投資できるようになります。';
    if (state.dep > 0)
        return '😔 うつ病の休養中のため投資できません（あと' + state.dep + '日）。' + (state.clerk > 0 ? '店員が営業を続けています。' : '');
    if (state.sick > 0)
        return '🤒 病気の休養中のため投資できません（あと' + state.sick + '日）。' + (state.clerk > 0 ? '店員が営業を続けています。' : '');
    if (state.phase === 'prep')
        return '開店準備中です。投資は閉店後にできます。';
    if (state.phase === 'open')
        return (state.kama ? '⛄ かまくらの日です。' : '営業中です。') + '投資は閉店後にできます。';
    if (state.phase !== 'closed')
        return '投資できない状態です（' + state.phase + '）。';
    return '';
}
