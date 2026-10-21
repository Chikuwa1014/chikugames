/**
 * state.js — ゲームの状態（state）の初期化・読み込み・保存、ログ。
 */

/** 店員の時給（難易度で変わる） */
let WAGE = 1195;

/** 倒産ライン（毎日の閉店時に再計算） */
let LIMIT = -1000;

/** 新規ゲームの初期状態 */
const fresh = () => ({
    money: 5000,
    day: 0,
    t: 0,
    phase: 'closed',
    slots: 2,
    cap: 10,
    ad: 0,
    clerk: 0,
    own: [0, 1],
    shelf: [{ id: 0, st: 5 }, { id: 1, st: 0 }],
    sold: 0,
    miss: 0,
    gauge: 50,
    boost: 0,
    weather: 0,
    next: 0,
    hol: false,
    mSales: 0,
    tot: 0,
    dRev: 0,
    dSold: 0,
    dMiss: 0,
    rep: '',
    over: false,
    ovx: false,
    margin: 40,
    feeMul: 1,
    spd: 1,
    happy: 60,
    sick: 0,
    dep: 0,
    low: 0,
    low5: 0,
    up: PRODUCTS.map(() => 0),
    sd: PRODUCTS.map(() => 0),
    cm: PRODUCTS.map(() => 1),
    fem: 0,
    rb: 0,
    flame: 0,
    sk: 0,
    dn: 0,
    sl: 0,
    ss: 0,
    sb: 0,
    clean: 0,
    sv: 0,
    svs: 0,
    sal: 0,
    openH: 9,
    closeH: 19,
    dOpen: false,
    dWage: 0,
    prev: null,
    loans: [],
    ln: { a: 30000, m: 3 },
    pays: [],
    boom: 0,
    evs: [],
    log: ['開業前です。投資や天気予報を確認して「開業する」を押しましょう。']
});

/** スライダー操作中のフラグ（設定欄の再描画を止める） */
let dragMg = false;

/** ゲームの状態（唯一のセーブ対象） */
let state;

try {
    state = JSON.parse(localStorage.getItem(KEY));
}
catch (e) { }

if (!state || !state.shelf) {
    state = fresh();
    state.next = roll(1);
    state.weather = state.next;
}

/** ログに1行追加（最新3件） */
const addLog = t => {
    state.log.unshift(t);
    state.log = state.log.slice(0, 3);
};

/** ブラウザへ保存 */
const save = () => {
    try {
       localStorage.setItem(KEY, JSON.stringify(state));
    }
    catch (e) { }
};
