/**
 * tutorial.js — 遊び方（チュートリアル。v2.0.0〜）。
 * 画面を暗くして説明する場所だけを光らせ、ちくわくんの吹き出しで順に案内する。タブは自動で切り替える。
 * ・最初に難易度を選んだ直後に1回だけ出す（`newGame` を包む）。今遊んでいる人（セーブがある人）には自動では出さない
 * ・どの場面でも「すべてスキップ」で、そこから先の説明と練習をまとめて飛ばせる。難易度えらびの画面のチェック（#tutoff）で、最初から出さないこともできる。最後まで見るか飛ばしたら、端末に `TUT_KEY` を保存して次からは出さない（ゲームのセーブには入れない）
 * ・設定タブの「📖 遊び方を見る」（data-a="tutorial"）でいつでも見直せる。営業中に開いたら、その間は一時停止する
 * ・初めての人（難易度えらびの直後）だけ、説明のあとに1日目を実際にいっしょに進める（`TUT_PRACTICE`。開業→補充→開店→営業→閉店後）。
 *   見直しのときは説明だけ（実際のお金と日付が進むため）
 * 場面の種類（kind）：なし＝説明（全体を止めて、次へで進む）／'do'＝光っている所だけ押せる（done() を満たすと次へ）／
 *   'watch'＝画面を暗くせず、小さな吹き出しだけ出してゲームを動かしたまま待つ（done() を満たすと次へ）
 * ui.js の後、main.js の前に読む。
 */

/** チュートリアルを見終わった（飛ばした）かの保存キー（'1'＝見た） */
const TUT_KEY = 'shop-sim-tutorial';

/**
 * 場面の一覧。q：光らせる場所（関数。null なら画面の真ん中に吹き出しだけ）、tab：先に開くタブ、t：見出し、m：説明（関数でもよい）
 */
const TUT_STEPS = [
    { q: null, tab: 0, t: 'ようこそ、ちいさなお店へ！', m: 'ぼくはちくわくん。お店のやり方を案内するよ。\n商品を仕入れて売って、稼いだお金でお店を大きくしよう。お金が足りなくなると倒産だから気をつけてね。' },
    { q: () => document.querySelector('.mrow'), tab: 0, t: '所持金', m: 'いま使えるお金だよ。仕入れ・投資・月末の支払いはここから出ていくよ。\n右の🏅は実績。条件を満たすと増えていくよ。' },
    { q: () => document.querySelector('details.shop'), tab: 0, t: 'お店の様子と1日の流れ', m: '1日は「① 開店準備 → ② 開店 → ③ 閉店後」の順に進むよ。\n季節や天気、お客さんの様子もこの絵でわかるよ。左下は月末に払うお金の予想だよ。' },
    { q: () => byId('gl').closest('.card'), tab: 0, t: '3つのゲージ', m: '購買欲：高いほどお客さんが来る。100になると来店ブースト！\nノルマ：月末までにこの売上を目指そう。\n幸福度：働きすぎると下がるよ。ときどき店休日で休もう。' },
    { q: () => byId('sh'), tab: 0, t: '陳列棚', m: '「+N」や「満タン」で商品を補充するよ。補充には原価がかかるから、売れる分だけ並べよう。\n在庫が0の棚は売れないよ。' },
    { q: () => byId('act'), tab: 0, t: '開業・開店', m: 'このボタンで1日を進めるよ。開店すると、お客さんが来て自動で売れていくよ。\n営業中は店の絵の右下で一時停止（⏸）と倍速（×1〜×8）ができるよ。' },
    { q: () => document.querySelector('#tabs [data-v="1"]'), tab: 1, t: '投資タブ', m: '閉店後に、棚を増やす・容量アップ・広告・店員・セキュリティなどにお金を使えるよ。\n棚を増やすと新しい商品も並べられるよ。' },
    { q: () => document.querySelector('#tabs [data-v="2"]'), tab: 2, t: 'お金タブ', m: () => difficulty().full ? '融資（お金を借りる）・預金・粗利率・自分の月収を決めるよ。借りたお金は毎月返していくよ。' : '預金や自分の月収を決めるよ。\n融資と粗利率の調整は、ハード・インフェルノで使えるよ。' },
    { q: () => document.querySelector('#tabs [data-v="3"]'), tab: 3, t: '設定タブ', m: 'セーブの書き出し・読み込みや、最初からやり直すのはここ。\n分からないところは小さな「？」を押すと説明が出るよ。遊び方は設定の「📖 遊び方を見る」から見直せるよ。' },
    { q: () => document.querySelector('[data-a="oh"]').closest('.card'), tab: 3, t: '営業時間', m: '開店と閉店の時間を決めるよ。長く開けるほどたくさん売れるけど、幸福度が下がりやすいよ（9時間なら増えも減りもしない）。\n7時前と22時以降は、店員さんの時給が125%になるよ。', end: 'それじゃあ、がんばってね！' }
];

