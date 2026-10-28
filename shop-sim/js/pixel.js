/**
 * pixel.js — ドット絵の描画。
 * v1.4.3〜：キャンバスは 384×184（従来の 192×92 の縦横2倍）。
 * 座標は従来どおり「論理座標（192×92）」で書き、`Rc` が2倍にして塗る（0.5刻みの位置も使える）。
 * 人物・商品など細かく描きたいものだけ、実ピクセル（384×184）で塗る `Rp` を使う。
 */

/** ドット絵のキャンバス */
const cv = byId('px');

/** 描画コンテキスト */
const cx = cv.getContext('2d');

/** アニメーションのフレーム数 */
let fr = 0;

/** キャンバスの実ピクセルの大きさ（論理座標の2倍） */
const PXW = 384, PXH = 184;

/** 四角形を塗る（実ピクセル座標） */
const Rp = (x, y, w, h, c) => {
    if (pxOnlyPp && !pxInPp)
        return;
    x = Math.round(x);
    y = Math.round(y);
    cx.fillStyle = c;
    cx.fillRect(x, y, w, h);
    if (pxDk) {
        cx.fillStyle = 'rgba(8,16,48,0.5)';
        cx.fillRect(x, y, w, h);
    }
};

/** 四角形を塗る（論理座標。実ピクセルでは2倍） */
const Rc = (x, y, w, h, c) => Rp(x * 2, y * 2, w * 2, h * 2, c);

/** 色を明るく（k>0）・暗く（k<0）する */
function shade(c, k) {
    const n = parseInt(c.slice(1), 16), t = k < 0 ? 0 : 255, a = Math.abs(k);
    const f = v => Math.round(v + (t - v) * a);
    return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
}

/** 夜に人物を描き直すとき、夜の暗さを重ねる */
let pxDk = false;

/** 夜の描き直しで「人物だけ」を描くとき真（pp の中だけ塗る。窓の描き直しで隠れたイベントの人物を手前に出す。v1.5.1〜） */
let pxOnlyPp = false, pxInPp = false;

/** 来店中のお客さん */
const PXC = [];

/** ドット文字を描く（1ドット＝論理1px） */
function pxText(x, y, t, c) {
    [...t].forEach((ch, i) => PXF[ch].forEach((r, j) => [...r].forEach((v, k) => {
        if (v === '1')
            Rc(x + i * 4 + k, y + j, 1, 1, c);
    })));
}

/** 小さなドット文字（3×5・実ピクセル）。OPEN／CLOSE の札に使う */
const PXG = {
    O: ['111', '101', '101', '101', '111'], P: ['111', '101', '111', '100', '100'], E: ['111', '100', '110', '100', '111'], N: ['111', '101', '101', '101', '101'],
    C: ['111', '100', '100', '100', '111'], L: ['100', '100', '100', '100', '111'], S: ['111', '100', '111', '001', '111']
};

/** 小さなドット文字を描く（実ピクセル座標。文字間1px） */
function pxTextP(x, y, t, c) {
    [...t].forEach((ch, i) => PXG[ch].forEach((r, j) => [...r].forEach((v, k) => {
        if (v === '1')
            Rp(x + i * 4 + k, y + j, 1, 1, c);
    })));
}

/** お客さんを来店させる */
function pxArrive(gs, bc) {
    const o = gs.map((g, i) => i).sort(() => Math.random() - .5);
    gs.forEach((g, i) => {
        if (PXC.length >= 14)
            return;
        const L = Math.random() < .5;
        PXC.push({
            x: L ? -6 : 198, L, g, bag: o.indexOf(i) < bc, st: 0, t: 0, sp: 0.8 + Math.random() * 0.7, c: Math.floor(Math.random() * 4)
        });
    });
}

/**
 * 人物を描く（実ピクセルで 10×約19。顔の表情つき）。x・y は論理座標（0.5刻みで動ける）
 * o.mood：'neutral'（ふつう）・'happy'（にこにこ・ほほ染め）・'meh'（がっかり）・'sad'（落ち込み・まゆと涙）
 * o.g：女性（長い髪・スカート）／o.bag：買い物袋／o.dir：左へ進む／o.down：うつむく
 * o.walk：歩きのコマ（0・1。足が交互に出る）／o.apron：エプロン（店員）／o.shades：サングラス
 */
