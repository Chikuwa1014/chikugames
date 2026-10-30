/**
 * clear.js — クリア演出（v2.3.0〜）。achv.js の前に読む。
 *
 * 条件（4つすべて）：全店の累計売上1兆円・お店5店舗以上・預金1,000億円・営業50年（通算4,200日）。難易度は問わない。
 * そろった日の閉店後（engine.js の endDay の最後で clrCheck）に、クリア専用のカットイン（帯が斜めに入る＋紙吹雪と花火）を出し、
 * そのあと成績のカードを出す。クリアした日は state.co.clr（{ day, diff, at }）に残し、演出はセーブごとに1回だけ。
 * 設定タブの「🏆 クリア演出をもう一度見る」で見直せる。クリアしたあともそのまま遊び続けられる。
 */

/** クリアの条件 */
const CLR = { tot: 1e12, stores: 5, sv: 1e11, day: 50 * MD * 12 };

/** 全店の累計売上 */
const clrTot = () => allStores().reduce((a, s) => a + (s.tot || 0), 0);

/** 条件ごとの今の値と達成したか */
const clrParts = () => [
    { n: '全店の累計売上', v: yen(clrTot()), g: yen(CLR.tot), ok: clrTot() >= CLR.tot },
    { n: 'お店の数', v: allStores().length + '店舗', g: CLR.stores + '店舗', ok: allStores().length >= CLR.stores },
    { n: '預金', v: yen(state.sv || 0), g: yen(CLR.sv), ok: (state.sv || 0) >= CLR.sv },
    { n: '営業', v: Math.floor(state.day / (MD * 12)) + '年（通算' + state.day + '日）', g: '50年', ok: state.day >= CLR.day }
];

/** 閉店のたびに調べる（まだクリアしていなくて、条件がそろったら演出） */
function clrCheck() {
    if (!state.co || state.co.clr || state.over || !clrParts().every(p => p.ok))
        return;
    state.co.clr = { day: state.day, diff: state.diff, at: new Date().toISOString() };
    addEvent('🏆 ちいさなお店をクリアしました！おめでとう！');
    save();
    setTimeout(() => clrShow(), 300);
}

/** 紙吹雪と花火（canvas。止めるときは clrFx.stop()） */
const clrFx = {
    raf: 0,
    stop() {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
    },
    start(cv) {
        this.stop();
        const g = cv.getContext('2d'), C = ['#ff7a68', '#2fbf97', '#ffbf47', '#6fb8ff', '#e8709a', '#ffffff'];
        let W = 0, H = 0, P = [], t0 = performance.now(), last = t0, nextFw = 0;
        const fit = () => {
            const r = devicePixelRatio || 1;
            W = cv.clientWidth;
            H = cv.clientHeight;
            cv.width = W * r;
            cv.height = H * r;
            g.setTransform(r, 0, 0, r, 0, 0);
        };
        fit();
        const conf = n => {
            for (let i = 0; i < n; i++)
                P.push({ k: 0, x: Math.random() * W, y: -20 - Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 120, a: Math.random() * 6, va: (Math.random() - 0.5) * 8, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: C[i % C.length] });
        };
        const fw = () => {
            const x = W * (0.15 + Math.random() * 0.7), y = H * (0.12 + Math.random() * 0.35), c = C[Math.floor(Math.random() * 5)];
            for (let i = 0; i < 36; i++) {
                const a = i / 36 * Math.PI * 2, sp = 120 + Math.random() * 60;
                P.push({ k: 1, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c });
            }
        };
        conf(140);
        const step = now => {
            const dt = Math.min(0.05, (now - last) / 1000), el = (now - t0) / 1000;
            last = now;
            if (cv.clientWidth !== W || cv.clientHeight !== H)
                fit();
            if (el > nextFw && el < 9) {
                fw();
                nextFw = el + 0.5 + Math.random() * 0.6;
            }
            if (el < 6 && Math.random() < 0.3)
                conf(2);
            g.clearRect(0, 0, W, H);
            P = P.filter(p => {
                if (p.k) {
                    p.vy += 90 * dt;
                    p.vx *= 0.985;
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    p.life -= dt * 0.8;
                    g.globalAlpha = Math.max(0, p.life);
                    g.fillStyle = p.c;
                    g.fillRect(p.x - 2, p.y - 2, 4, 4);
                    return p.life > 0;
                }
                p.vy = Math.min(p.vy + 30 * dt, 200);
                p.x += (p.vx + Math.sin(el * 3 + p.a) * 30) * dt;
                p.y += p.vy * dt;
                p.a += p.va * dt;
                g.globalAlpha = 1;
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.a);
                g.fillStyle = p.c;
                g.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.a * 1.7)), p.w, p.h * Math.abs(Math.cos(p.a * 1.7)) + 1);
                g.restore();
                return p.y < H + 30;
            });
            g.globalAlpha = 1;
            if (el < 12 || P.length)
                this.raf = requestAnimationFrame(step);
        };
        this.raf = requestAnimationFrame(step);
    }
};

