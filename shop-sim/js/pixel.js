/**
 * pixel.js — ドット絵の描画。
 * v1.4.3〜：キャンバスは 384×184（従来の 192×92 の縦横2倍）。
 * 座標は従来どおり「論理座標（192×92）」で書き、`Rc` が2倍にして塗る（0.5刻みの位置も使える）。
 * 人物・商品など細かく描きたいものだけ、実ピクセル（384×184）で塗る `Rp` を使う。
 * v2.0.0〜：キャンバスの実体は 768×368（さらに2倍）。全体を2倍に拡大して描くので、Rc・Rp はそのまま使える。
 * 人物の顔・建物の模様など、もっと細かく描くものは「細ピクセル」（768×368。論理座標の4倍）で塗る `Rq` を使う。
 */

/** ドット絵のキャンバス */
const cv = byId('px');

/** 描画コンテキスト */
const cx = cv.getContext('2d');
cx.setTransform(2, 0, 0, 2, 0, 0);

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

/** 四角形を塗る（細ピクセル座標。768×368。v2.0.0〜） */
const Rq = (x, y, w, h, c) => {
    if (pxOnlyPp && !pxInPp)
        return;
    x = Math.round(x) / 2;
    y = Math.round(y) / 2;
    cx.fillStyle = c;
    cx.fillRect(x, y, w / 2, h / 2);
    if (pxDk) {
        cx.fillStyle = 'rgba(8,16,48,0.5)';
        cx.fillRect(x, y, w / 2, h / 2);
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
 * 人物を描く（v2.0.0〜 細ピクセルで 20×約38。顔を少し大きくして表情を増やした）。x・y は論理座標（0.5刻みで動ける）
 * o.mood：'neutral'（ふつう・ときどきまばたき）・'happy'（にっこり・ほほ染め）・'joy'（大よろこび・キラキラ目）・'meh'（がっかり・汗）・
 *   'sad'（落ち込み・まゆと涙）・'wow'（おどろき）・'sleepy'（ねむい・Zz）・'angry'（おこり）・'smug'（にやり・ウインク）
 * o.g：女性（長い髪・スカート）／o.bag：買い物袋／o.dir：左へ進む／o.down：うつむく
 * o.walk：歩きのコマ（0・1。足が交互に出る）／o.apron：エプロン（店員）／o.shades：サングラス
 */
function pp(x, y, b, o) {
    const inPp0 = pxInPp;
    pxInPp = true;
    o = o || {};
    const h = o.hair || '#3b2a20', sk = '#f6cf98', sk2 = '#e3ad74', mood = o.mood || (o.sad ? 'sad' : 'neutral');
    const X = Math.round(x * 4), Y = Math.round(y * 4), d = o.dir ? -1 : 1, seed = Math.abs(Math.round(x * 7 + y * 3));
    const R = (dx, dy, w, hh, c) => Rq(X + dx, Y + dy, w, hh, c);
    const bt = o.g ? 40 : 36;
    // 足もとの影
    R(1, bt - 2, 18, 2, 'rgba(0,0,0,.16)');
    // 足（歩くときは片足ずつ上げる）
    const ly = o.g ? 31 : 27, lh = bt - 2 - ly - 2;
    const l1 = o.walk === 1 ? 2 : 0, l2 = o.walk === 0 ? 2 : 0;
    const lc = o.g ? sk : '#33415c';
    R(o.g ? 6 : 5, ly, o.g ? 3 : 4, lh - l1, lc);
    R(o.g ? 11 : 11, ly, o.g ? 3 : 4, lh - l2, lc);
    if (!o.g) {
        R(5, ly, 1, lh - l1, '#283349');
        R(11, ly, 1, lh - l2, '#283349');
    }
    R((o.g ? 5 : 4) + (d > 0 ? 1 : -1), ly + lh - l1, 5, 2, '#26221f');
    R(11 + (d > 0 ? 0 : -1), ly + lh - l2, 5, 2, '#26221f');
    // 服（スカートはすそが広がる）
    const b2 = shade(b, -.2);
    if (o.g) {
        R(3, 24, 14, 6, shade(b, .1));
        R(2, 28, 16, 3, shade(b, .1));
        R(2, 30, 16, 1, shade(b, -.12));
        for (let i = 5; i < 16; i += 4)
            R(i, 26, 1, 4, shade(b, -.05));
    }
    R(4, 15, 12, o.g ? 10 : 13, b);
    R(4, 15, 12, 2, shade(b, .25));
    R(8, 15, 4, 2, sk);
    R(9, 17, 2, 1, sk2);
    if (!o.g) {
        R(4, 25, 12, 3, b2);
        R(9, 26, 2, 1, '#e0c070');
    }
    // 腕と手
    R(2, 16, 2, 9, b2);
    R(16, 16, 2, 9, b2);
    R(2, 25, 2, 2, sk);
    R(16, 25, 2, 2, sk);
    if (o.apron) {
        R(6, 19, 8, 9, '#fbfaf5');
        R(7, 16, 1, 3, '#fbfaf5');
        R(12, 16, 1, 3, '#fbfaf5');
        R(8, 22, 4, 2, '#e4e2d8');
        R(6, 27, 8, 1, '#d9d7cc');
        R(9, 20, 2, 1, PXT.r);
    }
    if (o.bag) {
        const bx = o.dir ? -6 : 20;
        R(bx + 1, 15, 1, 4, '#8a6a2a');
        R(bx + 4, 15, 1, 4, '#8a6a2a');
        R(bx + 2, 14, 2, 1, '#8a6a2a');
        R(bx, 18, 6, 9, '#e0ad4b');
        R(bx, 18, 6, 2, '#f2cd7a');
        R(bx + 5, 20, 1, 7, '#b8842a');
        R(bx + 2, 22, 2, 2, '#fff3cc');
    }
    // 頭（うつむくときは頭を下げて、進む向きへ少し前に出す）
    const hx = o.down ? d * 2 : 0, hy = o.down ? 3 : 0;
    const H = (dx, dy, w, hh, c) => R(hx + dx, hy + dy, w, hh, c);
    if (o.g) {
        H(2, 3, 2, 15, h);
        H(16, 3, 2, 15, h);
        H(2, 16, 2, 2, shade(h, -.2));
        H(16, 16, 2, 2, shade(h, -.2));
    }
    // 顔（12×12。角を丸める）
    H(4, 3, 12, 11, sk);
    H(5, 14, 10, 1, sk);
    H(3, 7, 1, 3, sk);
    H(16, 7, 1, 3, sk);
    H(5, 14, 10, 1, sk2);
    // 髪（前髪のすきまで向きが分かる）
    H(4, 0, 12, 3, h);
    H(5, -1, 10, 1, h);
    H(3, 1, 14, 3, h);
    H(3, 4, 1, o.g ? 4 : 2, h);
    H(16, 4, 1, o.g ? 4 : 2, h);
    if (d > 0) {
        H(4, 4, 5, 2, h);
        H(9, 4, 2, 1, h);
    }
    else {
        H(11, 4, 5, 2, h);
        H(9, 4, 2, 1, h);
    }
    H(6, 0, 4, 1, shade(h, .3));
    // 目・まゆ・口・ほほ（目は進む向きへ1つ寄せる）
    const e = d > 0 ? 1 : 0, ey = '#2a1d18', L = 5 + e, Rr2 = 11 + e;
    const blink = (fr + seed) % 46 < 2;
    const cheek = () => {
        H(4 + e, 10, 2, 1, '#f5a3a0');
        H(13 + e, 10, 2, 1, '#f5a3a0');
    };
    const eyes = (yy, hh) => {
        H(L, yy, 2, hh, ey);
        H(Rr2, yy, 2, hh, ey);
    };
    if (o.shades) {
        H(4, 7, 12, 3, '#111');
        H(9, 7, 2, 1, '#111');
        H(5, 7, 2, 1, 'rgba(255,255,255,.5)');
        H(11, 7, 2, 1, 'rgba(255,255,255,.5)');
    }
    const mo = (xx, yy, w, hh, c) => H(xx + e, yy, w, hh, c);
    switch (mood) {
        case 'happy':
            if (!o.shades) {
                H(L, 8, 1, 1, ey);
                H(L + 1, 7, 1, 1, ey);
                H(L + 2, 8, 1, 1, ey);
                H(Rr2 - 1, 8, 1, 1, ey);
                H(Rr2, 7, 1, 1, ey);
                H(Rr2 + 1, 8, 1, 1, ey);
            }
            cheek();
            mo(7, 11, 4, 1, '#a8342c');
            mo(8, 12, 2, 1, '#e8737a');
            break;
        case 'joy':
            if (!o.shades) {
                eyes(7, 3);
                H(L, 7, 1, 1, '#fff');
                H(Rr2, 7, 1, 1, '#fff');
            }
            cheek();
            mo(6, 10, 6, 1, '#a8342c');
            mo(7, 11, 4, 2, '#a8342c');
            mo(8, 12, 2, 1, '#e8737a');
            if ((fr + seed) % 8 < 5) {
                H(-1, 2, 1, 3, '#ffd23f');
                H(-2, 3, 3, 1, '#ffd23f');
                H(19, 6, 1, 3, '#fff3a0');
                H(18, 7, 3, 1, '#fff3a0');
            }
            break;
        case 'meh':
            if (!o.shades) {
                H(L, 8, 2, 1, ey);
                H(Rr2, 8, 2, 1, ey);
                H(L, 7, 2, 1, sk2);
                H(Rr2, 7, 2, 1, sk2);
            }
            mo(7, 12, 2, 1, '#8a4a3a');
            mo(9, 11, 2, 1, '#8a4a3a');
            H(d > 0 ? 3 : 15, 2 + ((fr >> 2) + seed) % 2, 2, 3, '#8fd0f5');
            H(d > 0 ? 3 : 15, 2 + ((fr >> 2) + seed) % 2, 1, 1, '#ffffff');
            break;
        case 'sad':
            if (!o.shades) {
                eyes(8, 2);
                H(L, 6, 1, 1, '#5a3a22');
                H(L + 1, 5, 1, 1, '#5a3a22');
                H(Rr2, 5, 1, 1, '#5a3a22');
                H(Rr2 + 1, 6, 1, 1, '#5a3a22');
                H(L, 10 + ((fr >> 1) + seed) % 3, 1, 2, '#6ab4e8');
            }
            mo(8, 11, 2, 1, '#7a2e2e');
            mo(7, 12, 1, 1, '#7a2e2e');
            mo(10, 12, 1, 1, '#7a2e2e');
            break;
        case 'wow':
            if (!o.shades) {
                eyes(7, 3);
                H(L + 1, 7, 1, 1, '#fff');
                H(Rr2 + 1, 7, 1, 1, '#fff');
                H(L, 5, 2, 1, shade(h, .1));
                H(Rr2, 5, 2, 1, shade(h, .1));
            }
            mo(8, 11, 2, 2, '#7a2e2e');
            if ((fr + seed) % 10 < 6) {
                H(18, -4, 2, 4, '#ff5a4a');
                H(18, 1, 2, 1, '#ff5a4a');
            }
            break;
        case 'sleepy':
            if (!o.shades) {
                H(L, 8, 2, 1, ey);
                H(Rr2, 8, 2, 1, ey);
                H(L, 7, 2, 1, sk2);
                H(Rr2, 7, 2, 1, sk2);
            }
            mo(8, 11, 2, 2, '#9a5a4a');
            {
                const z = ((fr >> 2) + seed) % 6;
                H(17, 0 - z, 3, 1, '#c6d4f5');
                H(18, 1 - z, 1, 1, '#c6d4f5');
                H(17, 2 - z, 3, 1, '#c6d4f5');
            }
            break;
        case 'angry':
            if (!o.shades) {
                eyes(8, 2);
                H(L - 1, 5, 1, 1, '#3a2418');
                H(L, 6, 2, 1, '#3a2418');
                H(Rr2, 6, 2, 1, '#3a2418');
                H(Rr2 + 2, 5, 1, 1, '#3a2418');
            }
            H(4 + e, 10, 2, 1, '#f08080');
            H(13 + e, 10, 2, 1, '#f08080');
            mo(7, 12, 4, 1, '#7a2e2e');
            mo(7, 11, 1, 1, '#7a2e2e');
            mo(10, 11, 1, 1, '#7a2e2e');
            break;
        case 'smug':
            if (!o.shades) {
                H(L, 8, 2, 1, ey);
                H(Rr2, 7, 2, 2, ey);
            }
            mo(7, 11, 3, 1, '#8a3a2a');
            mo(10, 10, 1, 1, '#8a3a2a');
            break;
        default:
            if (!o.shades) {
                if (blink) {
                    H(L, 8, 2, 1, ey);
                    H(Rr2, 8, 2, 1, ey);
                }
                else {
                    eyes(7, 2);
                    H(L + 1, 7, 1, 1, '#ffffff');
                    H(Rr2 + 1, 7, 1, 1, '#ffffff');
                }
            }
            mo(8, 11, 2, 1, '#a05a4a');
    }
    pxInPp = inPp0;
}

/** 窓・ドア・棚の商品を描く */
function pxLights(op, night) {
    const lit = op || night, fc = shade(PXT.r, -.45);
    [[52, 0], [108, 6]].forEach(([fx, s0]) => {
        Rr(fx, 41, 32, 19, fc, 1);
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
        // ガラスの反射（ななめの光の筋）・窓わくのつや・窓の下の台（v2.0.0〜 細ピクセル）
        for (let k = 0; k < 14; k++) {
            Rq(fx * 4 + 10 + k, 194 - k * 2, 2, 2, 'rgba(255,255,255,.42)');
            Rq(fx * 4 + 20 + k, 194 - k * 2, 1, 2, 'rgba(255,255,255,.3)');
        }
        Rq(fx * 4 + 4, 165, 120, 1, shade(fc, .35));
        Rq(fx * 4 - 3, 236, 134, 4, '#fff8ec');
        Rq(fx * 4 - 3, 239, 134, 1, '#d8c6a8');
        Rq(fx * 4 + 3, 166, 1, 66, 'rgba(255,255,255,.25)');
    });
    Rr(88, 38, 16, 24, fc, 1);
    Rc(90, 40, 12, 22, lit ? '#ffe9a8' : '#86b9cf');
    Rc(95, 40, 2, 22, fc);
    // ドア：ガラスの反射・取っ手・けり板
    for (let k = 0; k < 10; k++)
        Rq(364 + k, 186 - k * 2, 2, 2, 'rgba(255,255,255,.4)');
    Rq(392 + 0, 166, 1, 80, 'rgba(255,255,255,.18)');
    Rq(360, 232, 20, 14, shade(fc, .12));
    Rq(392, 232, 16, 14, shade(fc, .12));
    Rq(360, 232, 20, 1, shade(fc, .4));
    Rq(392, 232, 16, 1, shade(fc, .4));
    Rq(395, 204, 3, 14, '#c9ced6');
    Rq(395, 204, 1, 14, '#ffffff');
    Rq(395, 217, 3, 1, '#8a929c');
    Rq(386, 204, 3, 14, '#c9ced6');
    Rq(386, 204, 1, 14, '#ffffff');
    if (op)
        pp(92, 45, PXT.r, { apron: true, mood: 'happy' });
    // 札：営業中は OPEN、そのほかは CLOSE
    Rq(381, 156, 1, 8, '#d0c8b8');
    Rq(402, 156, 1, 8, '#d0c8b8');
    Rp(181, 82, 22, 8, op ? PXT.r : PXT.c);
    Rp(181, 82, 22, 1, shade(op ? PXT.r : PXT.c, .35));
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

/** 木（v2.0.0〜。🌲のように三角を3段重ねた形。季節で色が変わる：春は桜色・夏は緑・秋は紅葉・冬は雪をかぶった常緑） */
function pxTree(x, se) {
    Rc(x + 8, 44, 2, 18, '#7a5a44');
    Rc(x + 8, 44, 1, 18, '#93705a');
    const c = [['#ffb8d2', '#f48fb5', '#ffe0ec'], ['#5fcf86', '#3fae69', '#a6efbf'], ['#ffa25c', '#ee7d3b', '#ffd0a6'], ['#3f8f6a', '#2f7556', '#5fb08a']][se];
    const X = x * 4 + 36;
    // 下の段から順に（上の段が下の段に少しかぶる）
    [[34, 13, 76, 26], [27, 10, 58, 18], [20, 8, 38, 10]].forEach(([top, hh, wb, wt]) => {
        const T = top * 4, Hh = hh * 4;
        for (let r = 0; r < Hh; r += 2) {
            const w = Math.round((wt + (wb - wt) * r / (Hh - 2)) / 2) * 2, L = X - w / 2;
            Rq(L, T + r, w, 2, c[0]);
            Rq(X + w / 6, T + r, w / 3, 2, c[1]);
            Rq(L, T + r, 2, 2, c[2]);
        }
        // すそのギザギザと影
        for (let k = X - wb / 2; k < X + wb / 2; k += 8)
            Rq(k + 2, T + Hh, 4, 2, c[1]);
        Rq(X - wb / 2 + 2, T + Hh - 2, wb - 4, 2, c[1]);
        if (se === 3) {
            // 冬：段ごとに雪をかぶる
            for (let r = 0; r < Hh; r += 2) {
                const w = Math.round((wt + (wb - wt) * r / (Hh - 2)) / 2) * 2;
                Rq(X - w / 2, T + r, 4, 2, '#ffffff');
                if (r > Hh / 2)
                    Rq(X + w / 2 - 4, T + r, 4, 2, '#eef4fa');
            }
            Rq(X - wb / 2 + 4, T + Hh - 4, 10, 2, '#ffffff');
            Rq(X + wb / 2 - 16, T + Hh - 4, 10, 2, '#ffffff');
        }
        else
            for (let k = 0; k < 3; k++)
                Rq(X - wb / 4 + k * (wb / 5), T + Hh / 2 + (k % 2) * 6, 3, 3, c[2]);
    });
    // てっぺん
    Rq(X - 2, 74, 4, 6, se === 3 ? '#ffffff' : c[0]);
}

/** 背景（空・雲・街並み・地面・道路・車・木・街灯・お店の建物）を描く（v2.0.0〜 ミント×コーラルの色で描き直し。位置は v1.x と同じ） */
function pxScene(W, se, wt, night, bad) {
    // 出店場所ごとの背景（v2.1.0〜）。デパート・駅ナカは屋内（空・道路・車・木なし）
    const lk = state.loc || 'suburb';
    if (locF('indoor'))
        pxIndoor(W, night, bad, lk === 'station');
    else {
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
    if (lk === 'downtown')
        pxDowntown(night, bad);
    if (lk === 'uptown')
        pxUptown(se, night, bad);
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
    pxRoad();
    {
        // 車（丸みのあるパステルの車）
        const cxp = ((fr * 1.6) % 260) - 40, ci = Math.floor(fr * 1.6 / 260) % 3, cc = [PXT.c, PXT.r, '#ffc94d'][ci];
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
    if (lk !== 'downtown') {
        pxTree(4, se);
        pxTree(172, se);
    }
    if (se === 0 || se === 2)
        for (let i = 0; i < 8; i++)
            Rp((i * 27 + fr * 0.5) % W * 2, (i * 13 + fr * 0.8) % 66 * 2, 2, 2, se ? '#ffa25c' : '#ffc4da');
    // 街灯（ミントの柱と丸い明かり）
    const lp = shade(PXT.r, -.45);
    Rc(40, 38, 2, 24, lp);
    Rc(36, 36, 10, 2, lp);
    Rq(161, 152, 1, 96, shade(lp, .4));
    Rq(158, 240, 12, 8, lp);
    Rq(158, 240, 12, 1, shade(lp, .4));
    Rr(35, 37, 4, 3, night ? '#fff1b0' : '#e8f7f1', 1);
    }
    // お店の建物：ミントの屋根・クリームの壁・腰板
    const rf = shade(PXT.r, -.25);
    Rr(45, 19, 102, 7, rf, 1);
    Rc(46, 19, 100, 1, shade(PXT.r, .15));
    Rc(48, 26, 96, 36, '#fff4e3');
    for (let x = 52; x < 144; x += 6)
        Rc(x, 40, 1, 16, '#f5e6cf');
    Rc(48, 56, 96, 6, PXT.r);
    Rc(48, 56, 96, 1, shade(PXT.r, .3));
    pxFine(rf);
    Rc(140, 26, 4, 36, 'rgba(31,58,53,.08)');
    // 看板：コーラルの丸い看板に白い文字
    const SC = signC();
    Rr(75, 9, 42, 13, shade(SC, -.25), 2);
    Rr(76, 9, 40, 12, SC, 2);
    Rc(78, 10, 36, 1, shade(SC, .35));
    Rq(310, 78, 148, 1, shade(SC, -.12));
    [[310, 44], [454, 44], [310, 72], [454, 72]].forEach(([x, y]) => {
        Rq(x, y, 3, 3, shade(SC, -.3));
        Rq(x, y, 2, 2, shade(SC, .5));
    });
    pxText(88.5, 13.5, 'SHOP', shade(SC, -.35));
    pxText(88, 13, 'SHOP', '#ffffff');
    // 日よけ：コーラルと白のしましま、すそは波形
    for (let i = 0; i < 16; i++) {
        const c = i % 2 ? '#fffaf2' : PXT.c;
        Rc(48 + i * 6, 29, 6, 7, c);
        Rc(48.5 + i * 6, 36, 5, 1, c);
        Rc(49.5 + i * 6, 37, 3, 1, c);
        // 布のひだ（右のふちを少し暗く）
        Rq(192 + i * 24 + 20, 118, 2, 26, shade(c, -.1));
        Rq(192 + i * 24 + 2, 118, 2, 26, 'rgba(255,255,255,.22)');
    }
    for (let x = 194; x < 574; x += 6)
        Rq(x, 120, 3, 1, 'rgba(255,255,255,.7)');
    Rc(48, 29, 96, 1, 'rgba(255,255,255,.55)');
    Rc(48, 38, 96, 2, 'rgba(31,58,53,.18)');
    // 入口のわきの植木鉢
    [[46, 56], [141, 56]].forEach(([x, y]) => {
        Rr(x, y + 2, 5, 4, '#e0855f', 1);
        Rr(x - 0.5, y - 2, 6, 5, se === 3 ? '#f4f8fb' : '#3fae69', 2);
        const X = x * 4, Y = y * 4;
        Rq(X - 1, Y + 8, 22, 2, '#f09a74');
        Rq(X + 2, Y + 12, 2, 8, 'rgba(255,255,255,.25)');
        Rq(X + 2, Y + 22, 16, 1, '#b8633f');
        if (se !== 3) {
            [[2, -6], [8, -8], [14, -5], [5, 0], [12, 1]].forEach(([dx, dy]) => Rq(X + dx, Y + dy, 3, 2, '#6fd08e'));
            [[5, -5, '#ffb8d2'], [12, -6, '#fff1a8'], [9, -2, '#ff8fb0']].forEach(([dx, dy, c]) => {
                Rq(X + dx, Y + dy - 1, 2, 4, c);
                Rq(X + dx - 1, Y + dy, 4, 2, c);
                Rq(X + dx, Y + dy, 2, 2, '#ffd23f');
            });
        }
    });
}

/** 看板の色（シーシャ屋はむらさき。v2.1.0〜） */
const signC = () => isShisha() ? '#9a6ad6' : PXT.c;

/** 繁華街：背の高いビルとネオンの看板（遠くの丘の代わり。v2.1.0〜） */
function pxDowntown(night, bad) {
    const neon = ['#ff4fa3', '#3ee0ff', '#ffd23f', '#9b6bff'];
    [[0, 52, 16, '#5a5f8a'], [14, 40, 14, '#6e6a9a'], [28, 46, 18, '#4f5a7e'], [146, 44, 16, '#4f5a7e'], [160, 54, 14, '#6e6a9a'], [173, 38, 19, '#5a5f8a']].forEach(([x, h, w, c], k) => {
        c = bad ? shade(c, -.2) : c;
        Rc(x, 62 - h, w, h, c);
        Rc(x, 62 - h, w, 1, shade(c, .25));
        for (let j = 0; j < h - 6; j += 4)
            for (let i = 2; i < w - 2; i += 3)
                Rc(x + i, 62 - h + 3 + j, 1.5, 2, night ? ((i * 7 + j * 3 + k) % 5 ? '#ffe9a8' : '#3a3f5c') : shade(c, .4));
        // ネオンの縦看板（夜は点滅）
        const nc = neon[k % 4], on = !night || ((fr >> 2) + k) % 6;
        Rr(x + (k % 2 ? 1 : w - 4), 62 - h + 5, 3, 12, on ? nc : shade(nc, -.5), 1);
        if (night && on) {
            cx.globalAlpha = .25;
            Rr(x + (k % 2 ? 0 : w - 5), 62 - h + 4, 5, 14, nc, 2);
            cx.globalAlpha = 1;
        }
    });
}

/** 高級住宅街：三角屋根のお屋敷と生け垣（遠くの丘の代わり。v2.1.0〜） */
function pxUptown(se, night, bad) {
    [[2, 40, '#f6efe4', '#7a5c8e'], [150, 40, '#eef3f7', '#3f6e8c']].forEach(([x, w, wc, rc]) => {
        wc = bad ? shade(wc, -.15) : wc;
        Rc(x, 40, w, 22, wc);
        for (let r = 0; r < 10; r++)
            Rc(x - 2 + r * 1.2, 40 - r, w + 4 - r * 2.4, 1, r ? rc : shade(rc, -.2));
        Rc(x + w - 10, 26, 4, 8, shade(wc, -.25));
        for (let i = 0; i < 3; i++) {
            Rc(x + 4 + i * 12, 45, 7, 7, night ? '#ffe9a8' : '#bfe3f5');
            Rc(x + 7 + i * 12, 45, 1, 7, wc);
            Rc(x + 4 + i * 12, 48, 7, 1, wc);
        }
        Rc(x + w / 2 - 3, 54, 6, 8, '#8a5a3c');
        Rc(x + w / 2 + 1.5, 58, 1, 1, '#ffd23f');
    });
    // 生け垣（ふちを丸く）
    Rr(0, 56, 46, 6, se === 3 ? '#e8eef2' : '#3f9a5c', 3);
    Rr(146, 56, 46, 6, se === 3 ? '#e8eef2' : '#3f9a5c', 3);
}

/** 屋内（デパート・駅ナカ）：壁・天井の明かり・床。駅ナカは改札口と、窓の向こうを電車が走る（v2.1.0〜） */
function pxIndoor(W, night, bad, st) {
    const g = cx.createLinearGradient(0, 0, 0, 124);
    g.addColorStop(0, st ? '#d9dde2' : '#f6efe3');
    g.addColorStop(1, st ? '#eef0f2' : '#fbf6ee');
    cx.fillStyle = g;
    cx.fillRect(0, 0, PXW, 124);
    // 天井と明かり
    Rc(0, 0, W, 5, st ? '#9aa3ad' : '#e8dcc8');
    for (let x = 8; x < W; x += 24)
        Rr(x, 4, 10, 2, '#fffbe6', 1);
    if (st) {
        // ホームが見える窓と、走る電車
        Rc(0, 9, W, 24, '#2e3a48');
        Rc(0, 9, W, 1, '#56677a');
        const tx = ((fr * 3) % (W + 260)) - 130;
        for (let k = 0; k < 3; k++) {
            const x = tx + k * 44;
            Rr(x, 14, 42, 16, '#e7ecf0', 2);
            Rc(x + 1, 24, 40, 2, PXT.r);
            for (let i = 0; i < 4; i++)
                Rc(x + 3 + i * 10, 16, 7, 6, night ? '#ffe9a8' : '#9fd3f2');
        }
        Rc(0, 32, W, 2, '#56677a');
        // 発車の案内板
        Rr(84, 2, 24, 6, '#1d2733', 1);
        Rc(86, 4, 9, 1, '#ffb43a');
        Rc(97, 4, 8, 1, '#5ee38a');
        Rc(86, 6, 14, 1, '#ffb43a');
        // 改札口（左右）
        [[2, 1], [150, -1]].forEach(([x0]) => {
            for (let i = 0; i < 3; i++) {
                const x = x0 + i * 14;
                Rr(x, 46, 4, 16, '#b9c2cc', 1);
                Rc(x, 46, 4, 1, '#e3e8ee');
                Rc(x + 1, 48, 2, 2, (fr >> 3) % 3 === i ? '#5ee38a' : '#3ea3ff');
                Rc(x + 4, 52, 6, 1.5, (fr >> 2) % 4 < 2 ? '#ffd23f' : '#f0a53a');
            }
            Rr(x0 + 2, 38, 36, 5, '#2a6fd6', 1);
            Rc(x0 + 5, 40, 30, 1, '#ffffff');
        });
    }
    else {
        // デパート：柱・つり下げの飾り・エスカレーター
        [[8, '#e9dcc6'], [176, '#e9dcc6']].forEach(([x, c]) => {
            Rc(x, 5, 8, 57, c);
            Rc(x, 5, 1, 57, '#fffaf0');
            Rc(x + 7, 5, 1, 57, shade(c, -.12));
        });
        for (let i = 0; i < 6; i++)
            Rr(22 + i * 26, 6, 8, 10, [PXT.c, '#ffd23f', PXT.r][i % 3], 1);
        for (let r = 0; r < 14; r++)
            Rc(150 + r * 1.6, 44 - r * 2, 6, 2, r % 2 ? '#c9ced6' : '#aab1bb');
        Rc(148, 44, 10, 18, '#d8dde3');
    }
    if (bad) {
        cx.fillStyle = 'rgba(200,40,40,.22)';
        cx.fillRect(0, 0, PXW, 124);
    }
    // 床（タイル）
    Rc(0, 62, W, 30, st ? '#c9ccd0' : '#efe6d6');
    Rc(0, 62, W, 1, '#ffffff');
    for (let x = 0; x < W; x += 12)
        Rc(x, 62, 0.5, 30, st ? '#b4b8bd' : '#e0d4be');
    for (let y = 70; y < 92; y += 8)
        Rc(0, y, W, 0.5, st ? '#b4b8bd' : '#e0d4be');
    if (st)
        Rc(0, 66, W, 2, '#ffd23f');
}

/** シーシャ屋：店の中がうっすら煙っぽい（むらさきの明かりと、ただようもや。喫煙の様子は描かない。v2.1.0〜） */
function pxHaze() {
    cx.fillStyle = 'rgba(150,90,200,.16)';
    cx.fillRect(106, 84, 60, 34);
    cx.fillRect(218, 84, 60, 34);
    cx.globalAlpha = .3;
    for (let i = 0; i < 8; i++) {
        const fx = i % 2 ? 109 : 53, x = fx + ((i * 9 + fr * 0.3) % 22), y = 43 + (i * 5) % 11 + Math.sin((fr + i * 11) / 14) * 1.5;
        Rr(x, y, 8, 3, '#f2e8ff', 1.5);
    }
    cx.globalAlpha = 1;
}

/** お店と道の細かい模様（細ピクセル。v2.0.0〜）：屋根がわら・壁の板・腰板のれんが・歩道・道路 */
function pxFine(rf) {
    // 屋根がわら（段ごとに半分ずらす）
    for (let r = 0; r < 4; r++) {
        const y = 79 + r * 6;
        Rq(184, y + 5, 400, 1, shade(rf, -.25));
        for (let x = 186 + (r % 2) * 7; x < 584; x += 14)
            Rq(x, y, 1, 5, shade(rf, -.18));
        Rq(186, y + 1, 396, 1, 'rgba(255,255,255,.12)');
    }
    // 壁の板（横の線）
    for (let y = 168; y < 224; y += 8)
        Rq(192, y, 384, 1, '#f3e2c8');
    Rq(192, 104, 384, 2, '#f0dcc0');
    // 腰板のれんが
    for (let r = 0; r < 3; r++) {
        const y = 228 + r * 7;
        Rq(192, y + 6, 384, 1, shade(PXT.r, -.18));
        for (let x = 192 + (r % 2) * 8; x < 576; x += 16)
            Rq(x, y, 1, 6, shade(PXT.r, -.14));
    }
}

/** 歩道のつぶつぶと、道路のアスファルト（細ピクセル。v2.0.0〜） */
function pxRoad() {
    for (let i = 0; i < 60; i++) {
        const x = (i * 97 + 13) % 768, y = 252 + (i * 37) % 18;
        Rq(x, y, 2, 1, 'rgba(160,130,90,.25)');
    }
    for (let i = 0; i < 120; i++) {
        const x = (i * 131 + 7) % 768, y = 282 + (i * 53) % 84;
        Rq(x, y, 2, 2, i % 3 ? '#56616d' : '#434c57');
    }
    Rq(0, 272, 768, 2, '#3e4752');
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
    const ind = locF('indoor');
    if (wt === 2 && !ind)
        for (let i = 0; i < 70; i++)
            Rp((i * 37 + fr * 2) % W * 2, (i * 23 + fr * 6) % H * 2, 1, 5, '#7ab8ea');
    if (wt === 3 && !ind) {
        for (let i = 0; i < 70; i++)
            Rp((i * 29 + Math.sin((fr + i * 9) / 9) * 3 + W) % W * 2, (i * 17 + fr) % H * 2, i % 3 ? 1 : 2, i % 3 ? 1 : 2, '#fff');
        Rc(0, 62, W, 2, '#f4f8fb');
        // 屋根の雪（看板の部分はよける）
        Rc(46, 18, 29, 2, '#fff');
        Rc(117, 18, 29, 2, '#fff');
        Rr(76, 8, 40, 2, '#fff', 1);
    }
    if (night) {
        // 屋内（デパート・駅ナカ）は照明があるので、暗くするのは少しだけ。星と街灯の明かりもなし
        cx.fillStyle = ind ? 'rgba(18,20,70,0.2)' : 'rgba(18,20,70,0.48)';
        cx.fillRect(0, 0, PXW, PXH);
        if (wt === 0 && !ind)
            for (let i = 0; i < 14; i++)
                Rp((i * 47) % W * 2, (i * 13) % 24 * 2, i % 3 ? 1 : 2, i % 3 ? 1 : 2, '#fff');
        if (!ind) {
            Rc(30, 38, 18, 24, 'rgba(255,233,168,.2)');
            Rc(37, 37, 8, 2, '#ffe9a8');
        }
        pxLights(op, true);
        // 夜は看板に明かりをともす（v2.0.0〜）
        cx.globalAlpha = .55;
        Rr(76, 9, 40, 12, signC(), 2);
        cx.globalAlpha = 1;
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
    if (isShisha())
        pxHaze();
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
    const bd = badDay(), F = fxList(), wow = ['quake', 'bomb', 'car', 'robber', 'flood'].some(k => F.includes(k));
    PXC.forEach(c => {
        if (c.st === 1)
            return;
        const wk = Math.floor((fr + Math.floor(c.x)) / 2) % 2, mood = bd ? 'sad' : (wow ? 'wow' : (c.st === 2 ? (c.bag ? (c.c % 2 ? 'joy' : 'happy') : 'meh') : 'neutral'));
        pp(c.x, 56 + (wk ? 0.5 : 0), bd ? '#6b6f78' : (c.g ? FP : MP)[c.c], { g: c.g, hair: (c.g ? FH : MH)[c.c], bag: c.bag && c.st === 2, dir: c.L, down: bd, mood, walk: wk });
    });
    const n = Math.min(state.clerk, 12), e = eff(), pal = ['#2b7fd1', '#e86a5c', '#4caf72', '#8e5bd1'];
    for (let i = 0; i < n; i++) {
        const sad = e < 0 || state.dn > 0;
        pp(8 + i * 14.8, 57 + (op && ((fr >> 1) + i) % 4 < 2 ? 0.5 : 0), e < 0 ? '#7a2e2e' : (state.dn > 0 ? '#7f8c99' : pal[i % 4]), { mood: sad ? 'sad' : (wow ? 'wow' : (op ? (((fr >> 4) + i) % 5 ? 'happy' : 'joy') : (state.phase === 'closed' && state.day > 0 ? 'sleepy' : 'neutral'))), apron: !sad });
    }
}