function pp(x, y, b, o) {
    const inPp0 = pxInPp;
    pxInPp = true;
    o = o || {};
    const h = o.hair || '#3b2a20', sk = '#f1c27d', mood = o.mood || (o.sad ? 'sad' : 'neutral');
    const X = Math.round(x * 2), Y = Math.round(y * 2), d = o.dir ? -1 : 1;
    const R = (dx, dy, w, hh, c) => Rp(X + dx, Y + dy, w, hh, c);
    const legH = o.g ? 3 : 4, fy = o.g ? 16 : 13;
    // 足もとの影
    R(0, fy + legH + 1, 10, 1, 'rgba(0,0,0,.18)');
    // 足（歩くときは片足ずつ上げる）
    const lh = o.walk === 1 ? legH - 1 : legH, rh = o.walk === 0 ? legH - 1 : legH;
    const lc = o.g ? sk : '#2f3b52';
    R(o.g ? 3 : 2, fy, o.g ? 1 : 2, lh, lc);
    R(o.g ? 6 : 6, fy, o.g ? 1 : 2, rh, lc);
    R((o.g ? 3 : 2) + (d > 0 ? 0 : -1), fy + lh, o.g ? 2 : 3, 1, '#1a1a1a');
    R((o.g ? 6 : 6) + (d > 0 ? 0 : -1), fy + rh, o.g ? 2 : 3, 1, '#1a1a1a');
    // 服（スカートはすそが広がる）
    if (o.g)
        R(1, 13, 8, 3, shade(b, .12));
    R(2, 7, 6, 6, b);
    R(2, 7, 6, 1, shade(b, .22));
    // 腕と手
    R(1, 7, 1, 5, shade(b, -.18));
    R(8, 7, 1, 5, shade(b, -.18));
    R(1, 12, 1, 1, sk);
    R(8, 12, 1, 1, sk);
    if (o.apron) {
        R(3, 9, 4, 4, '#f6f6f2');
        R(4, 8, 2, 1, '#f6f6f2');
        R(4, 10, 2, 1, '#d9d9d2');
    }
    if (o.bag) {
        const bx = o.dir ? -3 : 10;
        R(bx + (o.dir ? 1 : 0), 8, 2, 1, '#8a6a2a');
        R(bx, 9, 3, 4, '#d9a441');
        R(bx, 9, 3, 1, '#ecc16a');
        R(bx + 1, 11, 1, 1, '#b8842a');
    }
    // 頭（うつむくときは頭を下げて、進む向きへ少し前に出す）
    const hx = o.down ? d : 0, hy = o.down ? 2 : 0;
    const H = (dx, dy, w, hh, c) => R(hx + dx, hy + dy, w, hh, c);
    if (o.g) {
        H(1, 1, 1, 8, h);
        H(8, 1, 1, 8, h);
    }
    H(2, 2, 6, 5, sk);
    H(o.g ? 1 : 2, 0, o.g ? 8 : 6, 2, h);
    H(2, 2, 1, o.g ? 2 : 1, h);
    H(7, 2, 1, o.g ? 2 : 1, h);
    if (o.g)
        H(3, 2, 2, 1, h);
    // 目・口・まゆ
    const ey = '#222';
    if (o.shades)
        H(2, 3, 6, 2, '#111');
    else {
        H(3, 3, 1, 1, ey);
        H(6, 3, 1, 1, ey);
    }
    if (mood === 'happy') {
        H(3, 4, 1, 1, '#f4a6a0');
        H(6, 4, 1, 1, '#f4a6a0');
        H(3, 5, 1, 1, '#b3382c');
        H(6, 5, 1, 1, '#b3382c');
        H(4, 6, 2, 1, '#b3382c');
    }
    else if (mood === 'sad') {
        H(3, 2, 1, 1, '#5a3a22');
        H(6, 2, 1, 1, '#5a3a22');
        H(4, 5, 2, 1, '#7a2e2e');
        H(3, 6, 1, 1, '#7a2e2e');
        H(6, 6, 1, 1, '#7a2e2e');
        H(3, 4, 1, 1, '#6ab4e8');
    }
    else if (mood === 'meh')
        H(4, 6, 2, 1, '#7a4a3a');
    else
        H(4, 5, 2, 1, '#9a5a4a');
    pxInPp = inPp0;
}