/** 今日の「本日の結果」のカード（閉店後に出る） */
const tutResult = () => [...byId('pn').children].find(e => e.textContent.startsWith('本日の結果'));

/** 棚の在庫の合計（補充したかを見る） */
const tutStock = () => state.shelf.reduce((n, s) => n + (s ? s.st : 0), 0);

/** 1日目をいっしょに進める場面（初めての人だけ。説明のあとに続ける） */
const TUT_PRACTICE = [
    { kind: 'do', q: () => document.querySelector('#act [data-a="next"]'), tab: 0, t: '実際にやってみよう！', m: '「開業する」を押して、お店を開けよう。', done: () => state.day >= 1 },
    { kind: 'do', q: () => byId('sh'), tab: 0, t: '開店準備', m: '棚の「満タン」を押して、商品を並べよう（どの棚でもいいよ）。\n補充すると「次へ」が押せるようになるよ。', start: () => (tutBase = tutStock()), done: () => tutStock() > tutBase, manual: true },
    { kind: 'do', q: () => document.querySelector('#act [data-a="open"]'), tab: 0, t: '開店！', m: '準備ができたら「開店する」を押そう！', done: () => state.phase === 'open' },
    { kind: 'watch', q: () => byId('spd'), tab: 0, t: '営業中', m: 'お客さんが来て売れていくよ。売り切れそうな棚は補充しよう。\n右下の「×1」を押すと速くなるよ。閉店までようすを見てね。', done: () => state.phase === 'closed' },
    { q: () => tutResult(), tab: 0, t: '1日おつかれさま！', m: '今日の売上や来店した人数はここで見られるよ。\n閉店後は、投資やお金の管理ができるよ。「翌日へ進む」で次の日へ。\nそれじゃあ、がんばってね！' }
];

/** 1日目にお店を開けられなかったとき（病気・大雪・店休日など）の終わりの場面 */
const TUT_REST = { q: () => byId('act'), tab: 0, t: '今日はお休み…', m: '今日はお店を開けられない日みたい。お休みのあいだも、閉店後には投資やお金の管理ができるよ。\nそれじゃあ、がんばってね！' };

/** いま案内している場面の並び（説明だけ／説明＋1日目の練習） */
let tutList = TUT_STEPS, tutBase = 0, tutTimer = 0;

/** いまの場面（-1＝出していない）と、始める前の状態（一時停止・タブ・タブバー） */
let tutI = -1, tutPrev = null;

/** ちくわくん（吹き出しのアイコン。16×16 のドット絵を 2 倍で描く） */
function tutFace(c) {
    const g = c.getContext('2d'), R = (x, y, w, h, k) => {
        g.fillStyle = k;
        g.fillRect(x * 2, y * 2, w * 2, h * 2);
    };
    R(1, 5, 14, 7, '#E9A55B');
    R(2, 4, 12, 1, '#E9A55B');
    R(2, 12, 12, 1, '#E9A55B');
    R(3, 5, 3, 1, '#C9772E');
    R(9, 11, 4, 1, '#C9772E');
    R(11, 5, 2, 1, '#C9772E');
    R(1, 5, 2, 7, '#F3DDB2');
    R(1, 7, 1, 3, '#8a5a2e');
    R(6, 7, 1, 2, '#2a1a10');
    R(10, 7, 1, 2, '#2a1a10');
    R(7, 10, 3, 1, '#8a3a2a');
    R(5, 9, 1, 1, '#f4a6a0');
    R(11, 9, 1, 1, '#f4a6a0');
}

