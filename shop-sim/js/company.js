/**
 * company.js — 店長・会社・複数のお店（v2.1.0〜）。
 * 1号店が「天井」（棚10台・広告Lv18・店員1人以上）に来て、2店舗分の固定費3ヶ月＋出店費のお金があると、
 * 投資タブに「店長を雇ってオーナーになる」が出る。雇うと会社タブが出て、会社を設立できる。
 *
 * 店の持ち方：いま店主がいる店は、今までどおり state の中（STK のキー）。ほかの店は state.stores[i] に同じキーで入っている。
 * 店を切り替えると、state の店のキーを stores[cur] へしまい、行き先の店のキーを state へ出す（coSwitch）。
 * 店主がいない店は、閉店のたびに簡単な計算で1日分を進める（coBgDay。店長か店員がいれば営業）。
 * お金（所持金）・日付・天気と予報・幸福度・病気・融資・預金・自分の月収は会社（店主）でひとつ。
 */

/** 店ごとに持つ状態のキー（切り替えのとき、出し入れする） */
const STK = ['sname', 'loc', 'mgr', 'qual', 'slots', 'cap', 'ad', 'clerk', 'own', 'shelf', 'sold', 'miss', 'gauge', 'boost', 'mSales', 'tot', 'margin', 'feeMul', 'up', 'sd', 'cm', 'fem', 'rb', 'flame', 'sk', 'dn', 'sl', 'ss', 'sb', 'clean', 'prev', 'msl', 'mWage', 'pays', 'boom', 'mbDay', 'openH', 'closeH', 'bad', 'dRev', 'dSold', 'dMiss', 'dWage', 'gm', 'gu', 'slotQ', 'dM', 'dF', 'cleanDay', 'log'];

/** 店長の採用費と月給 */
const MGR_HIRE = 500000, MGR_SAL = 300000;

/** 会社の設立費用 */
const CO_FEE = 250000;

/** お店の数の上限 */
const MAX_STORES = 10;

/**
 * 出店場所。cust：来店数・crime：強盗と窃盗の起きやすさ・fee：テナント料・dis：災害（車・台風・大雪・地震）の起きやすさ・
 * cost：出店費・pref：商品ごとの売れやすさ（無いときは同じ）・indoor：屋内（雨や雪が降らない・車が走らない）・kind：扱う品
 */
const LOCS = {
    suburb: { n: '郊外', e: '🏡', d: '治安ふつう・まんべんなく売れる・テナント料が安い', cust: 1, crime: 1, fee: 0.8, dis: 1, cost: 3000000 },
    downtown: { n: '繁華街', e: '🌃', d: '治安は悪いが来店数が多い・テナント料ふつう', cust: 1.45, crime: 2.2, fee: 1, dis: 1, cost: 5000000 },
    uptown: { n: '高級住宅街', e: '🏰', d: '治安がよい・高級な品が売れる・テナント料が高い', cust: 0.9, crime: 0.5, fee: 1.6, dis: 1, cost: 8000000, pref: id => id >= 5 ? 2.5 : id <= 2 ? 0.6 : 1 },
    dept: { n: 'デパート', e: '🏬', d: '治安最高・まんべんなく売れる・テナント料が高い・災害の被害なし', cust: 1.15, crime: 0.15, fee: 1.8, dis: 0, cost: 12000000, indoor: 1 },
    station: { n: '駅ナカ', e: '🚉', d: '治安ふつう・飲食物と雑誌が売れやすい・テナント料ふつう・災害の被害が少し多い', cust: 1.25, crime: 1, fee: 1.1, dis: 1.3, cost: 6000000, indoor: 1, pref: id => [0, 1, 2, 4].includes(id) ? 2 : 1 },
    shisha: { n: 'シーシャ屋', e: '💨', d: '治安ふつう・フレーバーを売る・テナント料ふつう・災害ふつう（ほかの出店場所すべてに出すと解放）', cust: 1, crime: 1, fee: 1, dis: 1, cost: 5000000, kind: 'shisha' }
};

/** シーシャ屋のフレーバー（商品0〜6の代わりに並ぶ。c＝原価） */
const FLAV = [
    { n: 'Wアップル', e: '🍏', c: 900, u: 0 },
    { n: 'レモン', e: '🍋', c: 1000, u: 0 },
    { n: 'ミント', e: '🌿', c: 1100, u: 0 },
    { n: 'オレンジ', e: '🍊', c: 1250, u: 0 },
    { n: 'カルダモン', e: '🌰', c: 1400, u: 0 },
    { n: 'コーラ', e: '🥤', c: 1600, u: 0 },
    { n: 'ライチ', e: '🍈', c: 1900, u: 0 }
];

/** フレーバーのアップグレード名（7段階） */
const FLUP = ['ミックス', 'クール', 'ダブル', 'プレミアム', 'ハーブ配合', 'スペシャル', '極'];

/**
 * 会社の方針（取引先からの収入の入り方）。p＝毎日その取引が来る確率（0＝毎月末に必ず）、r＝1回の額（資本金に対する割合）。
 * どれも、ならすと月に資本金の2%前後（取引先の業種・景気で増減）
 */