/** 窓・ドア・棚の商品を描く */
function pxLights(op, night) {
    const lit = op || night;
    [[52, 0], [108, 6]].forEach(([fx, s0]) => {
        Rr(fx, 41, 32, 19, '#2c6e5f', 1);
        Rc(fx + 1, 42, 30, 17, lit ? '#fff3c4' : '#a9dcf2');
        // 棚板
        Rc(fx + 1, 58, 30, 1, '#8a6a45');
        Rp(fx * 2 + 2, 116, 60, 1, '#b08a5a');
        for (let i = 0; i < 6; i++) {
            const s = state.shelf[s0 + i];
            if (!s)
                continue;
            // 在庫の量だけ箱が積み上がる（1箱＝実ピクセルで4の高さ）
            const h = s.st > 0 ? Math.max(3, Math.round(s.st / state.cap * 24)) : 0, bx = (fx + 3 + i * 5) * 2, c = COL[s.id];
            if (!h)
                continue;
            Rp(bx, 116 - h, 8, h, c);
            Rp(bx, 116 - h, 8, 1, shade(c, .35));
            Rp(bx + 7, 117 - h, 1, h - 1, shade(c, -.25));
            for (let k = 1; k * 4 < h; k++)
                Rp(bx, 116 - k * 4, 8, 1, shade(c, -.2));
            if (h >= 8)
                Rp(bx + 2, 116 - h + 3, 3, 2, 'rgba(255,255,255,.65)');
        }
        // ガラスの反射
        Rp(fx * 2 + 8, 86, 2, 12, 'rgba(255,255,255,.5)');
        Rp(fx * 2 + 12, 86, 1, 6, 'rgba(255,255,255,.4)');
    });
    Rr(88, 38, 16, 24, '#2c6e5f', 1);
    Rc(90, 40, 12, 22, lit ? '#ffe9a8' : '#86b9cf');
    Rc(95, 40, 2, 22, '#2c6e5f');
    Rc(99, 52, 1, 3, '#ddd');
    if (op)
        pp(92, 45, '#2fbf97', { apron: true, mood: 'happy' });
    // 札：営業中は OPEN、そのほかは CLOSE
    Rp(181, 82, 22, 8, op ? '#2fbf97' : '#ff7a68');
    Rp(181, 82, 22, 1, shade(op ? '#2fbf97' : '#ff7a68', .35));
    pxTextP(op ? 184 : 182, 84, op ? 'OPEN' : 'CLOSE', '#fff');
}

/** セキュリティを描く */
function pxSec() {
    const L = state.sl || 0;
    if (!L)
        return;
    const ss = state.ss || 0;
    cx.globalAlpha = ss > 0 ? 0.45 + 0.11 * ss : 0.18;
    if (L === 1) {
        Rc(86, 36, 3, 5, '#d62828');
        Rc(87, 34, 1, 2, '#e9c46a');
    }
    if (L === 2) {
        Rc(105, 40, 3, 9, '#f4f1de');
        Rc(106, 42, 1, 1, '#d62828');
        Rc(106, 45, 1, 1, '#d62828');
    }
    if (L === 3) {
        Rc(110, 53, 9, 9, '#5a3a22');
        Rc(111, 54, 7, 3, '#e9c46a');
        Rc(113, 58, 3, 3, '#e9c46a');
    }
    if (L === 4) {
        Rc(104, 28, 7, 4, '#8d99ae');
        Rc(105, 29, 1, 1, fr % 6 < 3 ? '#ff3b3b' : '#661111');
    }
    if (L === 5) {
        for (let i = 0; i < 4; i++)
            if ((fr + i) % 4 < 3)
                Rc(88, 44 + i * 5, 16, 1, '#ff2d2d');
    }
    if (L === 6) {
        Rc(89, 34, 8, 8, '#f1ece0');
        Rc(91, 37, 1, 1, '#222');
        Rc(94, 37, 1, 1, '#222');
        Rc(92, 40, 3, 1, '#b22');
    }
    if (L === 7)
        pp(108, 57, '#1d3557', { hair: '#222' });
    if (L === 8) {
        pp(108, 57, '#1d3557');
        pp(115, 57, '#1d3557');
        pp(122, 57, '#1d3557');
    }
    if (L === 9) {
        pp(108, 57, '#6c584c', { hair: '#222', shades: true });
    }
    if (L === 10) {
        Rc(93, 12, 10, 5, '#444');
        Rc(96, 9, 4, 3, '#888');
        if (fr % 8 < 3)
            Rc(97, 17, 2, 45, 'rgba(255,40,40,.7)');
    }
    cx.globalAlpha = 1;
}