/** クリア演出を出す */
function clrShow() {
    const c = state.co;
    if (!c || !c.clr)
        return;
    let el = byId('clrm');
    if (!el) {
        el = document.createElement('div');
        el.id = 'clrm';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        document.body.appendChild(el);
    }
    const D = DF[c.clr.diff] || difficulty(), A = allStores(), y = Math.floor(c.clr.day / (MD * 12));
    const kv = (k, v) => '<span>' + k + '</span><b>' + v + '</b>';
    el.innerHTML = '<canvas class="clrcv"></canvas>'
        + '<div class="clrband"><div class="clrin"><div class="clrt">🏆 CLEAR!</div><div class="clrs">ちいさなお店、だいせいこう！</div></div></div>'
        + '<div class="ovbox clrbox"><div class="clrhd"><canvas class="clrface" width="32" height="32"></canvas><div><b>おめでとう！</b><span>小さなお店から始めて、' + esc(c.name || '会社') + 'は' + A.length + '店舗の大きな会社になったね。ここまでいっしょに来てくれてありがとう！</span></div></div>'
        + '<div class="cokv clrkv">' + kv('会社', esc(c.name || '')) + kv('難易度', D.n) + kv('かかった日数', y + '年（通算' + fmt(c.clr.day) + '日）') + kv('全店の累計売上', yen(clrTot())) + kv('預金', yen(state.sv || 0)) + kv('お店', A.length + '店舗') + '</div>'
        + '<div class="clrst">' + A.map((s, i) => '<span>' + locOf(s).e + ' ' + esc(s.sname || (i + 1) + '号店') + '<small>' + styName(s) + '</small></span>').join('') + '</div>'
        + '<div class="row"><button data-a="clrshare">📤 クリアをシェア</button></div>'
        + '<button class="big" data-a="clrclose">つづける</button></div>';
    el.hidden = false;
    el.classList.remove('s2');
    tutFace(el.querySelector('.clrface'));
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still)
        el.classList.add('s2');
    else {
        clrFx.start(el.querySelector('.clrcv'));
        clearTimeout(clrShow.t);
        clrShow.t = setTimeout(() => el.classList.add('s2'), 2600);
    }
}

/** クリア演出を閉じる */
function clrClose() {
    const el = byId('clrm');
    clrFx.stop();
    if (el)
        el.hidden = true;
    render();
}

/** クリアをシェア（#ちくわげーむず は CG.share が付ける） */
function clrShare() {
    const c = state.co, D = DF[c.clr.diff] || difficulty();
    const msg = 'ちいさなお店をクリアした！🏆（' + D.n + '・' + Math.floor(c.clr.day / (MD * 12)) + '年・' + allStores().length + '店舗・累計売上' + yen(clrTot()) + '）';
    CG.share.open({ msg, url: shareUrl() });
}

document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled)
        return;
    const a = b.dataset.a;
    if (a === 'clrclose')
        clrClose();
    if (a === 'clrshare')
        clrShare();
    if (a === 'clrshow')
        clrShow();
});