const POLS = [
    { k: 'steady', n: '安定経営', d: '定期的なビジネスで小さい額（毎月末）', p: 0, r: 0.02, t: '定期契約' },
    { k: 'spot', n: '攻めの営業', d: '頻度まちまちで大きい額', p: 0.12, r: 0.025, t: 'スポット取引' },
    { k: 'big', n: '大口狙い', d: '頻度は少ないが、とても大きい額', p: 0.02, r: 0.15, t: '大型案件' },
    { k: 'daily', n: '地域密着', d: 'ほぼ毎日だが小さい額', p: 0.85, r: 0.0032, t: '日々の取引' }
];

/** 取引先の業種（資本金と店舗数で解放。m＝取引額の倍率） */
const PARTNERS = [
    { n: '近所の商店', cap: 0, st: 1, m: 0.6 },
    { n: '飲食店', cap: 10000000, st: 3, m: 1 },
    { n: '小売店', cap: 50000000, st: 5, m: 1.3 },
    { n: '製造業', cap: 80000000, st: 8, m: 1.6 },
    { n: '金融業', cap: 100000000, st: 10, m: 2 }
];

/** 資本金の段階。st＝必要な店舗数、s＝必要な全店の月の売上（直近3ヶ月の平均） */
const CAPT = [
    { v: 1000000, st: 1, s: 0 },
    { v: 3000000, st: 1, s: 0 },
    { v: 5000000, st: 1, s: 0 },
    { v: 10000000, st: 3, s: 5000000 },
    { v: 30000000, st: 3, s: 15000000 },
    { v: 50000000, st: 5, s: 25000000 },
    { v: 80000000, st: 8, s: 40000000 },
    { v: 100000000, st: 10, s: 50000000 }
];

/**
 * 景気の元にする株価（日経平均のおおよその年末終値、1985〜2024年。記憶からの概算で、正確な値ではない）。
 * 1年を12ヶ月に直線でつなぎ、ゲームの1ヶ月に1つずつ進む。会社を設立した月に、どこから始めるかを抽選する
 */
const NK = [13113, 18701, 21564, 30159, 38916, 23849, 22984, 16925, 17417, 19723, 19868, 19361, 15259, 13842, 18934, 13786, 10543, 8579, 10677, 11489, 16111, 17226, 15308, 8860, 10546, 10229, 8455, 10395, 16291, 17451, 19034, 19114, 22765, 20015, 23657, 27444, 28792, 26095, 33464, 39895];

/** 株価の月ごとの値（k＝月の番号。少しだけ揺らす） */
const nkAt = k => {
    const n = (NK.length - 1) * 12;
    k = ((k % n) + n) % n;
    const y = Math.floor(k / 12), f = (k % 12) / 12, a = NK[y], b = NK[y + 1];
    return a * Math.pow(b / a, f) * (1 + 0.025 * Math.sin(k * 2.3));
};

/** 景気の倍率（会社を設立したあとだけ。株価が2年平均より高いほど客が増える。0.75〜1.25） */
const econ = () => {
    const c = state.co;
    if (!c || !c.est)
        return 1;
    let s = 0;
    for (let i = 0; i < 24; i++)
        s += nkAt(c.ek - i);
    return Math.max(0.75, Math.min(1.25, 1 + (nkAt(c.ek) / (s / 24) - 1) * 0.7));
};

/** 景気のことば */
const econName = v => v >= 1.08 ? '📈 好景気' : v <= 0.92 ? '📉 不景気' : '➡️ ふつう';

/** いまの店の出店場所 */
const locOf = (s = state) => LOCS[s.loc] || LOCS.suburb;

/** 出店場所の倍率（来店数には景気もかける） */
const locF = k => locOf()[k];
const coCust = () => locF('cust') * econ();

/** 商品の売れやすさ（出店場所） */
const locPref = id => {
    const f = locOf().pref;
    return f ? f(id) : 1;
};

/** シーシャ屋か */
const isShisha = (s = state) => locOf(s).kind === 'shisha';

/** 扱える商品の数（シーシャ屋はフレーバー7種） */
const kindN = () => isShisha() ? FLAV.length : PRODUCTS.length;

/** アップグレード後の名前（L＝1〜7） */
const upName = (i, L) => isShisha() && i < FLAV.length ? FLAV[i].n + '・' + FLUP[L - 1] : NM[i][L - 1];

/** 元の商品の定義（シーシャ屋から戻すときに使う） */
let PDEF = null;

/** いまの店の扱う品を PRODUCTS に反映する（シーシャ屋はフレーバー） */
function applyKind() {
    if (!PDEF)
        PDEF = PRODUCTS.map(p => ({ n0: p.n0 || p.n, e: p.e, b: p.b || p.c, p: p.p, u: p.u }));
    PRODUCTS.forEach((p, i) => {
        const d = isShisha() && i < FLAV.length ? { n0: FLAV[i].n, e: FLAV[i].e, b: FLAV[i].c, p: Math.round(FLAV[i].c * 1.7), u: FLAV[i].u } : PDEF[i];
        Object.assign(p, d);
    });
    applyUp();
}