/** 赤い空を横切るカラス（3羽。羽ばたきは2コマ） */
function pxCrows(W) {
    for (let k = 0; k < 3; k++) {
        const x = W + 20 - ((fr * (1.1 + k * 0.3) + k * 70) % (W + 50)), y = 8 + k * 9 + (((fr >> 1) + k) % 6 < 3 ? 0 : 1), up = ((fr >> 1) + k) % 2;
        Rc(x, y, 4, 2, '#151015');
        Rc(x - 1, y, 1, 1, '#151015');
        Rc(x + 1, y + (up ? -2 : 2), 2, 2, '#151015');
        Rc(x + 4, y + 1, 2, 1, '#151015');
    }
}

/** 角を丸めた四角形（論理座標。r＝角を削る段数。ドットの味を残した丸み。v2.0.0〜） */
function Rr(x, y, w, h, c, r) {
    r = Math.min(r == null ? 1 : r, Math.floor(w / 2), Math.floor(h / 2));
    for (let i = 0; i < r; i++) {
        const k = r - i;
        Rc(x + k, y + i, w - k * 2, 1, c);
        Rc(x + k, y + h - 1 - i, w - k * 2, 1, c);
    }
    Rc(x, y + r, w, h - r * 2, c);
}

/** 丸い木（v2.0.0〜。季節で色が変わる。冬は枝に雪） */
function pxTree(x, se) {
    Rc(x + 7, 44, 3, 18, '#7a5a44');
    Rc(x + 8, 44, 1, 18, '#93705a');
    if (se === 3) {
        Rc(x + 2, 38, 13, 2, '#7a5a44');
        Rc(x + 8, 30, 2, 10, '#7a5a44');
        Rc(x + 4, 33, 2, 6, '#7a5a44');
        Rc(x + 12, 33, 2, 6, '#7a5a44');
        Rr(x + 1, 36, 16, 3, '#ffffff', 1);
        Rr(x + 6, 29, 6, 2, '#ffffff', 1);
        return;
    }
    const c = [['#ffb8d2', '#f48fb5', '#ffe0ec'], ['#5fcf86', '#3fae69', '#a6efbf'], ['#ffa25c', '#ee7d3b', '#ffd0a6']][se];
    Rr(x, 28, 18, 18, c[0], 4);
    Rr(x + 3, 37, 15, 9, c[1], 3);
    Rr(x + 3, 30, 6, 4, c[2], 1);
}

