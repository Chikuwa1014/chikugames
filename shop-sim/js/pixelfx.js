/**
 * pixelfx.js — イベントを店の絵に反映する（v1.5.0〜）。
 * addEvent（events.js）が文面から種類を決め（fxKind）、その日の分を state.fx に記録する（markFx）。
 * 翌日（state.day が変わる）になると絵は元に戻る。描くのは pixel.js の drawPx から呼ばれる
 * pxFxShop（人物より奥・店に付くもの）と pxFxTop（人物より手前・動くもの・水・煙）。
 * 座標は pixel.js と同じ論理座標（192×92）。細かい粒は実ピクセルの Rp。
 */

/** イベント文面に含まれる言葉 → 絵の種類（上から順に探す） */
const FXK = [
    ['台風で浸水', 'flood'], ['土嚢で台風に耐え', 'sandbag'], ['大雪で交通マヒ', 'snow'], ['6台の車', 'crash6'], ['車が店に突っ込み', 'car'],
    ['爆発', 'bomb'], ['大地震', 'quake'], ['強盗被害', 'robber'], ['従業員の窃盗', 'thief'], ['万年筆を狙った泥棒', 'ninja'],
    ['超セレブ', 'celeb'], ['パパ活', 'papa'], ['ツモ', 'tsumo'], ['皮が剥けた', 'banana'], ['おにぎりブーム', 'onigiri'],
    ['教育ママ', 'mama'], ['炎上', 'flame'], ['テナント料の改定', 'tenant'], ['ブーム', 'boom'], ['に対応！客足', 'pay']
];

/** イベントの文面から絵の種類を決める（絵にしないものは空） */
function fxKind(t) {
    const h = FXK.find(([k]) => t.includes(k));
    if (!h)
        return '';
    return h[1] === 'tenant' ? (t.includes('+') ? 'tenantUp' : 'tenantDown') : h[1];
}

/** その日の絵に反映するイベントを記録する（日が変わったら入れ替え） */
function markFx(k) {
    if (state.fxd !== state.day || !state.fx) {
        state.fx = [];
        state.fxd = state.day;
    }
    if (!state.fx.includes(k))
        state.fx.push(k);
}

/** 今日の絵に反映するイベントの一覧 */
const fxList = () => (state.fxd === state.day && state.fx) ? state.fx : [];

/** 車を描く（x,y は左上。幅14） */
function pxCar(x, y, c) {
    Rc(x, y + 3, 14, 4, c);
    Rc(x + 3, y, 8, 4, c);
    Rc(x + 4, y + 1, 3, 2, '#bfe3f5');
    Rc(x + 8, y + 1, 2, 2, '#bfe3f5');
    Rc(x + 2, y + 6, 3, 2, '#222');
    Rc(x + 9, y + 6, 3, 2, '#222');
}

/** 炎を描く（x,y は足もと。s は大きさ） */
function pxFlame(x, y, s, k) {
    const f = (fr + k) % 3;
    Rc(x, y - 3 * s - f, 3 * s, 3 * s + f, '#e8590c');
    Rc(x + 1, y - 4 * s - f, s, 2 * s, '#e8590c');
    Rc(x + s * 0.5, y - 2 * s - f * 0.5, 2 * s, 2 * s, '#ffb703');
    Rc(x + s * 0.5 + 0.5, y - s, s, s, '#fff3b0');
}

/** 煙のかたまりを上へ流す（x,y は元の位置、n は個数、c は色） */
function pxSmoke(x, y, n, c, h) {
    for (let k = 0; k < n; k++) {
        const t = ((fr * 1.1 + k * (h / n)) % h), r = 2 + t / 6;
        cx.globalAlpha = Math.max(0, .85 - t / h);
        Rc(x + Math.sin((fr + k * 5) / 5) * 3 + t / 8 - r / 2, y - t - r / 2, r, r * 0.8, c);
    }
    cx.globalAlpha = 1;
}

/** ハート（5×4 の論理ドット） */
function pxHeart(x, y, c) {
    Rc(x, y, 2, 1, c);
    Rc(x + 3, y, 2, 1, c);
    Rc(x, y + 1, 5, 1, c);
    Rc(x + 1, y + 2, 3, 1, c);
    Rc(x + 2, y + 3, 1, 1, c);
}