/** 店長の月給（いまの店） */
const mgrPay = () => state.mgr ? MGR_SAL : 0;

/** いまの店の月の固定費（テナント料・返済・自分の月収・店員の給料・店長の月給） */
const fixedNow = () => tenantFee() + loanPay() + state.sal + wageDay() * MD + mgrPay();

/** いまの店が「天井」に来ているか（棚10台以上・広告Lv18以上・店員1人以上） */
const atCeil = (s = state) => s.slots >= 10 && s.ad >= 18 && s.clerk >= 1;

/** 店長を雇うのに必要なお金（2店舗分の固定費3ヶ月＋いちばん安い出店費＋採用費） */
const mgrNeed = () => fixedNow() * 2 * 3 + LOCS.suburb.cost + MGR_HIRE;

/** 投資タブに「店長を雇う」を出すか（まとめの3つの条件：天井・店員・お金） */
const mgrShow = () => !state.co && atCeil() && state.money >= mgrNeed();

/** 全部の店（いまの店は state そのもの） */
const allStores = () => (state.stores || [state]).map((s, i) => i === (state.cur || 0) ? state : s);

/** 出店枠（天井に来た店の数 − すでに出した店の数） */
const storeSlots = () => {
    const A = allStores();
    return Math.max(0, Math.min(MAX_STORES - A.length, A.filter(s => s.qual).length - (A.length - 1)));
};

/** 全店の月の売上（直近3ヶ月の平均） */
const coAvg = () => {
    const h = (state.co && state.co.hist) || [];
    const a = h.slice(-3);
    return a.length ? a.reduce((p, q) => p + q.s, 0) / a.length : 0;
};

/** いまの取引先（資本金と店舗数で決まる、いちばん上の業種） */
const partner = () => {
    const c = state.co, n = allStores().length;
    let P = PARTNERS[0];
    PARTNERS.forEach(p => {
        if (c && c.cap >= p.cap && n >= p.st)
            P = p;
    });
    return P;
};

/** 店のキーだけを取り出す（深いコピー） */
const pickStore = s => JSON.parse(JSON.stringify(STK.reduce((o, k) => (o[k] = s[k], o), {})));

/** 新しいお店（ちいさなお店の初期状態。店長つき） */
function newStore(name, loc) {
    const f = fresh(), s = pickStore(f);
    s.log = [];
    Object.assign(s, { sname: name, loc, mgr: true, qual: false, margin: difficulty().mg, shelf: [{ id: 0, st: 0 }, { id: 1, st: 0 }], prev: null, msl: [], mSales: 0, tot: 0 });
    return s;
}

/** 店長を雇ってオーナーになる */
function hireMgr() {
    if (state.phase !== 'closed' || state.over || ill() || !mgrShow())
        return;
    state.money -= MGR_HIRE;
    state.mgr = true;
    state.qual = true;
    state.sname = state.sname || '1号店';
    state.loc = state.loc || 'suburb';
    state.co = { est: false, name: '', cap: 0, pol: 'steady', ek: 0, hist: [], tr: 0, trTot: 0, since: 0, seen: ['suburb'] };
    state.stores = [pickStore(state)];
    state.cur = 0;
    state.tab = 4;
    addEvent('👔 店長を雇ってオーナーになりました！「会社」タブから会社を設立できます');
    render();
    save();
}

/** 会社を設立する */
function coFound(name, cap) {
    const c = state.co;
    if (!c || c.est || state.phase !== 'closed' || state.over)
        return;
    name = String(name || '').trim().slice(0, 16);
    if (!name)
        return CG.toast('屋号を入れてください', 2000);
    if (!CAPT.slice(0, 3).some(t => t.v === cap) || state.money < cap + CO_FEE)
        return CG.toast('お金が足りません', 2000);
    state.money -= cap + CO_FEE;
    Object.assign(c, { est: true, name, cap, since: state.day, ek: 24 + Math.floor(Math.random() * ((NK.length - 1) * 12 - 24)) });
    addEvent('🏢 「' + name + '」を設立しました（資本金' + yen(cap) + '）。景気の波が来るようになります');
    render();
    save();
}

/** 次の資本金の段階と、まだ足りない条件（なければ空） */
function capNext() {
    const c = state.co, i = CAPT.findIndex(t => t.v > c.cap);
    if (i < 0)
        return null;
    const t = CAPT[i], n = allStores().length, why = [];
    if (n < t.st)
        why.push('お店' + t.st + '店舗以上（いま' + n + '店舗）');
    if (coAvg() < t.s)
        why.push('全店の月の売上（3ヶ月平均）' + yen(t.s) + '以上（いま' + yen(Math.round(coAvg())) + '）');
    if (state.money < t.v - c.cap)
        why.push('払い込むお金' + yen(t.v - c.cap));
    return { t, why };
}