/** 背景（空・雲・街並み・地面・道路・車・木・街灯・お店の建物）を描く（v2.0.0〜 ミント×コーラルの色で描き直し。位置は v1.x と同じ） */
function pxScene(W, se, wt, night, bad) {
    // 空：なめらかなグラデーション（マイナスのイベントの日は閉店まで赤い空。v1.4.1〜）
    const sk = bad ? ['#8e1b2c', '#d8463e', '#f7a072'] : [['#4fb3f0', '#8fd3f7', '#e3f6ff'], ['#9fb4c4', '#c6d4de', '#eef2f5'], ['#6c7a88', '#8d9aa6', '#b9c2ca'], ['#b8c7d4', '#d6e0e8', '#f5f8fb']][wt];
    const g = cx.createLinearGradient(0, 0, 0, 124);
    g.addColorStop(0, sk[0]);
    g.addColorStop(.55, sk[1]);
    g.addColorStop(1, sk[2]);
    cx.fillStyle = g;
    cx.fillRect(0, 0, PXW, 124);
    if (wt === 0 && !bad) {
        if (night) {
            Rr(158, 6, 8, 8, '#fff4c8', 2);
            Rr(161, 6, 5, 6, sk[0], 2);
        }
        else {
            // 太陽：やわらかい光の輪
            const sg = cx.createRadialGradient(326, 22, 4, 326, 22, 30);
            sg.addColorStop(0, 'rgba(255,236,150,.9)');
            sg.addColorStop(1, 'rgba(255,236,150,0)');
            cx.fillStyle = sg;
            cx.fillRect(290, 0, 72, 56);
            Rr(158, 6, 10, 10, se === 1 ? '#ffb43a' : '#ffd95a', 3);
            Rr(160, 7, 4, 3, '#fff3b8', 1);
        }
    }
    // 雲：丸みのある形（晴れの日も2つだけ浮かべる）
    {
        const n = wt > 0 ? 4 : 2, cc = wt === 2 ? '#7d8a96' : '#ffffff', cs = wt === 2 ? '#6a7682' : '#e2eef6';
        for (let k = 0; k < n; k++) {
            const x = ((fr * 0.25 + k * (wt > 0 ? 60 : 110)) % (W + 40)) - 24, y = 6 + k * (wt > 0 ? 7 : 9);
            Rr(x, y, 24, 6, cc, 2);
            Rr(x + 5, y - 3, 11, 6, cc, 2);
            Rr(x + 12, y - 1, 8, 5, cc, 2);
            Rc(x + 3, y + 5, 18, 1, cs);
        }
    }
    if (bad)
        pxCrows(W);
    // 遠くの丘と街並み（パステルの色）
    Rr(-10, 46, 70, 24, bad ? '#c76a5e' : '#bfe8d6', 8);
    Rr(130, 44, 80, 26, bad ? '#b95c52' : '#a9dfc8', 8);
    [[0, 14, 10, '#9ec7e0'], [12, 22, 14, '#b8b2e3'], [28, 16, 10, '#9fd8cc'], [150, 18, 12, '#b8b2e3'], [164, 26, 16, '#9ec7e0'], [182, 14, 10, '#9fd8cc']].forEach(([x, h, w, c]) => {
        Rr(x, 62 - h, w, h + 2, c, 1);
        Rc(x + 1, 62 - h, w - 2, 1, shade(c, .3));
        for (let j = 0; j < h - 5; j += 4)
            for (let i = 2; i < w - 2; i += 4)
                Rc(x + i, 62 - h + 3 + j, 2, 2, night ? '#ffe9a8' : shade(c, .45));
    });
    // 植え込み・歩道・道路
    const gr = [['#8fde8a', '#6cc56c'], ['#4fc46e', '#38a656'], ['#d6b25a', '#bf9646'], ['#f4f8fb', '#dde7ee']][se];
    Rr(0, 54, 48, 9, gr[0], 2);
    Rr(146, 54, 46, 9, gr[0], 2);
    Rc(0, 60, 48, 2, gr[1]);
    Rc(146, 60, 46, 2, gr[1]);
    Rc(0, 62, W, 6, '#efe4d2');
    Rc(0, 62, W, 1, '#fff6e6');
    for (let x = 0; x < W; x += 8)
        Rc(x, 63, 1, 5, '#dccdb6');
    Rc(0, 67, W, 1, '#cbb99e');
    Rc(0, 68, W, 24, '#4b5662');
    Rc(0, 68, W, 2, '#5c6875');
    for (let x = 0; x < W; x += 32)
        Rr(x, 79.5, 16, 1.5, '#f6e7b8', 0);
    {
        // 車（丸みのあるパステルの車）
        const cxp = ((fr * 1.6) % 260) - 40, ci = Math.floor(fr * 1.6 / 260) % 3, cc = ['#ff7a68', '#2fbf97', '#ffc94d'][ci];
        Rr(cxp, 74, 21, 6, cc, 1);
        Rr(cxp + 4, 70.5, 12, 5, cc, 1);
        Rc(cxp + 5.5, 71.5, 4, 3, '#d6f1ff');
        Rc(cxp + 10.5, 71.5, 4, 3, '#d6f1ff');
        Rc(cxp + 1, 75, 19, 1, shade(cc, .3));
        Rc(cxp + 19, 75.5, 2, 1.5, '#fff6c8');
        Rr(cxp + 2.5, 78.5, 5, 4, '#2a2f36', 1);
        Rr(cxp + 13.5, 78.5, 5, 4, '#2a2f36', 1);
        Rc(cxp + 4.5, 80, 1, 1, '#9aa4ae');
        Rc(cxp + 15.5, 80, 1, 1, '#9aa4ae');
    }
    pxTree(4, se);
    pxTree(172, se);
    if (se === 0 || se === 2)
        for (let i = 0; i < 8; i++)
            Rp((i * 27 + fr * 0.5) % W * 2, (i * 13 + fr * 0.8) % 66 * 2, 2, 2, se ? '#ffa25c' : '#ffc4da');
    // 街灯（ミントの柱と丸い明かり）
    Rc(40, 38, 2, 24, '#2c6e5f');
    Rc(36, 36, 10, 2, '#2c6e5f');
    Rr(35, 37, 4, 3, night ? '#fff1b0' : '#e8f7f1', 1);
    // お店の建物：ミントの屋根・クリームの壁・腰板
    Rr(45, 19, 102, 7, '#23806a', 1);
    Rc(46, 19, 100, 1, '#3fb596');
    Rc(48, 26, 96, 36, '#fff4e3');
    for (let x = 52; x < 144; x += 6)
        Rc(x, 40, 1, 16, '#f5e6cf');
    Rc(48, 56, 96, 6, '#2fbf97');
    Rc(48, 56, 96, 1, '#5fd9b5');
    for (let x = 50; x < 144; x += 4)
        Rc(x, 58, 2, 1, '#28a888');
    Rc(140, 26, 4, 36, 'rgba(31,58,53,.08)');
    // 看板：コーラルの丸い看板に白い文字
    Rr(75, 9, 42, 13, '#c9443a', 2);
    Rr(76, 9, 40, 12, '#ff7a68', 2);
    Rc(78, 10, 36, 1, '#ffab9e');
    pxText(88, 13, 'SHOP', '#ffffff');
    // 日よけ：コーラルと白のしましま、すそは波形
    for (let i = 0; i < 16; i++) {
        const c = i % 2 ? '#fffaf2' : '#ff7a68';
        Rc(48 + i * 6, 29, 6, 7, c);
        Rc(48.5 + i * 6, 36, 5, 1, c);
        Rc(49.5 + i * 6, 37, 3, 1, c);
    }
    Rc(48, 29, 96, 1, 'rgba(255,255,255,.55)');
    Rc(48, 38, 96, 2, 'rgba(31,58,53,.18)');
    // 入口のわきの植木鉢
    [[46, 56], [141, 56]].forEach(([x, y]) => {
        Rr(x, y + 2, 5, 4, '#e0855f', 1);
        Rr(x - 0.5, y - 2, 6, 5, se === 3 ? '#f4f8fb' : '#3fae69', 2);
        Rc(x + 1.5, y - 1, 1, 1, '#ffb8d2');
    });
}

