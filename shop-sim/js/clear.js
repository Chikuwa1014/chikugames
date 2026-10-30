/**
 * clear.js — クリア演出（v2.3.0〜）。achv.js の前に読む。
 *
 * 条件（4つすべて）：全店の累計売上1兆円・お店5店舗以上・預金1,000億円・営業50年（通算4,200日）。難易度は問わない。
 * そろった日の閉店後（engine.js の endDay の最後で clrCheck）に、クリア専用のカットイン（帯が斜めに入る＋紙吹雪と花火）を出し、
 * そのあと成績のカードを出す。クリアした日は state.co.clr（{ day, diff, at }）に残し、演出はセーブごとに1回だけ。
 * 成績のカードの「お店を見る ▶」で、出したお店を1店ずつ紹介し（clrTour。4.5秒かタップで次へ・スキップあり）、
 * 最後に「おしまい」の画面を出して終わる（v2.3.1〜）。お店の開店日は store の od（v2.3.1 より前に出した店は記録なし）。
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
        + '<button class="big" data-a="clrtour">お店を見る ▶</button></div>'
        + '<div class="clrtour" hidden></div>';
    el.hidden = false;
    el.classList.remove('s2', 's3');
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

/** お店紹介のちくわくんのひとこと（スタイルごと。1号店とシーシャ屋は別） */
const CLR_SAY = {
    first: 'ここから、ぜんぶが始まったんだよね。いつ来てもほっとするお店だよ',
    normal: 'いつものあの棚、いつものあの笑顔。町のみんなの「いつもの」になったね',
    food: '毎日のごはんを支えてきた、町の台所みたいなお店だったね',
    toy: '子どもたちの笑い声が、いちばん聞こえるお店だったね',
    shoes: 'みんなの一歩を応援してきたお店。足どりも軽くなるね',
    boutique: 'おしゃれな人たちが集まる、町のあこがれのお店になったね',
    asian: 'いい香りと、遠い国の風が吹いてくるお店だったね',
    under: 'ちょっとあやしいけど、ファンがいっぱいの名物店だよ',
    kawaii: 'かわいいものに囲まれて、だれでも笑顔になれるお店だったね',
    brand: 'ここで買ったものは、きっと一生の宝物になるね',
    car: 'たくさんの人の、はじめてのドライブを送り出してきたお店だね',
    tcg: '放課後になると、カードを広げる声でにぎやかだったね',
    happy: 'その名前のとおり、しあわせを配ってきたお店だね',
    shisha: 'ゆっくり煙をくゆらせて、夜を楽しむ大人のお店だったね'
};

/** 日にちの表示（◯ヶ月目・通算◯日） */
const clrDate = d => (Math.floor((d - 1) / MD) + 1) + 'ヶ月目・通算' + fmt(d) + '日';

/** お店のドット絵（96×60。屋根と日よけはスタイルの色、看板にスタイルの絵文字） */
function clrShop(cv, s) {
    const g = cv.getContext('2d'), t = styAlt(s), R = t ? t.r : PXB.r, C = t ? t.c : PXB.c;
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    r(0, 0, 96, 60, '#1d2b4a');
    for (let i = 0; i < 18; i++)
        r((i * 37 + 5) % 96, (i * 13 + 3) % 24, 1, 1, i % 3 ? '#9fb3d9' : '#fff');
    r(0, 52, 96, 8, '#3b4250');
    r(0, 52, 96, 1, '#596273');
    r(16, 18, 64, 34, '#f3ead8');
    r(16, 18, 64, 2, '#d9cdb4');
    r(12, 10, 72, 9, R);
    r(12, 10, 72, 2, 'rgba(255,255,255,.25)');
    r(30, 4, 36, 9, C);
    r(31, 5, 34, 7, 'rgba(255,255,255,.18)');
    for (let i = 0; i < 9; i++)
        r(14 + i * 8, 20, 8, 5, i % 2 ? '#fff' : C);
    r(14, 25, 68, 1, 'rgba(0,0,0,.15)');
    r(22, 30, 26, 16, '#ffe7a6');
    r(22, 30, 26, 2, '#fff6d2');
    r(34, 30, 2, 16, R);
    r(56, 30, 16, 22, R);
    r(58, 32, 12, 20, '#ffd98a');
    r(68, 41, 1, 3, '#7a5a44');
    r(20, 46, 30, 2, R);
    r(4, 46, 6, 6, '#5aa65a');
    r(86, 46, 6, 6, '#5aa65a');
}

