/**
 * pixel.js — ドット絵の描画。
 */

/** ドット絵のキャンバス */
const cv = byId('px');

/** 描画コンテキスト */
const cx = cv.getContext('2d');

/** アニメーションのフレーム数 */
let fr = 0;

/** 四角形を塗る */
const Rc = (x, y, w, h, c) => {
    cx.fillStyle = c;
    cx.fillRect(Math.round(x), Math.round(y), w, h);
    if (pxDk) {
        cx.fillStyle = 'rgba(8,16,48,0.5)';
        cx.fillRect(Math.round(x), Math.round(y), w, h);
    }
};

/** 夜に人物を描き直すとき、夜の暗さを重ねる */
let pxDk = false;

/** 来店中のお客さん */
const PXC = [];

/** ドット文字を描く */
function pxText(x, y, t, c) {
    [...t].forEach((ch, i) => PXF[ch].forEach((r, j) => [...r].forEach((v, k) => {
        if (v === '1')
            Rc(x + i * 4 + k, y + j, 1, 1, c);
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

/** 人物を描く */
function pp(x, y, b, o) {
    o = o || {};
    const h = o.hair || '#3b2a20';
    x = Math.round(x);
    y = Math.round(y);
    // うつむく（マイナスのイベントの日のお客さん）：頭を1つ下げ、進む向きへ少し前に出す
    const hx = x + 1 + (o.down ? (o.dir ? -1 : 1) : 0), hy = y + (o.down ? 1 : 0);
    Rc(hx, hy, 3, 3, '#f1c27d');
    Rc(hx, hy, 3, o.down ? 2 : 1, h);
    if (o.g)
        Rc(x, y + 1, 1, 3, h);
    Rc(x, y + 3, 5, 4, b);
    if (o.g)
        Rc(x, y + 7, 5, 2, b);
    const ly = y + (o.g ? 9 : 7);
    Rc(x + 1, ly, 1, 2, '#2a2a2a');
    Rc(x + 3, ly, 1, 2, '#2a2a2a');
    if (o.sad)
        Rc(x + 2, y + 2, 1, 1, '#7a2e2e');
    if (o.bag)
        Rc(x + (o.dir ? -2 : 5), y + 5, 2, 3, '#d9a441');
}

/** 窓・ドア・棚の商品を描く */
function pxLights(op, night) {
    const lit = op || night;
    [[52, 0], [108, 6]].forEach(([fx, s0]) => {
        Rc(fx, 41, 32, 19, '#3f332b');
        Rc(fx + 1, 42, 30, 17, lit ? '#fff3c4' : '#8fbfd9');
        for (let i = 0; i < 6; i++) {
            const s = state.shelf[s0 + i];
            if (!s)
                continue;
            const h = s.st > 0 ? Math.max(2, Math.round(s.st / state.cap * 12)) : 0;
            Rc(fx + 3 + i * 5, 58 - h, 4, h, COL[s.id]);
        }
        Rc(fx + 1, 50, 30, 1, '#8a6a45');
        Rc(fx + 1, 55, 30, 1, '#8a6a45');
        Rc(fx + 3, 43, 1, 6, 'rgba(255,255,255,.5)');
    });
    Rc(88, 38, 16, 24, '#3f332b');
    Rc(90, 40, 12, 22, lit ? '#ffe9a8' : '#6b8296');
    Rc(95, 40, 2, 22, '#3f332b');
    Rc(99, 52, 1, 3, '#ddd');
    if (op)
        pp(92, 45, '#ffd23f');
    Rc(93, 41, 6, 3, op ? '#2a9d8f' : '#e63946');
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
        pp(108, 57, '#6c584c', { hair: '#222' });
        Rc(109, 58, 3, 1, '#111');
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
            Rc((i * 27 + fr * 0.5) % W, (i * 13 + fr * 0.8) % 66, 1, 1, se ? '#e07b2d' : '#f7b6d2');
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
    if (wt === 2)
        for (let i = 0; i < 70; i++)
            Rc((i * 37 + fr * 2) % W, (i * 23 + fr * 6) % H, 1, 3, '#7ab8ea');
    if (wt === 3) {
        for (let i = 0; i < 70; i++)
            Rc((i * 29 + Math.sin((fr + i * 9) / 9) * 3 + W) % W, (i * 17 + fr) % H, 1, 1, '#fff');
        Rc(0, 62, W, 2, '#f4f8fb');
        Rc(46, 18, 100, 2, '#fff');
    }
    if (night) {
        cx.fillStyle = 'rgba(8,16,48,0.5)';
        cx.fillRect(0, 0, W, H);
        if (wt === 0)
            for (let i = 0; i < 14; i++)
                Rc((i * 47) % W, (i * 13) % 24, 1, 1, '#fff');
        Rc(30, 38, 18, 24, 'rgba(255,233,168,.2)');
        Rc(37, 37, 8, 2, '#ffe9a8');
        pxLights(op, true);
        pxDk = true;
        pxPeople(op);
        pxDk = false;
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
        pp(144 + (fr % 8 < 4 ? 0 : 1), 52, '#ffd23f');
    else {
        Rc(130, 57, 8, 5, '#555');
        Rc(131, 54 - (fr % 6 < 3 ? 1 : 0), 1, 3, 'rgba(255,255,255,.8)');
        Rc(135, 53 - (fr % 6 < 3 ? 0 : 1), 1, 3, 'rgba(255,255,255,.8)');
    }
}

/** お客さんと店員を描く（夜は窓の明かりより手前に描き直す） */
function pxPeople(op) {
    PXC.forEach(c => {
        if (c.st !== 1)
            pp(c.x, 56 + ((fr + Math.floor(c.x)) % 4 < 2 ? 0 : 1), badDay() ? '#6b6f78' : (c.g ? FP : MP)[c.c], { g: c.g, hair: (c.g ? FH : MH)[c.c], bag: c.bag && c.st === 2, dir: c.L, down: badDay() });
    });
    const n = Math.min(state.clerk, 12), e = eff(), pal = ['#2b7fd1', '#e86a5c', '#4caf72', '#8e5bd1'];
    for (let i = 0; i < n; i++) {
        const sad = e < 0 || state.dn > 0;
        pp(8 + i * 14.8, 57 + (op && ((fr >> 1) + i) % 4 < 2 ? 1 : 0), e < 0 ? '#7a2e2e' : (state.dn > 0 ? '#7f8c99' : pal[i % 4]), { sad });
    }
}