/** 資本金を増やす（増資） */
function capUp() {
    const N = capNext();
    if (!N || N.why.length || state.phase !== 'closed' || state.over)
        return;
    state.money -= N.t.v - state.co.cap;
    state.co.cap = N.t.v;
    addEvent('🏦 増資しました。資本金' + yen(N.t.v) + '（取引先：' + partner().n + '）');
    render();
    save();
}

/** シーシャ屋が解放されているか（ほかの出店場所すべてに出した） */
const shishaOpen = () => ['suburb', 'downtown', 'uptown', 'dept', 'station'].every(k => (state.co.seen || []).includes(k));

/** 新しいお店を出す */
function coOpen(name, loc) {
    const c = state.co, L = LOCS[loc];
    if (!c || !c.est || !L || state.phase !== 'closed' || state.over || storeSlots() < 1)
        return;
    if (loc === 'shisha' && !shishaOpen())
        return;
    name = String(name || '').trim().slice(0, 16) || (allStores().length + 1) + '号店';
    if (state.money < L.cost)
        return CG.toast('出店費が足りません', 2000);
    state.money -= L.cost;
    state.stores[state.cur] = pickStore(state);
    state.stores.push(newStore(name, loc));
    if (!c.seen.includes(loc))
        c.seen.push(loc);
    addEvent('🎉 ' + L.e + ' ' + L.n + 'に「' + name + '」を出店しました（出店費' + yen(L.cost) + '）。店舗管理から行けます');
    render();
    save();
}

/** 店を切り替える（閉店後だけ） */
function coSwitch(i) {
    const S = state.stores;
    if (!S || i === state.cur || !S[i] || state.phase !== 'closed' || state.over)
        return;
    S[state.cur] = pickStore(state);
    // 営業タブのログもお店ごと（v2.2.0〜。v2.1.0 のセーブの店には無いので空から）
    Object.assign(state, { log: [] }, JSON.parse(JSON.stringify(S[i])));
    state.cur = i;
    applyKind();
    fill();
    addLog('🚶 「' + state.sname + '」（' + locOf().n + '）に来ました。');
    state.tab = 0;
    render();
    save();
}

/** 店の名前を変える */
function coRename(i, name) {
    name = String(name || '').trim().slice(0, 16);
    if (!name || !state.stores)
        return;
    if (i === state.cur)
        state.sname = name;
    else
        state.stores[i].sname = name;
    render();
    save();
}

/** 店主がいない店の1日（閉店のたびに呼ぶ）。店長か店員がいれば営業し、在庫は自動で補充される */
function coBgDay(s) {
    const L = locOf(s), sh = (s.shelf || []).filter(Boolean), R = Math.random, ev = difficulty().ev;
    s.dRev = 0;
    if (!(s.mgr || s.clerk > 0) || !sh.length || (s.clean || 0) > 0) {
        if (s.clean > 0)
            s.clean--;
        return;
    }
    // 商品の原価と売値（シーシャ屋はフレーバー。アップグレードも反映）
    const shi = isShisha(s);
    const pc = id => {
        const b = shi && id < FLAV.length ? FLAV[id].c : (PDEF ? PDEF[id].b : PRODUCTS[id].b);
        return Math.round(b * (1 + 0.4 * (s.up[id] || 0)) * (s.cm ? s.cm[id] : 1));
    };
    const pp = id => Math.max(pc(id) + 1, Math.round(pc(id) / (1 - s.margin / 100)));
    const tk = (s.closeH - s.openH) * 5;
    const df = Math.min(1.6, Math.max(0.5, 1 - (s.margin - 40) * 0.015));
    const rate = (0.35 + 0.18 * s.ad + 0.08 * sh.length) * pwr(state.day) * econ() * L.cust * df * Math.pow(1.2, (s.pays || []).length) * difficulty().cust;
    const cust = rate * tk * (0.85 + 0.3 * R());
    const wt = sh.map(t => Math.pow(80 / pc(t.id), 0.6) * (L.pref ? L.pref(t.id) : 1)), W = wt.reduce((a, b) => a + b, 0);
    const e = Math.max(0, (s.sk || 0) - (s.dn || 0)), amt = e >= 10 ? 1e9 : 5 * Math.pow(2, e);
    const sold = Math.round(Math.min(cust * (1.25 + 0.05 * s.ad), sh.length * s.cap + Math.max(1, s.clerk) * amt * tk * 0.3));
    let rev = 0, cg = 0;
    sh.forEach((t, i) => {
        const q = Math.round(sold * wt[i] / W);
        rev += q * pp(t.id);
        cg += q * pc(t.id);
        s.sd[t.id] = (s.sd[t.id] || 0) + q;
    });
    state.money += rev - cg;
    s.mSales = (s.mSales || 0) + rev;
    s.tot = (s.tot || 0) + rev;
    s.dRev = rev;
    // 店員の給料（今の店と同じ時給。月末にまとめて払う）
    if (s.clerk > 0) {
        let w = 0;
        for (let h = s.openH; h < s.closeH; h++)
            w += WAGE * (h < 7 || h >= 22 ? 1.25 : 1);
        s.mWage = (s.mWage || 0) + w * s.clerk;
    }
    const tag = '🏬「' + s.sname + '」';
    // ほかの店のできごと：お知らせとログには出すが、いまの店の空は赤くしない（店の絵の演出もしない）
    const bgEv = t => {
        state.evs.push(t);
        addLog(t);
        noticeBad(t);
    };
    if (R() < 0.01 * ev * L.crime) {
        state.money -= rev;
        bgEv(tag + 'で強盗被害！本日の売上金' + yen(rev) + 'を奪われました');
    }
    if (s.clerk > 0 && R() < 0.03 * ev * L.crime) {
        const a = Math.round(rev * (0.05 + R() * 0.2));
        state.money -= a;
        s.clerk--;
        bgEv(tag + 'で従業員の窃盗！' + yen(a) + 'が盗まれ、解雇しました');
    }
    if (R() < 0.01 * ev * L.dis && !L.indoor && s.slots > 1) {
        s.shelf.splice(Math.floor(R() * s.shelf.length), 1);
        s.slots--;
        state.money -= 10000;
        bgEv(tag + 'に車が突っ込みました。棚が減り、修繕費¥10,000');
    }
    if (!s.qual && atCeil(s))
        s.qual = true;
}