/** ドット絵の描画（1フレーム） */
function drawPx() {
    const W = 192, H = 92, se = seaOf(Math.max(state.day, 1)), wt = state.weather, op = state.phase === 'open';
    const hr = op ? state.openH + Math.floor(state.t / 5) : (state.phase === 'prep' ? state.openH : 21), night = hr >= 19 || hr < 6;
    const bad = badDay();
    pxScene(W, se, wt, night, bad);
    pxLights(op, night);
    pxSec();
    if (state.kama)
        pxKama();
    pxFxShop();
    const k = (op ? (state.spd || 1) : 1) * (badDay() ? 0.6 : 1);
    for (const c of PXC) {
        if (c.st === 0) {
            const dx = 93 - c.x;
            if (Math.abs(dx) <= c.sp * k + 1) {
                c.x = 93;
                c.st = 1;
                c.t = 8;
            }
            else
                c.x += Math.sign(dx) * c.sp * k;
        }
        else if (c.st === 1) {
            if ((c.t -= k) <= 0) {
                c.st = 2;
                c.L = Math.random() < .5;
            }
        }
        else {
            c.x += (c.L ? -1 : 1) * c.sp * k;
            if (c.x < -8 || c.x > 200)
                c.dead = 1;
        }
    }
    for (let i = PXC.length; i--;)
        if (PXC[i].dead)
            PXC.splice(i, 1);
    pxPeople(op);
    pxFxTop();
    cv.classList.toggle('quake', fxList().includes('quake'));
    if (wt === 2)
        for (let i = 0; i < 70; i++)
            Rp((i * 37 + fr * 2) % W * 2, (i * 23 + fr * 6) % H * 2, 1, 5, '#7ab8ea');
    if (wt === 3) {
        for (let i = 0; i < 70; i++)
            Rp((i * 29 + Math.sin((fr + i * 9) / 9) * 3 + W) % W * 2, (i * 17 + fr) % H * 2, i % 3 ? 1 : 2, i % 3 ? 1 : 2, '#fff');
        Rc(0, 62, W, 2, '#f4f8fb');
        // 屋根の雪（看板の部分はよける）
        Rc(46, 18, 29, 2, '#fff');
        Rc(117, 18, 29, 2, '#fff');
        Rr(76, 8, 40, 2, '#fff', 1);
    }
    if (night) {
        cx.fillStyle = 'rgba(18,20,70,0.48)';
        cx.fillRect(0, 0, PXW, PXH);
        if (wt === 0)
            for (let i = 0; i < 14; i++)
                Rp((i * 47) % W * 2, (i * 13) % 24 * 2, i % 3 ? 1 : 2, i % 3 ? 1 : 2, '#fff');
        Rc(30, 38, 18, 24, 'rgba(255,233,168,.2)');
        Rc(37, 37, 8, 2, '#ffe9a8');
        pxLights(op, true);
        // 夜は看板に明かりをともす（v2.0.0〜）
        Rr(76, 9, 40, 12, 'rgba(255,122,104,.55)', 2);
        pxText(88, 13, 'SHOP', '#fff6e0');
        pxDk = true;
        pxPeople(op);
        // 窓・ドアの描き直しで隠れた、イベントの人物（行列・泥棒など）を手前に描き直す。窓のステッカーも描き直す（v1.5.1）
        pxOnlyPp = true;
        pxFxTop();
        pxOnlyPp = false;
        pxDk = false;
        pxFxPay();
    }
}

