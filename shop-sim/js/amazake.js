/**
 * amazake.js — かまくらボーナスの日（大雪＋かまくら成功）と甘酒ミニゲーム。
 * state.kama：1＝かまくら作り中（通常の販売なし）、2＝ミニゲーム中。終了後に閉店する。
 */

/** ミニゲームの長さ（実時間・ミリ秒） */
const AMA_MS = 10000;

/** ミニゲームの進行（保存しない。途中で再読み込みしたら最初から） */
let ama = null;

/** 終了時の一言（連打数の下限と文言） */
const AMA_MSG = [[1000, '伝説の甘酒屋'], [600, '指が見えない…'], [300, '町じゅうが甘酒まみれ'], [120, '指がつりそう！'], [70, '行列ができた！'], [30, '大にぎわい'], [1, 'ちらほら'], [0, 'だれも来なかった…']];

/** 甘酒1杯の売上：解放済みで一番安い商品の販売価格 × 難易度倍率 */
const amaPer = () => Math.round(Math.min(...state.own.map(i => priceOf(PRODUCTS[i]))) * (difficulty().ama || 1));

/** かまくらの日の1秒（12:00 か閉店時刻でミニゲームを始める） */
function kamaTick() {
    if (state.kama !== 1)
        return;
    state.t++;
    if (state.openH + Math.floor(state.t / 5) >= 12 || state.t >= dayTicks())
        amaStart();
    render();
    save();
}

/** ミニゲームを始める（時間を止めてポップアップ） */
function amaStart() {
    state.kama = 2;
    state.paused = true;
    addLog('🍵 12:00 甘酒ボーナス開始！');
    ama = null;
    syncAma();
    save();
}

/** ポップアップの表示（render から呼ぶ。再読み込み後も開き直す） */
function syncAma() {
    let o = byId('ama');
    if (state.kama === 3 && !ama) {
        // 結果を見る前に再読み込みした（報酬は加算済み）→ そのまま閉店
        state.kama = 0;
        state.paused = false;
        setTimeout(() => {
            endDay();
            render();
            save();
        });
    }
    if ((state.kama !== 2 && state.kama !== 3) || state.over) {
        if (o)
            o.hidden = true;
        return;
    }
    if (o && !o.hidden && ama)
        return;
    if (!o) {
        o = document.createElement('div');
        o.id = 'ama';
        o.setAttribute('role', 'dialog');
        o.setAttribute('aria-modal', 'true');
        document.body.append(o);
        o.addEventListener('pointerdown', e => {
            if (e.target.closest('#amab')) {
                e.preventDefault();
                amaTap();
            }
        });
    }
    ama = { n: 0, t0: 0, done: false, q: [], fx: [], f: 0, per: amaPer() };
    for (let i = 0; i < 4; i++)
        ama.q.push(amaGuest(60 + i * 12));
    o.innerHTML = '<div class="ovbox amabox"><div class="amatop"><div class="amahd"><span>🍵 甘酒ボーナス</span><span id="amat">10.0秒</span></div>' +
        '<canvas id="amacv" width="96" height="60"></canvas><div class="amanum"><span id="aman">0</span>杯 <small id="amay">押すとスタート</small></div></div>' +
        '<div class="amabot" id="amabot"><button class="amabtn" id="amab" type="button">🍵 甘酒</button></div></div>';
    o.hidden = false;
    clearInterval(ama.iv);
    ama.iv = setInterval(amaFrame, 60);
    amaFrame();
}

/** 並ぶお客さん（服と髪の色はドット絵と同じ表から） */
function amaGuest(x) {
    const g = Math.random() < .5, c = Math.floor(Math.random() * 4);
    return { x, g, b: (g ? FP : MP)[c], h: (g ? FH : MH)[c] };
}

/** 連打1回 */
function amaTap() {
    if (!ama || ama.done)
        return;
    if (!ama.t0)
        ama.t0 = performance.now();
    ama.n++;
    const c = ama.q.shift();
    if (c)
        ama.fx.push({ x: c.x, g: c, t: 0 });
    ama.q.push(amaGuest(Math.max(96, (ama.q.length ? ama.q[ama.q.length - 1].x : 56) + 12)));
    byId('aman').textContent = ama.n;
    byId('amay').textContent = '+¥' + fmt(ama.n * ama.per);
}