/** お店紹介の1枚 */
function clrSlide(i) {
    const A = allStores(), s = A[i], L = locOf(s), sh = isShisha(s);
    const od = i === 0 ? 1 : s.od, kv = (k, v) => '<span>' + k + '</span><b>' + v + '</b>';
    const say = i === 0 ? CLR_SAY.first : sh ? CLR_SAY.shisha : CLR_SAY[(styAlt(s) || {}).id] || CLR_SAY.normal;
    const emo = sh ? L.e : styOf(s).e;
    return '<div class="clrsl"><div class="clrno">' + (i + 1) + '号店 <small>' + (i + 1) + ' / ' + A.length + '</small></div>'
        + '<div class="clrpx"><canvas width="96" height="60"></canvas><span>' + emo + '</span></div>'
        + '<div class="clrnm">' + esc(s.sname || (i + 1) + '号店') + '</div>'
        + '<div class="cokv clrkv">' + kv('場所', L.e + ' ' + L.n) + (sh ? '' : kv('スタイル', styName(s)))
        + kv('開店日', od ? clrDate(od) : '記録なし') + (od ? kv('営業した日数', fmt(Math.max(1, state.day - od + 1)) + '日') : '')
        + kv('累計売上', yen(s.tot || 0)) + '</div>'
        + '<div class="clrsay"><canvas class="clrface" width="32" height="32"></canvas><p>' + say + '</p></div></div>';
}

/** おしまいの画面のちくわくんの言葉（ありがとうの気持ちと、前向きになれる言葉。1行ずつ出る） */
const CLR_THANKS = [
    '小さな1軒のお店から、ここまで来たね。',
    '売れない日も、うまくいかない日もあったけど、きみはあきらめずに、毎朝お店を開けてくれた。',
    'ぼくのお店を、こんなに大きくしてくれて、ほんとうにありがとう。',
    'ここまでがんばれたきみなら、これからどんなことだって、きっとだいじょうぶ。',
    'きみの毎日も、たくさんの笑顔でにぎわいますように。',
    '<b>遊んでくれて、ありがとう！</b>'
];

/** おしまいの画面 */
function clrEndHtml() {
    const c = state.co, D = DF[c.clr.diff] || difficulty(), y = Math.floor(c.clr.day / (MD * 12));
    return '<div class="clrsl clrend"><canvas class="clrface big" width="32" height="32"></canvas>'
        + '<div class="clrfin">ちいさなお店<br><b>おしまい</b></div>'
        + '<div class="meta">' + esc(c.name || '会社') + '・' + D.n + '・' + y + '年・' + allStores().length + '店舗</div>'
        + '<div class="clrmsg">' + CLR_THANKS.map((t, i) => '<p style="animation-delay:' + (0.6 + i * 0.9) + 's">' + t + '</p>').join('') + '</div>'
        + '<div class="row"><button data-a="clrshare">📤 クリアをシェア</button></div>'
        + '<button class="big" data-a="clrclose">つづけて遊ぶ</button></div>';
}

/** お店紹介を始める・次へ進める */
function clrTour(i) {
    const el = byId('clrm'), box = el && el.querySelector('.clrtour');
    if (!box)
        return;
    clearTimeout(clrTour.t);
    const n = allStores().length;
    clrTour.i = i;
    el.classList.add('s3');
    el.scrollLeft = 0;
    box.hidden = false;
    if (i >= n) {
        box.innerHTML = clrEndHtml();
        tutFace(box.querySelector('.clrface'));
        return;
    }
    box.innerHTML = clrSlide(i) + '<div class="clrnav"><span>タップで次へ</span><button class="alt" data-a="clrskip">スキップ ⏭</button></div>';
    clrShop(box.querySelector('.clrpx canvas'), allStores()[i]);
    tutFace(box.querySelector('.clrface'));
    clrTour.t = setTimeout(() => clrTour(i + 1), 4500);
}

/** クリア演出を閉じる */
function clrClose() {
    const el = byId('clrm');
    clrFx.stop();
    clearTimeout(clrTour.t);
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
    if (a === 'clrtour')
        clrTour(0);
    if (a === 'clrskip')
        clrTour(allStores().length);
});

// お店紹介はどこをタップしても次へ（ボタンは除く）
document.addEventListener('click', e => {
    const box = e.target.closest('.clrtour');
    if (box && !e.target.closest('button') && !box.querySelector('.clrend'))
        clrTour(clrTour.i + 1);
});