/** チュートリアルを始める（practice：説明のあとに1日目をいっしょに進める） */
function tutStart(practice) {
    if (tutI >= 0)
        return;
    // 練習は、開業前（0日目の閉店後）で倒産していないときだけ。最後の説明の「がんばってね」は練習の最後に回す
    practice = practice === true && state.day === 0 && state.phase === 'closed' && !state.over;
    tutList = practice ? TUT_STEPS.map((s, i) => i === TUT_STEPS.length - 1 ? Object.assign({}, s, { end: 'じゃあ次は、実際にお店を開けてみよう！' }) : s).concat(TUT_PRACTICE) : TUT_STEPS;
    hideHelp();
    tutPrev = { paused: state.paused, tab: state.tab || 0, bar: byId('tabs').classList.contains('off') };
    if (state.phase === 'open')
        state.paused = true;
    if (tutPrev.bar)
        tabBar(false, true);
    let o = byId('tut');
    if (!o) {
        o = document.createElement('div');
        o.id = 'tut';
        o.innerHTML = '<div class="tutk"></div><div class="tutk"></div><div class="tutk"></div><div class="tutk"></div><div class="tuth" id="tuth"></div><div class="tutb" id="tutb" role="dialog" aria-modal="true" aria-labelledby="tutt"><div class="tuthd"><canvas id="tutf" width="32" height="32" aria-hidden="true"></canvas><b id="tutt"></b><span class="tutn" id="tutn"></span></div><div class="tutm" id="tutm"></div><div class="tutbt"><button type="button" class="alt" data-a="tutskip">すべてスキップ</button><button type="button" data-a="tutnext" id="tutgo"></button></div></div>';
        document.body.append(o);
        tutFace(byId('tutf'));
    }
    o.hidden = false;
    tutI = 0;
    tutShow();
    clearInterval(tutTimer);
    tutTimer = setInterval(tutTick, 250);
}

/** 操作を待つ場面：条件を満たしたか見る。光らせる位置も合わせ直す（ボタンは描き直されるため） */
function tutTick() {
    if (tutI < 0)
        return;
    const s = tutList[tutI];
    if (s.done) {
        const ok = s.done();
        if (ok && !s.manual)
            return tutNext();
        byId('tutgo').disabled = !ok;
    }
    tutPlace();
}

/** 次の場面へ（1日目に開業したのにお店を開けられなかったときは、お休みの場面で終える） */
function tutNext() {
    if (tutI >= tutList.length - 1)
        return tutEnd();
    tutI++;
    if (tutList === TUT_STEPS || tutList[tutI] === TUT_REST)
        return tutShow();
    if (tutList[tutI] === TUT_PRACTICE[1] && (state.phase !== 'prep' || ill())) {
        tutList = tutList.slice(0, tutI).concat([TUT_REST]);
    }
    tutShow();
}

/** いまの場面を出す（タブを切り替え、光らせる場所へスクロールしてから位置を合わせる） */
function tutShow() {
    const s = tutList[tutI];
    if ((state.tab || 0) !== s.tab) {
        state.tab = s.tab;
        render();
    }
    byId('tutt').textContent = s.t;
    const last = tutI === tutList.length - 1;
    byId('tutm').textContent = (typeof s.m === 'function' ? s.m() : s.m) + (s.end && (last || tutList !== TUT_STEPS) ? '\n' + s.end : '');
    byId('tutn').textContent = (tutI + 1) + ' / ' + tutList.length;
    byId('tutgo').textContent = last ? 'はじめる！' : '次へ ▶';
    // 操作を待つ場面は、操作するまで「次へ」を出さない（補充の場面だけは、補充すると押せる）
    byId('tutgo').hidden = !!s.done && !s.manual;
    byId('tutgo').disabled = !!s.done;
    byId('tut').className = s.kind || '';
    if (s.start)
        s.start();
    const el = s.q && s.q();
    if (el && byId('scr').contains(el))
        el.scrollIntoView({ block: 'center' });
    tutPlace();
    byId('tutgo').focus({ preventScroll: true });
}