/** かまくらボーナスの日：店の前のかまくらと甘酒の鍋 */
function pxKama() {
    Rc(150, 46, 26, 16, '#ffffff');
    Rc(153, 42, 20, 4, '#ffffff');
    Rc(157, 39, 12, 3, '#ffffff');
    Rc(150, 61, 26, 1, '#cfd8e0');
    Rc(158, 51, 10, 11, '#3b4a5a');
    Rc(159, 53, 8, 9, '#ffb347');
    if (state.kama === 1)
        pp(144 + (fr % 8 < 4 ? 0 : 0.5), 52, '#ffd23f', { apron: true, mood: 'happy' });
    else {
        Rc(130, 57, 8, 5, '#555');
        Rc(131, 54 - (fr % 6 < 3 ? 1 : 0), 1, 3, 'rgba(255,255,255,.8)');
        Rc(135, 53 - (fr % 6 < 3 ? 0 : 1), 1, 3, 'rgba(255,255,255,.8)');
    }
}

/** お客さんと店員を描く（夜は窓の明かりより手前に描き直す）。表情：買えて帰る客はにこにこ、買えずに帰る客はがっかり、マイナスのイベントの日は落ち込み */
function pxPeople(op) {
    const bd = badDay();
    PXC.forEach(c => {
        if (c.st === 1)
            return;
        const wk = Math.floor((fr + Math.floor(c.x)) / 2) % 2, mood = bd ? 'sad' : (c.st === 2 ? (c.bag ? 'happy' : 'meh') : 'neutral');
        pp(c.x, 56 + (wk ? 0.5 : 0), bd ? '#6b6f78' : (c.g ? FP : MP)[c.c], { g: c.g, hair: (c.g ? FH : MH)[c.c], bag: c.bag && c.st === 2, dir: c.L, down: bd, mood, walk: wk });
    });
    const n = Math.min(state.clerk, 12), e = eff(), pal = ['#2b7fd1', '#e86a5c', '#4caf72', '#8e5bd1'];
    for (let i = 0; i < n; i++) {
        const sad = e < 0 || state.dn > 0;
        pp(8 + i * 14.8, 57 + (op && ((fr >> 1) + i) % 4 < 2 ? 0.5 : 0), e < 0 ? '#7a2e2e' : (state.dn > 0 ? '#7f8c99' : pal[i % 4]), { mood: sad ? 'sad' : (op ? 'happy' : 'neutral'), apron: !sad });
    }
}