/** ふきだしに「！」を出す */
function pxBang(x, y) {
    Rc(x, y, 9, 10, '#fff');
    Rc(x + 3, y + 10, 2, 2, '#fff');
    Rc(x + 4, y + 2, 1, 4, '#e63946');
    Rc(x + 4, y + 7, 1, 1, '#e63946');
}

/** 割れた窓（窓の左上 fx,41 から。ひびと穴） */
function pxBroken(fx) {
    Rc(fx + 1, 42, 30, 17, 'rgba(30,22,18,.55)');
    [[3, 43, 12, 9], [18, 44, 9, 12], [8, 50, 15, 5]].forEach(([a, b, w, h]) => {
        for (let i = 0; i < w; i += 2)
            Rp((fx + a) * 2 + i * 2, (b * 2) + Math.round(i * h / w) * 2, 2, 2, 'rgba(255,255,255,.75)');
    });
    for (let i = 0; i < 8; i++)
        Rc(fx + 2 + i * 4, 60 + (i % 3), 1, 1, '#e6f1f7');
}

/** 店に付くもの・地面にあるもの（人物より奥） */
function pxFxShop() {
    const F = fxList(), has = k => F.includes(k);
    // 台風（耐えた）：土嚢の壁
    if (has('sandbag'))
        for (let r = 0; r < 2; r++)
            for (let x = 46 + (r ? 3 : 0); x < 146; x += 7) {
                Rc(x, 60 - r * 3, 7, 3, '#c9a96a');
                Rc(x, 62 - r * 3, 7, 1, '#9c7f45');
                Rc(x + 3, 60 - r * 3, 1, 3, '#b08f52');
            }
    // 大雪：屋根・ひさし・つらら・吹きだまり
    if (has('snow')) {
        Rc(44, 17, 104, 3, '#fff');
        Rc(44, 19, 104, 1, '#d9e6f0');
        Rc(48, 27, 96, 2, '#fff');
        for (let x = 50; x < 142; x += 6)
            Rc(x, 37, 1, 2 + (x / 6 | 0) % 3, '#dff2ff');
        Rc(44, 56, 106, 6, '#f4f8fb');
        Rc(52, 58, 32, 2, '#fff');
        Rc(108, 58, 32, 2, '#fff');
        Rc(60, 52, 30, 6, '#fff');
        Rc(100, 53, 36, 5, '#fff');
        Rc(86, 50, 20, 12, '#f4f8fb');
        Rc(90, 47, 12, 4, '#fff');
        Rc(60, 58, 30, 1, '#cfd8e0');
    }
    // 車が突っ込んだ
    if (has('car')) {
        pxBroken(52);
        Rc(54, 52, 26, 7, '#2a6fdb');
        Rc(60, 47, 14, 6, '#2a6fdb');
        Rc(62, 48, 4, 4, '#bfe3f5');
        Rc(68, 48, 4, 4, '#bfe3f5');
        Rc(54, 52, 5, 4, '#e9c46a');
        Rc(58, 58, 5, 4, '#222');
        Rc(72, 58, 5, 4, '#222');
        Rc(52, 60, 30, 1, 'rgba(0,0,0,.25)');
    }
    // 6台の事故：車が山積み・窓は全部割れる
    if (has('crash6')) {
        pxBroken(52);
        pxBroken(108);
        ['#d62828', '#2a6fdb', '#e9c46a', '#2a9d8f', '#7b5ea7', '#e07b2d'].forEach((c, i) => pxCar(48 + i * 15 - (i % 2) * 2, 53 + (i % 3) * 2 - (i % 2) * 3, c));
    }
    // 爆発：すすけた壁・屋根の穴・割れた窓の中の炎
    if (has('bomb')) {
        Rc(48, 26, 96, 36, 'rgba(0,0,0,.4)');
        Rc(70, 20, 26, 6, '#2a2420');
        Rc(76, 18, 8, 3, '#2a2420');
        Rc(88, 18, 6, 2, '#2a2420');
        [52, 108].forEach(fx => {
            Rc(fx + 1, 42, 30, 17, '#2a1c16');
            for (let i = 0; i < 4; i++)
                pxFlame(fx + 3 + i * 7, 59, 2, i);
        });
        for (let i = 0; i < 7; i++)
            Rc(46 + i * 17, 62 + (i % 3), 2, 1 + (i % 2), '#6b4a30');
    }
    // 大地震：壁のひび・がれき
    if (has('quake')) {
        [[60, 24, 62], [60, 62, 40], [118, 26, 40], [100, 48, 40]].forEach(([x, y, l], j) => {
            let px = x;
            for (let i = 0; i < l; i += 2) {
                px += ((i + j) % 4 < 2 ? 1 : -1);
                Rc(px, y + i * 0.5, 1, 1, '#2a2420');
            }
        });
        for (let k = 0; k < 6; k++)
            Rc(50 + k * 16, 62 + (k % 2), 3, 2, '#8a8a8a');
        for (let k = 0; k < 5; k++)
            Rc(52 + k * 20, 20 + ((fr * 3 + k * 13) % 40), 2, 2, '#8a5a3c');
        for (let x = 6; x < 190; x += 14)
            Rc(x, 70 + (x / 14 | 0) % 3 * 6, 6, 1, '#2a2a2a');
    }
    // 強盗：屋根の警報灯
    if (has('robber')) {
        Rc(92, 14, 6, 4, fr % 4 < 2 ? '#ff3b3b' : '#661111');
        Rc(93, 12, 4, 2, '#888');
    }
    // 超セレブ：黒いリムジン
    if (has('celeb')) {
        Rc(92, 72, 40, 8, '#15151a');
        Rc(100, 68, 22, 5, '#15151a');
        Rc(103, 69, 6, 3, '#6b8296');
        Rc(112, 69, 6, 3, '#6b8296');
        Rc(92, 76, 40, 1, '#e9c46a');
        Rc(96, 79, 6, 3, '#222');
        Rc(122, 79, 6, 3, '#222');
        Rc(131, 74, 2, 2, '#fff3b0');
    }
    // バナナの皮
    if (has('banana')) {
        Rc(63, 63, 6, 2, '#ffe14d');
        Rc(61, 62, 3, 2, '#ffe14d');
        Rc(68, 62, 3, 1, '#ffe14d');
        Rc(70, 62, 1, 1, '#7a5a1a');
    }
    // おにぎりのはた
    if (has('onigiri')) {
        Rc(146, 28, 1, 34, '#555');
        for (let r = 0; r < 10; r++)
            Rc(153 - (2 + r) / 2, 31 + r, 2 + r, 1, '#f6f6ee');
        Rc(150, 38, 6, 3, '#1d3a2c');
    }
    // 炎上：看板と店先に炎
    if (has('flame')) {
        for (let i = 0; i < 5; i++)
            pxFlame(78 + i * 8, 22, 2, i);
        for (let i = 0; i < 9; i++)
            pxFlame(50 + i * 10, 62, 2, i * 2);
    }
    // テナント料の改定：立て看板（上がると赤い↑、下がると青い↓）
    if (has('tenantUp') || has('tenantDown')) {
        const up = has('tenantUp'), c = up ? '#e63946' : '#2a6fdb';
        Rc(26, 50, 11, 12, '#f4f1de');
        Rc(26, 50, 11, 1, '#8a6a45');
        Rc(26, 61, 11, 1, '#8a6a45');
        Rc(24, 62, 2, 2, '#8a6a45');
        Rc(37, 62, 2, 2, '#8a6a45');
        for (let r = 0; r < 4; r++)
            Rc(31 - r, up ? 52 + r : 57 - r, 1 + r * 2, 1, c);
        Rc(30, up ? 56 : 52, 3, 4, c);
    }
    // ブーム：ひさしの旗飾り
    if (has('boom'))
        for (let x = 48; x < 144; x += 6) {
            const c = ['#e63946', '#ffd23f', '#2a9d8f', '#7b5ea7'][(x / 6 | 0) % 4];
            Rc(x, 28, 5, 2, c);
            Rc(x + 1, 30, 3, 1, c);
        }
    pxFxPay();
}