/** 1コマ進める（残り時間・アニメ） */
function amaFrame() {
    if (!ama || !byId('amacv'))
        return;
    ama.f++;
    if (ama.t0 && !ama.done) {
        const left = Math.max(0, AMA_MS - (performance.now() - ama.t0));
        byId('amat').textContent = (left / 1000).toFixed(1) + '秒';
        if (left <= 0)
            amaFinish();
    }
    amaDraw();
}

/** 終了：報酬を加算して結果を表示 */
function amaFinish() {
    ama.done = true;
    const y = ama.n * ama.per, m = AMA_MSG.find(([k]) => ama.n >= k)[1];
    state.money += y;
    state.mSales += y;
    state.tot = (state.tot || 0) + y;
    state.dRev += y;
    addEvent('🍵 甘酒を' + ama.n + '杯ふるまいました（' + m + '）+¥' + fmt(y));
    state.kama = 3;
    save();
    byId('amabot').innerHTML = '<div class="amares"><b>' + m + '</b><div class="meta">' + ama.n + '杯 × ¥' + fmt(ama.per) + ' ＝ +¥' + fmt(y) + '（今月の売上に加算）</div>' +
        '<button class="big" data-a="amaclose">閉店する</button></div>';
}

/** 結果を閉じて閉店 */
function amaClose() {
    if (!ama || !ama.done)
        return;
    clearInterval(ama.iv);
    ama = null;
    byId('ama').hidden = true;
    state.kama = 0;
    state.paused = false;
    addLog('閉店。本日の売上 ¥' + fmt(state.dRev) + '（甘酒）');
    endDay();
    render();
    save();
}

/** ミニゲームのドット絵（96×60：雪・かまくら・店主・行列） */
function amaDraw() {
    const c = byId('amacv').getContext('2d'), R = (x, y, w, h, k) => {
        c.fillStyle = k;
        c.fillRect(Math.round(x), Math.round(y), w, h);
    }, P = (x, y, b, h, cup) => {
        R(x + 1, y, 3, 3, '#f1c27d');
        R(x + 1, y, 3, 1, h);
        R(x, y + 3, 5, 4, b);
        R(x + 1, y + 7, 1, 2, '#2a2a2a');
        R(x + 3, y + 7, 1, 2, '#2a2a2a');
        if (cup) {
            R(x - 2, y + 4, 2, 2, '#fff8e7');
            R(x - 2, y + 3, 1, 1, 'rgba(255,255,255,.7)');
        }
    }, f = ama.f;
    ['#c8d3dc', '#d3dce4', '#dde5ec', '#e6ecf1'].forEach((k, i) => R(0, i * 10, 96, 10, k));
    R(0, 40, 96, 20, '#f4f8fb');
    R(0, 40, 96, 1, '#dfe7ee');
    // かまくら
    R(6, 22, 26, 18, '#ffffff');
    R(9, 18, 20, 4, '#ffffff');
    R(13, 15, 12, 3, '#ffffff');
    R(6, 39, 26, 1, '#cfd8e0');
    R(14, 28, 10, 12, '#3b4a5a');
    R(15, 30, 8, 10, '#ffb347');
    R(16, 36, 6, 4, '#c44d2d');
    // 鍋と店主
    R(36, 34, 8, 5, '#555');
    R(35, 33, 10, 1, '#777');
    R(37, 30 - (f % 6 < 3 ? 1 : 0), 1, 3, 'rgba(255,255,255,.8)');
    R(41, 29 - (f % 6 < 3 ? 0 : 1), 1, 3, 'rgba(255,255,255,.8)');
    P(46, 30, '#ffd23f', '#3b2a20', ama.n > 0 && f % 4 < 2);
    // 行列（先頭は x=56、後ろに12ずつ並ぶ）
    ama.q.forEach((g, i) => {
        g.x = Math.max(56 + i * 12, g.x - 2);
        P(g.x, 31 + ((f + Math.floor(g.x)) % 4 < 2 ? 0 : 1), g.b, g.h);
    });
    // 甘酒をもらって帰る人
    ama.fx.forEach(e => {
        e.t++;
        e.x -= 2.5;
        P(e.x, 31 - Math.min(6, e.t), e.g.b, e.g.h, true);
    });
    ama.fx = ama.fx.filter(e => e.x > -8);
    // 雪
    for (let i = 0; i < 24; i++)
        R((i * 29 + Math.sin((f + i * 9) / 9) * 3 + 96) % 96, (i * 17 + f) % 60, 1, 1, '#fff');
}
