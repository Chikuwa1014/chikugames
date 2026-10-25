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
        Rc(fx, 41, 32, 19, '#3f332b');
        Rc(fx + 1, 42, 30, 17, lit ? '#fff3c4' : '#8fbfd9');
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
    Rc(88, 38, 16, 24, '#3f332b');
    Rc(90, 40, 12, 22, lit ? '#ffe9a8' : '#6b8296');
    Rc(95, 40, 2, 22, '#3f332b');
    Rc(99, 52, 1, 3, '#ddd');
    if (op)
        pp(92, 45, '#ffd23f', { apron: true, mood: 'happy' });
    // 札：営業中は OPEN、そのほかは CLOSE
    Rp(181, 82, 22, 8, op ? '#2a9d8f' : '#e63946');
    Rp(181, 82, 22, 1, shade(op ? '#2a9d8f' : '#e63946', .35));
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

/** ドット絵の描画（1フレーム） */
function drawPx() {
    const W = 192, H = 92, se = seaOf(Math.max(state.day, 1)), wt = state.weather, op = state.phase === 'open';
    const hr = op ? state.openH + Math.floor(state.t / 5) : (state.phase === 'prep' ? state.openH : 21), night = hr >= 19 || hr < 6;
    const bad = badDay();
    // マイナスのイベントがあった日は、閉店（翌日）まで空を赤く（v1.4.1〜）
    (bad ? '#7a1010,#a01818,#c42a22,#d8462e,#e4643c,#ee8a5a' : ['#5aa9f0,#8cc6f7,#b6dcfb,#d4ecfd,#e6f4fe,#f2faff', '#9aa6b0,#b0bac2,#c3cbd2,#d1d7dc,#dde2e6,#e8ebee', '#69737d,#7a858f,#8a949d,#99a2aa,#a8b0b7,#b5bcc2', '#c8d3dc,#d3dce4,#dde5ec,#e6ecf1,#eef2f6,#f4f7fa'][wt]).split(',').forEach((c, i) => Rc(0, i * 10, W, 10, c));
    if (wt === 0 && !bad) {
        if (night)
            Rc(160, 8, 6, 6, '#f5f0c8');
        else {
            Rc(158, 6, 10, 10, se === 1 ? '#ffb300' : '#ffd54a');
            Rc(155, 10, 16, 2, 'rgba(255,230,120,.4)');
            Rc(162, 3, 2, 16, 'rgba(255,230,120,.4)');
        }
    }
    if (wt > 0) {
        const cc = wt === 2 ? '#6f7b87' : '#fff';
        for (let k = 0; k < 4; k++) {
            const x = ((fr * 0.25 + k * 60) % (W + 40)) - 24, y = 6 + k * 7;
            Rc(x, y, 22, 5, cc);
            Rc(x + 5, y - 3, 12, 4, cc);
            Rc(x + 2, y + 4, 18, 1, 'rgba(0,0,0,.08)');
        }
    }
    if (bad)
        pxCrows(W);
    [[0, 14, 10], [12, 22, 14], [28, 16, 10], [150, 18, 12], [164, 26, 16], [182, 14, 10]].forEach(([x, h, w]) => {
        Rc(x, 62 - h, w, h, '#8ea4b8');
        for (let j = 0; j < h - 4; j += 4)
            Rc(x + 2, 62 - h + 3 + j, 2, 2, '#aebfcf');
    });
    const gr = ['#8fd16a', '#4fae4a', '#c9a14a', '#f4f8fb'][se];
    Rc(0, 54, 48, 8, gr);
    Rc(146, 54, 46, 8, gr);
    Rc(0, 62, W, 6, '#cfcab9');
    for (let x = 0; x < W; x += 12)
        Rc(x, 62, 1, 6, '#b8b3a1');
    Rc(0, 68, W, 24, '#5d636b');
    Rc(0, 68, W, 1, '#8a8f98');
    for (let x = 0; x < W; x += 32)
        Rc(x, 80, 16, 1, '#e9e2b4');
    {
        const cxp = ((fr * 1.6) % 260) - 40, ci = Math.floor(fr * 1.6 / 260) % 3, cc = ['#d62828', '#2a6fdb', '#e9c46a'][ci];
        Rc(cxp, 74, 20, 6, cc);
        Rc(cxp + 4, 71, 11, 4, cc);
        Rc(cxp + 5, 72, 4, 3, '#bfe3f5');
        Rc(cxp + 10, 72, 4, 3, '#bfe3f5');
        Rc(cxp + 3, 79, 4, 3, '#222');
        Rc(cxp + 13, 79, 4, 3, '#222');
    }
    [4, 172].forEach(x => {
        Rc(x + 7, 46, 3, 16, '#5b3f28');
        Rc(x + 8, 46, 1, 16, '#74513a');
        if (se === 3) {
            Rc(x + 1, 40, 16, 2, '#5b3f28');
            Rc(x + 8, 32, 2, 10, '#5b3f28');
            Rc(x + 3, 34, 2, 6, '#5b3f28');
            Rc(x + 13, 34, 2, 6, '#5b3f28');
            Rc(x + 1, 39, 16, 1, '#fff');
        }
        else {
            const c = [['#f4a6c6', '#e58bb0'], ['#3f9e44', '#2f7d34'], ['#e07b2d', '#c45e1a']][se];
            Rc(x, 32, 18, 14, c[0]);
            Rc(x + 2, 28, 14, 5, c[0]);
            Rc(x + 2, 40, 16, 6, c[1]);
            Rc(x + 10, 32, 6, 8, c[1]);
        }
    });
    if (se === 0 || se === 2)
        for (let i = 0; i < 8; i++)
            Rp((i * 27 + fr * 0.5) % W * 2, (i * 13 + fr * 0.8) % 66 * 2, 2, 2, se ? '#e07b2d' : '#f7b6d2');
    Rc(40, 38, 2, 24, '#2f2f2f');
    Rc(36, 36, 10, 3, '#2f2f2f');
    Rc(46, 20, 100, 6, '#5b4a3f');
    Rc(46, 20, 100, 1, '#7a6657');
    Rc(48, 26, 96, 36, '#b95c3e');
    for (let y = 28, r = 0; y < 62; y += 3, r++) {
        Rc(48, y, 96, 1, '#9c4a31');
        for (let x = 48 + (r % 2) * 4; x < 144; x += 8)
            Rc(x, y + 1, 1, 2, '#9c4a31');
    }
    Rc(140, 26, 4, 36, 'rgba(0,0,0,.12)');
    Rc(76, 10, 40, 12, '#1f3a5f');
    Rc(76, 10, 40, 1, '#e9c46a');
    Rc(76, 21, 40, 1, '#e9c46a');
    pxText(88, 13, 'SHOP', '#ffd23f');
    for (let i = 0; i < 16; i++) {
        const c = i % 2 ? '#f4f1de' : '#d62828';
        Rc(48 + i * 6, 30, 6, 6, c);
        Rc(48 + i * 6, 36, 6, 1, c);
        Rc(49 + i * 6, 37, 4, 1, c);
    }
    Rc(48, 38, 96, 2, 'rgba(0,0,0,.25)');
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
        Rc(46, 18, 100, 2, '#fff');
    }
    if (night) {
        cx.fillStyle = 'rgba(8,16,48,0.5)';
        cx.fillRect(0, 0, PXW, PXH);
        if (wt === 0)
            for (let i = 0; i < 14; i++)
                Rp((i * 47) % W * 2, (i * 13) % 24 * 2, i % 3 ? 1 : 2, i % 3 ? 1 : 2, '#fff');
        Rc(30, 38, 18, 24, 'rgba(255,233,168,.2)');
        Rc(37, 37, 8, 2, '#ffe9a8');
        pxLights(op, true);
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