/** 店主がいない店の月末（テナント料・店員の給料・店長の月給） */
function coBgMonth(s) {
    const L = locOf(s), f = r100(4000 * Math.pow(1.6, s.slots - 2) * (s.feeMul || 1) * difficulty().fee * L.fee), w = Math.round(s.mWage || 0), m = s.mgr ? MGR_SAL : 0;
    state.money -= f + w + m;
    s.mWage = 0;
    s.prev = s.mSales;
    (s.msl = s.msl || []).push(s.mSales);
    s.mSales = 0;
    return f + w + m;
}

/** 閉店のたびに呼ぶ（engine.js の endDay の最後）。店主がいない店を進め、会社の取引と月末の記録をする */
function coDaily() {
    if (!state.co)
        return;
    if (!state.qual && atCeil())
        state.qual = true;
    const S = state.stores || [];
    let bgCost = 0;
    S.forEach((s, i) => {
        if (i === state.cur)
            return;
        coBgDay(s);
        if (state.day > 0 && state.day % MD === 0)
            bgCost += coBgMonth(s);
    });
    const c = state.co;
    if (!c.est)
        return;
    // 取引先からの収入（方針で入り方が変わる。資本金・業種・景気で額が変わる）
    const P = POLS.find(p => p.k === c.pol) || POLS[0], pt = partner();
    const pay = () => {
        const a = r100(c.cap * P.r * pt.m * econ() * (0.8 + Math.random() * 0.4));
        if (a <= 0)
            return;
        state.money += a;
        c.tr = (c.tr || 0) + a;
        c.trTot = (c.trTot || 0) + a;
        addLog('🤝 ' + pt.n + 'との' + P.t + ' +' + yen(a));
    };
    if (P.p > 0 && Math.random() < P.p)
        pay();
    if (state.day > 0 && state.day % MD === 0) {
        if (P.p === 0)
            pay();
        // 会社の月の記録（全店の売上・取引収入・景気）
        const s = allStores().reduce((a, x) => a + (x === state ? (state.prev || 0) : (x.prev || 0)), 0);
        c.hist.push({ m: state.day / MD, s, tr: c.tr || 0, e: Math.round(econ() * 1000) / 1000, n: allStores().length, money: Math.round(state.money) });
        if (c.hist.length > 60)
            c.hist.shift();
        c.tr = 0;
        c.ek++;
        if (bgCost)
            addLog('🏢 ほかのお店の月末の支払い ' + yen(bgCost));
    }
}