/** 光らせる枠と吹き出しの位置を合わせる（画面の向きが変わったときも） */
function tutPlace() {
    if (tutI < 0)
        return;
    const s = tutList[tutI], el = s.q && s.q(), h = byId('tuth'), b = byId('tutb'), W = innerWidth, H = innerHeight, M = 12, K = byId('tut').querySelectorAll('.tutk');
    b.style.maxWidth = Math.min(380, W - M * 2) + 'px';
    K.forEach(k => k.hidden = true);
    if (s.kind === 'watch') {
        // 営業中：暗くせず、店の絵のすぐ下に小さな吹き出しだけ（下の陳列棚は見えたまま、補充もできる）
        h.hidden = true;
        b.classList.remove('mid');
        const tp = byId('top').getBoundingClientRect(), sc = byId('scr').getBoundingClientRect(), bw = b.offsetWidth;
        b.style.left = Math.max(M, Math.min(sc.left + (sc.width - bw) / 2, W - M - bw)) + 'px';
        b.style.top = Math.min(Math.max(M, sc.top + 8), H - M - b.offsetHeight) + 'px';
        return;
    }
    if (!el) {
        h.hidden = true;
        b.classList.add('mid');
        b.style.left = b.style.top = '';
        return;
    }
    b.classList.remove('mid');
    const r = el.getBoundingClientRect(), p = 6;
    // 光らせる枠は画面の中に収める（大きな棚の一覧などは、見えている部分だけ）
    const x = Math.max(4, r.left - p), y = Math.max(4, r.top - p), x2 = Math.min(W - 4, r.right + p), y2 = Math.min(H - 4, r.bottom + p);
    h.hidden = false;
    Object.assign(h.style, { left: x + 'px', top: y + 'px', width: (x2 - x) + 'px', height: (y2 - y) + 'px' });
    // 操作を待つ場面：光っている所だけ押せるよう、まわりの4か所をふさぐ
    if (s.kind === 'do')
        [[0, 0, W, y], [0, y2, W, H - y2], [0, y, x, y2 - y], [x2, y, W - x2, y2 - y]].forEach(([l, t, w, hh], i) => {
            K[i].hidden = false;
            Object.assign(K[i].style, { left: l + 'px', top: t + 'px', width: w + 'px', height: hh + 'px' });
        });
    // 吹き出しは、枠の下に入ればその下、入らなければ上、どちらも入らなければ枠の中の下の方
    const bh = b.offsetHeight, bw = b.offsetWidth;
    let top = y2 + 10;
    if (top + bh > H - M)
        top = y - 10 - bh >= M ? y - 10 - bh : Math.max(M, H - M - bh);
    const left = Math.min(Math.max(M, (x + x2) / 2 - bw / 2), W - M - bw);
    b.style.left = left + 'px';
    b.style.top = top + 'px';
}

/** チュートリアルを終える（最後まで見た・飛ばした）。次からは自動で出さない */
function tutEnd() {
    if (tutI < 0)
        return;
    tutI = -1;
    clearInterval(tutTimer);
    byId('tut').hidden = true;
    CG.ls.set(TUT_KEY, '1');
    tutSyncOff();
    state.tab = tutPrev.tab;
    if (state.phase === 'open')
        state.paused = tutPrev.paused;
    if (tutPrev.bar)
        tabBar(true, true);
    render();
    save();
    byId('scr').scrollTop = 0;
}

document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b)
        return;
    const a = b.dataset.a;
    if (a === 'tutorial')
        tutStart();
    if (a === 'tutskip')
        tutEnd();
    if (a === 'tutnext')
        tutNext();
});

/** 難易度えらびの画面の「遊び方を表示しない」のチェックを、保存した状態にそろえる（見た・飛ばした端末はチェック済み） */
function tutSyncOff() {
    const c = byId('tutoff');
    if (c)
        c.checked = CG.ls.get(TUT_KEY) === '1';
}

// チェックを入れると次の難易度えらびのあとに出さない。外すと、次に難易度を選んだときにもう一度出す
byId('tutoff').addEventListener('change', e => CG.ls.set(TUT_KEY, e.target.checked ? '1' : '0'));
tutSyncOff();

addEventListener('resize', () => requestAnimationFrame(tutPlace));
document.addEventListener('keydown', e => {
    if (tutI >= 0 && e.key === 'Escape')
        tutEnd();
});

// 最初に難易度を選んだ直後に1回だけ出す（まだ見ていない端末だけ）
{
    const ng = newGame;
    newGame = function (v) {
        ng(v);
        if (state.diff && CG.ls.get(TUT_KEY) !== '1')
            setTimeout(() => tutStart(true), 250);
    };
}