/** キャッシュレス対応：窓のステッカー（夜に窓を描き直したあとにも呼ぶ。v1.5.1〜） */
function pxFxPay() {
    if (!fxList().includes('pay'))
        return;
    Rc(56, 44, 9, 6, '#2a6fdb');
    Rc(56, 46, 9, 1, '#e9c46a');
    Rc(57, 48, 3, 1, '#fff');
    Rc(112, 44, 8, 6, '#2a9d8f');
    Rc(113, 46, 6, 1, '#fff');
}

/** 人物より手前のもの（動く人物・水・煙・きらめき） */
function pxFxTop() {
    const F = fxList(), has = k => F.includes(k), W = 192;
    // 台風（耐えた）：土砂降りと暗い空
    if (has('sandbag')) {
        Rp(0, 0, PXW, PXH, 'rgba(20,30,60,.2)');
        for (let i = 0; i < 80; i++)
            Rp((i * 41 + fr * 3) % PXW, (i * 29 + fr * 10) % PXH, 1, 6, '#9cc8ee');
    }
    // 大雪：吹雪
    if (has('snow'))
        for (let i = 0; i < 110; i++)
            Rp((i * 31 + Math.sin((fr + i * 7) / 6) * 8 + PXW) % PXW, (i * 19 + fr * 3) % PXH, i % 3 ? 1 : 2, i % 3 ? 1 : 2, '#fff');
    // 車の事故：ボンネットの湯気と火花
    if (has('car')) {
        pxSmoke(76, 50, 4, '#e6e6e6', 24);
        if (fr % 3 === 0)
            Rc(56 + (fr % 5) * 3, 56, 1, 1, '#ffd23f');
    }
    if (has('crash6')) {
        pxSmoke(60, 54, 4, '#555', 40);
        pxSmoke(112, 54, 4, '#444', 40);
        pxFlame(70, 56, 2, 0);
        pxFlame(122, 56, 2, 1);
    }
    // 爆発：もくもくの黒煙
    if (has('bomb')) {
        pxSmoke(82, 20, 8, '#3a3a3a', 62);
        pxSmoke(104, 22, 6, '#555', 50);
    }
    // 地震：ほこり
    if (has('quake'))
        for (let i = 0; i < 12; i++)
            Rp((i * 53 + fr * 2) % PXW, 110 + (i * 17) % 40 - ((fr + i * 3) % 10), 3, 2, 'rgba(190,170,130,.6)');
    // 強盗：黒ずくめが売上金の袋を持って走り去る／ふきだし
    if (has('robber')) {
        const x = ((fr * 1.8) % 230) - 20;
        pp(x, 57, '#1a1a1a', { hair: '#111', shades: true, dir: false, walk: fr % 2, mood: 'smug' });
        Rc(x + 6, 62, 5, 5, '#c8b560');
        Rc(x + 7, 61, 3, 1, '#c8b560');
        Rc(x + 8, 63, 1, 2, '#6b5a20');
        pxBang(120, 20);
    }
    // 従業員の窃盗：売上金（小銭）が持ち出される
    if (has('thief')) {
        for (let k = 0; k < 5; k++) {
            const t = (fr + k * 3) % 15, x = 93 + t * 6, y = 52 - t * (15 - t) * 0.22;
            Rc(x, y, 3, 3, '#ffd23f');
            Rc(x + 1, y + 1, 1, 1, '#b8860b');
        }
        pxBang(100, 28);
    }
    // 万年筆泥棒：忍び足の黒ずくめ（光る万年筆）
    if (has('ninja')) {
        const x = ((fr * 0.7) % 130) + 30;
        pp(x, 57, '#161616', { hair: '#161616', shades: true, dir: false, walk: (fr >> 1) % 2, mood: 'neutral' });
        Rc(x + 9, 58, 1, 5, '#5ce1e6');
        if (fr % 4 < 2) {
            Rc(x + 8, 56, 3, 1, '#fff');
            Rc(x + 9, 55, 1, 3, '#fff');
        }
        pxSmoke(x + 4, 66, 2, '#cfcfcf', 8);
    }
    // 超セレブ：金のきらめき
    if (has('celeb'))
        for (let i = 0; i < 12; i++) {
            const x = 52 + (i * 37) % 90, y = 24 + (i * 23) % 36;
            if ((fr + i) % 5 < 3) {
                Rc(x, y, 1, 3, '#ffd23f');
                Rc(x - 1, y + 1, 3, 1, '#ffd23f');
            }
        }
    // パパ活：寄りそう二人とハート
    if (has('papa')) {
        pp(112, 56, '#2a2a2a', { mood: 'happy', bag: true });
        pp(119, 56, '#e56b8a', { g: true, hair: '#3a2418', mood: 'happy', bag: true, dir: true });
        for (let k = 0; k < 3; k++)
            pxHeart(112 + k * 5, 52 - ((fr + k * 4) % 14), '#ff6fa0');
    }
    // ツモ：麻雀牌と落ち込みの縦線
    if (has('tsumo')) {
        const y = 4 + ((fr >> 1) % 2);
        Rc(130, y, 8, 10, '#f4f1d8');
        Rc(130, y + 9, 8, 1, '#2a9d8f');
        Rc(133, y + 3, 2, 2, '#d62828');
        for (let i = 0; i < 4; i++)
            Rc(90 + i * 4, 44, 1, 6 + (i % 2) * 3, '#6a7aa8');
    }
    // バナナの皮：女性客の行列
    if (has('banana'))
        for (let i = 0; i < 4; i++)
            pp(104 + i * 9, 57, FP[i % 4], { g: true, hair: FH[i % 4], mood: i % 2 ? 'joy' : 'happy', walk: 0 });
    // おにぎりブーム：行列
    if (has('onigiri'))
        for (let i = 0; i < 4; i++) {
            const g = i % 2;
            pp(18 + i * 9, 57, (g ? FP : MP)[i], { g: !!g, hair: (g ? FH : MH)[i], mood: i % 2 ? 'joy' : 'happy', walk: 0 });
        }
    // 教育ママ：怒りマークと破れた雑誌
    if (has('mama')) {
        pp(93, 57, '#7a3b8a', { g: true, hair: '#6b4a2a', mood: 'angry' });
        Rc(97, 48, 1, 4, '#e63946');
        Rc(99, 48, 1, 4, '#e63946');
        Rc(96, 49, 5, 1, '#e63946');
        Rc(96, 51, 5, 1, '#e63946');
        for (let k = 0; k < 4; k++)
            Rc(80 + k * 9 + (fr + k) % 3, 50 + ((fr * 2 + k * 7) % 14), 3, 2, '#f4f1de');
    }
    // 炎上：スマホをかざす野次馬
    if (has('flame'))
        for (let i = 0; i < 4; i++) {
            pp(104 + i * 9, 57, '#6b6f78', { mood: i % 2 ? 'wow' : 'smug', walk: 0 });
            Rc(108 + i * 9, 51 - (fr + i) % 2, 2, 3, '#cfe8ff');
        }
    // ブーム：行列と紙吹雪
    if (has('boom')) {
        for (let i = 0; i < 3; i++) {
            const g = i % 2;
            pp(104 + i * 9, 57, (g ? FP : MP)[i], { g: !!g, hair: (g ? FH : MH)[i], mood: i % 2 ? 'joy' : 'happy', walk: 0 });
        }
        for (let i = 0; i < 24; i++)
            Rp((i * 47) % PXW, (i * 31 + fr * 4) % PXH, 2, 2, ['#e63946', '#ffd23f', '#2a9d8f', '#7b5ea7'][i % 4]);
    }
    // 台風の浸水：店が水没する
    if (has('flood')) {
        const wy = 88 + Math.round(Math.sin(fr / 3) * 2);
        for (let k = 0; k < 3; k++) {
            const x = ((fr * 0.8 + k * 70) % 220) - 20;
            Rc(x, wy / 2 - 3, 6, 3, ['#8a5a2c', '#e5989b', '#4fa3d1'][k]);
        }
        Rp(0, wy, PXW, PXH - wy, 'rgba(46,120,200,.6)');
        Rp(0, wy, PXW, 2, 'rgba(210,235,255,.85)');
        Rp(0, wy + 2, PXW, 8, 'rgba(120,180,235,.35)');
        for (let i = 0; i < 14; i++) {
            Rp((i * 37 + fr * 3) % PXW, wy + 6 + (i * 7) % 40, 8, 1, 'rgba(255,255,255,.35)');
            Rp((i * 29 + fr) % PXW, wy + 4 + (i * 13) % 50 - (fr + i * 5) % 12, 2, 2, 'rgba(255,255,255,.5)');
        }
        for (let i = 0; i < 70; i++)
            Rp((i * 37 + fr * 2) % PXW, (i * 23 + fr * 7) % wy, 1, 5, '#7ab8ea');
    }
    // 休業中の清掃（セキュリティLv10が撃退した後）：モップがけ
    if ((state.clean > 0 || state.cleanDay) && !state.over) {
        const x = 70 + Math.sin(fr / 2) * 4;
        Rc(58, 60, 5, 4, '#2a9d8f');
        Rc(57, 59, 7, 1, '#cfeee9');
        pp(x, 57, '#4a90b8', { apron: true, mood: 'happy', walk: fr % 2 });
        Rc(x + 7, 50, 1, 10, '#8a6a45');
        Rc(x + 5, 60, 5, 2, '#cfd8e0');
        if (fr % 4 < 2)
            Rc(x + 11, 58, 1, 3, '#fff');
    }
}