/** 会社タブを描く */
function coRender() {
    const el = byId('co');
    if (!el)
        return;
    const c = state.co;
    if (!c) {
        el.innerHTML = coHtml = '';
        return;
    }
    const ok = state.phase === 'closed' && !state.over;
    const dis = b => (b && ok) ? '' : ' disabled';
    if (!c.est) {
        const f = '<div class="card co1"><b>🏢 会社を設立する</b><div class="meta">屋号（会社の名前）と資本金を決めます。設立費用' + yen(CO_FEE) + 'と資本金を払い込みます。設立すると景気の波が来るようになり、取引先からの収入と、新しいお店を出せるようになります。</div>'
            + '<label class="cof">屋号<input id="coname" maxlength="16" placeholder="例：ちくわ商店" value="' + esc(c.draft || '') + '"></label>'
            + '<label class="cof">資本金<select id="cocap">' + CAPT.slice(0, 3).map(t => '<option value="' + t.v + '"' + (state.money < t.v + CO_FEE ? ' disabled' : '') + '>' + yen(t.v) + '</option>').join('') + '</select></label>'
            + '<button class="big" data-a="cofound"' + dis(state.money >= CAPT[0].v + CO_FEE) + '>会社を設立する</button>' + (ok ? '' : '<div class="meta svwarn">閉店後に設立できます。</div>') + '</div>';
        if (f !== coHtml)
            el.innerHTML = coHtml = f;
        return;
    }
    const e = econ(), A = allStores(), n = A.length, P = POLS.find(p => p.k === c.pol) || POLS[0], pt = partner(), N = capNext(), sl = storeSlots();
    let h = '<div class="card co1"><div class="row"><b>🏢 ' + esc(c.name) + '</b><button class="alt cost" data-a="costat">📊 会社のステータス</button></div><button class="big codb" data-a="codash">🏪 お店のダッシュボード</button>'
        + '<div class="cokv"><span>資本金</span><b>' + yen(c.cap) + '</b><span>景気</span><b>' + econName(e) + '（×' + e.toFixed(2) + '）</b><span>店舗</span><b>' + n + ' / ' + MAX_STORES + '</b><span>取引先</span><b>' + pt.n + '</b></div></div>';
    // 資本金（増資）
    h += '<div class="card"><b>🏦 資本金</b><div class="meta">資本金が大きいほど、取引先の業種が上がり、取引の額が増えます（飲食店：¥1,000万・3店舗／小売店：¥5,000万・5店舗／製造業：¥8,000万・8店舗／金融業：¥1億・10店舗）。</div>'
        + (N ? '<div class="meta">次：' + yen(N.t.v) + (N.why.length ? '（足りない条件：' + N.why.join('・') + '）' : '（払い込み' + yen(N.t.v - c.cap) + '）') + '</div><button data-a="capup"' + dis(!N.why.length) + '>' + yen(N.t.v) + 'に増資する</button>' : '<div class="meta">資本金は最大です。</div>') + '</div>';
    // 会社方針
    h += '<div class="card"><b>🧭 会社方針</b><div class="meta">方針によって取引先と、収入の入り方が変わります。</div><select data-a="copol" class="cosel"' + (ok ? '' : ' disabled') + '>' + POLS.map(p => '<option value="' + p.k + '"' + (p.k === c.pol ? ' selected' : '') + '>' + p.n + '：' + p.d + '</option>').join('') + '</select><div class="meta">今月の取引収入 ' + yen(c.tr || 0) + '（累計' + yen(c.trTot || 0) + '）</div></div>';
    // 店舗管理
    h += '<div class="card"><b>🏪 店舗管理</b><div class="meta">店主（あなた）がいる店は、今までどおり遊べます。ほかの店は店長が営業します（店員の補充・投資は、その店へ行って行います）。店へ行けるのは閉店後です。</div><div class="stl">'
        + A.map((s, i) => {
            const L = locOf(s), here = i === (state.cur || 0), st = here ? '🙋 ここにいます' : (s.mgr || s.clerk > 0) ? '👔 店長が営業中' : '💤 休業中（店員なし）';
            return '<div class="sti' + (here ? ' here' : '') + '"><div class="stn"><span class="ste">' + L.e + '</span><div><b>' + esc(s.sname || (i + 1) + '号店') + '</b><div class="meta">' + L.n + '・棚' + s.slots + '・広告Lv' + s.ad + '・店員' + s.clerk + '人・先月' + yen(s.prev || 0) + '</div><div class="meta">' + st + '</div></div></div><div class="btns"><button class="alt" data-a="coren" data-i="' + i + '">名前</button>' + (here ? '' : '<button data-a="cogo" data-i="' + i + '"' + dis(true) + '>この店へ行く</button>') + '</div></div>';
        }).join('') + '</div></div>';
    // 新しいお店を出す
    const locs = Object.keys(LOCS).filter(k => k !== 'shisha' || shishaOpen());
    h += '<div class="card"><b>🆕 新しいお店を出す</b><div class="meta">ちいさなお店の初期状態（棚2台・店長つき）から始まります。どれかのお店が「棚10台・広告Lv18・店員1人以上」になるたびに、出店枠が1つ増えます。店長の月給は' + yen(MGR_SAL) + '。</div><div class="meta">出店枠：<b>' + sl + '</b>' + (n >= MAX_STORES ? '（お店は最大です）' : '') + '</div>'
        + '<label class="cof">名前<input id="sname" maxlength="16" placeholder="' + (n + 1) + '号店"></label>'
        + '<div class="locl">' + locs.map(k => {
            const L = LOCS[k];
            return '<label class="loc"><input type="radio" name="loc" value="' + k + '"' + (k === (c.lsel || 'suburb') ? ' checked' : '') + '><span class="le">' + L.e + '</span><span class="lt"><b>' + L.n + '</b><span>' + L.d + '</span><span>出店費 ' + yen(L.cost) + '</span></span></label>';
        }).join('') + (shishaOpen() ? '' : '<div class="meta">💨 ？？？：ほかの出店場所すべてにお店を出すと解放</div>') + '</div>'
        + '<button class="big" data-a="coopen"' + dis(sl > 0) + '>お店を出す</button></div>';
    if (h !== coHtml)
        el.innerHTML = coHtml = h;
    if (coDashOpen)
        coDash(true);
}

/** 前に描いた会社タブ（同じなら描き直さない。入力中の文字や選択を消さないため） */
let coHtml = '';

/** 会社のステータス（ダッシュボード） */
let coStatOpen = false;
function coStat(on) {
    coStatOpen = on;
    let el = byId('costm');
    if (!on) {
        if (el)
            el.hidden = true;
        return;
    }
    if (!el) {
        el = document.createElement('div');
        el.id = 'costm';
        el.addEventListener('click', e => {
            if (e.target === el)
                coStat(false);
        });
        document.body.appendChild(el);
    }
    el.hidden = false;
    const c = state.co, A = allStores(), H = c.hist.slice(-12), last = c.hist.at(-1) || { s: 0, tr: 0 };
    const now = A.reduce((a, s) => a + (s.mSales || 0), 0), debt = (state.loans || []).reduce((a, l) => a + l.pay * l.left, 0);
    const fixedAll = A.reduce((a, s) => a + r100(4000 * Math.pow(1.6, s.slots - 2) * (s.feeMul || 1) * difficulty().fee * locOf(s).fee) + (s.mgr ? MGR_SAL : 0), 0);
    const mx = Math.max(1, ...H.map(x => x.s));
    const bars = H.length ? '<div class="cobars">' + H.map(x => '<div class="cob" title="' + x.m + 'ヶ月目 ' + yen(x.s) + '"><i style="height:' + Math.max(2, x.s / mx * 100) + '%"></i><span>' + x.m + '</span></div>').join('') + '</div>' : '<div class="meta">月末が来ると、ここに売上の推移が出ます。</div>';
    // 景気の推移（株価の過去24ヶ月と今後は見せない）
    const pts = [];
    for (let i = 23; i >= 0; i--)
        pts.push(nkAt(c.ek - i));
    const pm = Math.min(...pts), pM = Math.max(...pts), poly = pts.map((v, i) => (i * 300 / 23).toFixed(1) + ',' + (56 - (v - pm) / Math.max(1, pM - pm) * 50).toFixed(1)).join(' ');
    const kv = (k, v) => '<span>' + k + '</span><b>' + v + '</b>';
    el.innerHTML = '<div class="ovbox cobox"><div class="achtop"><b>📊 ' + esc(c.name) + '</b><button class="alt achx" data-a="costclose" aria-label="閉じる">✕</button></div><div class="achbody">'
        + '<div class="cokv">' + kv('今月の全店売上（途中）', yen(now)) + kv('先月の全店売上', yen(last.s)) + kv('先月の取引収入', yen(last.tr)) + kv('取引収入の累計', yen(c.trTot || 0)) + kv('所持金', yen(Math.round(state.money))) + kv('資本金', yen(c.cap)) + kv('借入の残り', yen(debt)) + kv('純資産（所持金＋預金＋資本金−借入）', yen(Math.round(state.money + (state.sv || 0) + c.cap - debt))) + kv('全店の固定費（テナント料＋店長）', '月' + yen(fixedAll)) + kv('店舗数', A.length + '店舗') + kv('設立した月', '通算' + (c.since ? Math.floor((c.since - 1) / MD) + 1 : 1) + 'ヶ月目') + '</div>'
        + '<h3>全店の月の売上（直近12ヶ月）</h3>' + bars
        + '<h3>景気（株価の動き・直近24ヶ月）　' + econName(econ()) + '</h3><svg class="coeco" viewBox="0 0 300 60" preserveAspectRatio="none"><polyline points="' + poly + '" fill="none" stroke="var(--mint)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>'
        + '<h3>店舗ごと（先月）</h3><table class="cotb"><tr><th>店</th><th>場所</th><th>売上</th><th>棚</th><th>店員</th></tr>' + A.map(s => '<tr><td>' + esc(s.sname || '') + '</td><td>' + locOf(s).e + locOf(s).n + '</td><td>' + yen(s.prev || 0) + '</td><td>' + s.slots + '</td><td>' + s.clerk + '</td></tr>').join('') + '</table>'
        + '</div></div>';
}

/**
 * お店のダッシュボード（v2.2.0〜）。会社タブのボタンで開き、全店の状況を1枚ずつのカードで並べる。
 * カードを押すとその店へ行く（閉店後だけ）。開いている間は render のたびに描き直す（同じなら描き直さない）
 */
let coDashOpen = false, coDashHtml = '';
function coDash(on) {
    coDashOpen = on;
    let el = byId('codash');
    if (!on) {
        if (el)
            el.hidden = true;
        return;
    }
    if (!state.co) {
        coDashOpen = false;
        return;
    }
    if (!el) {
        el = document.createElement('div');
        el.id = 'codash';
        el.addEventListener('click', e => {
            if (e.target === el)
                coDash(false);
        });
        document.body.appendChild(el);
        coDashHtml = '';
    }
    el.hidden = false;
    const A = allStores(), cur = state.cur || 0, ok = state.phase === 'closed' && !state.over, d = Math.max(state.day, 1), dm = (d - 1) % MD + 1;
    const sum = k => A.reduce((a, s) => a + (s[k] || 0), 0);
    const cards = A.map((s, i) => {
        const L = locOf(s), here = i === cur, sh = (s.shelf || []).filter(Boolean);
        const st = sh.reduce((a, x) => a + x.st, 0), full = sh.length * (s.cap || 1), pct = full ? Math.round(st / full * 100) : 0;
        const fee = r100(4000 * Math.pow(1.6, s.slots - 2) * (s.feeMul || 1) * difficulty().fee * L.fee) + (s.mgr ? MGR_SAL : 0);
        const open = here || s.mgr || s.clerk > 0;
        const tag = here ? '<span class="dbt here">🙋 ここ</span>' : !open ? '<span class="dbt off">💤 休業</span>' : (s.clean || 0) > 0 ? '<span class="dbt warn">🧹 清掃中</span>' : pct < 15 ? '<span class="dbt warn">⚠️ 在庫少</span>' : '<span class="dbt">👔 営業中</span>';
        // 今月の売上は、先月の売上に対してどこまで来たか（先月が無い店は棒を出さない）
        const pv = s.prev || 0, bar = pv > 0 ? Math.min(100, Math.round((s.mSales || 0) / pv * 100)) : 0;
        const kv = (k, v) => '<span>' + k + '</span><b>' + v + '</b>';
        return '<button type="button" class="dbc' + (here ? ' here' : '') + '" data-a="dbgo" data-i="' + i + '"' + (here || !ok ? ' disabled' : '') + '>'
            + '<div class="dbh"><span class="dbe">' + L.e + '</span><span class="dbn"><b>' + esc(s.sname || (i + 1) + '号店') + '</b><small>' + L.n + '・棚' + s.slots + '・店員' + s.clerk + '人</small></span>' + tag + '</div>'
            + '<div class="dbk">' + kv('今日の売上', yen(s.dRev || 0)) + kv('今月の売上', yen(s.mSales || 0)) + kv('先月の売上', pv ? yen(pv) : '―') + kv('月の固定費', yen(fee)) + '</div>'
            + (pv > 0 ? '<div class="dbbar"><i style="width:' + bar + '%"></i><span>先月の' + Math.round((s.mSales || 0) / pv * 100) + '%</span></div>' : '')
            + '<div class="dbbar stock"><i style="width:' + pct + '%"></i><span>在庫 ' + pct + '%</span></div>'
            + '</button>';
    }).join('');
    const h = '<div class="ovbox cobox"><div class="achtop"><b>🏪 お店のダッシュボード</b><button class="alt achx" data-a="codashclose" aria-label="閉じる">✕</button></div><div class="achbody">'
        + '<div class="cokv">' + '<span>全店の今日の売上</span><b>' + yen(sum('dRev')) + '</b><span>全店の今月の売上（' + dm + '/' + MD + '日）</span><b>' + yen(sum('mSales')) + '</b><span>全店の先月の売上</span><b>' + yen(sum('prev')) + '</b></div>'
        + '<div class="meta dbm">' + (ok ? 'カードを押すと、そのお店へ行けます。' : '閉店後にお店へ行けます。') + '</div><div class="dbl">' + cards + '</div></div></div>';
    if (h !== coDashHtml)
        el.innerHTML = coDashHtml = h;
}

/** HTML に入れる文字を逃がす */
function esc(t) {
    return String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled)
        return;
    const a = b.dataset.a;
    if (a === 'hiremgr')
        hireMgr();
    if (a === 'cofound')
        coFound(byId('coname').value, +byId('cocap').value);
    if (a === 'capup')
        capUp();
    if (a === 'cogo')
        coSwitch(+b.dataset.i);
    if (a === 'coren') {
        const i = +b.dataset.i, s = allStores()[i], v = prompt('お店の名前（16文字まで）', s.sname || '');
        if (v !== null)
            coRename(i, v);
    }
    if (a === 'coopen') {
        const r = document.querySelector('input[name="loc"]:checked');
        coOpen(byId('sname').value, r ? r.value : 'suburb');
    }
    if (a === 'costat')
        coStat(true);
    if (a === 'costclose')
        coStat(false);
    if (a === 'codash')
        coDash(true);
    if (a === 'codashclose')
        coDash(false);
    if (a === 'dbgo') {
        coDash(false);
        coSwitch(+b.dataset.i);
    }
});
document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset && t.dataset.a === 'copol' && state.co) {
        state.co.pol = t.value;
        addLog('🧭 会社方針を「' + (POLS.find(p => p.k === t.value) || POLS[0]).n + '」にしました。');
        save();
    }
    if (t.name === 'loc' && state.co)
        state.co.lsel = t.value;
});
document.addEventListener('input', e => {
    if (e.target.id === 'coname' && state.co)
        state.co.draft = e.target.value;
});
