/**
 * tutorial.js — 遊び方（チュートリアル。v2.0.0〜）。
 * 画面を暗くして説明する場所だけを光らせ、ちくわくんの吹き出しで順に案内する。タブは自動で切り替える。
 * ・最初に難易度を選んだ直後に1回だけ出す（`newGame` を包む）。今遊んでいる人（セーブがある人）には自動では出さない
 * ・どの場面でも「スキップ」で飛ばせる。最後まで見るか飛ばしたら、端末に `TUT_KEY` を保存して次からは出さない（ゲームのセーブには入れない）
 * ・設定タブの「📖 遊び方を見る」（data-a="tutorial"）でいつでも見直せる。営業中に開いたら、その間は一時停止する
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
    { q: () => document.querySelector('#tabs [data-v="3"]'), tab: 3, t: '設定タブと「？」', m: 'セーブの書き出し・読み込みや、最初からやり直すのはここ。\n分からないところは小さな「？」を押すと説明が出るよ。遊び方は設定の「📖 遊び方を見る」から見直せるよ。\nそれじゃあ、がんばってね！' }
];

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

/** チュートリアルを始める */
function tutStart() {
    if (tutI >= 0)
        return;
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
        o.innerHTML = '<div class="tuth" id="tuth"></div><div class="tutb" id="tutb" role="dialog" aria-modal="true" aria-labelledby="tutt"><div class="tuthd"><canvas id="tutf" width="32" height="32" aria-hidden="true"></canvas><b id="tutt"></b><span class="tutn" id="tutn"></span></div><div class="tutm" id="tutm"></div><div class="tutbt"><button type="button" class="alt" data-a="tutskip">スキップ</button><button type="button" data-a="tutnext" id="tutgo"></button></div></div>';
        document.body.append(o);
        tutFace(byId('tutf'));
    }
    o.hidden = false;
    tutI = 0;
    tutShow();
}

/** いまの場面を出す（タブを切り替え、光らせる場所へスクロールしてから位置を合わせる） */
function tutShow() {
    const s = TUT_STEPS[tutI];
    if ((state.tab || 0) !== s.tab) {
        state.tab = s.tab;
        render();
    }
    byId('tutt').textContent = s.t;
    byId('tutm').textContent = typeof s.m === 'function' ? s.m() : s.m;
    byId('tutn').textContent = (tutI + 1) + ' / ' + TUT_STEPS.length;
    byId('tutgo').textContent = tutI === TUT_STEPS.length - 1 ? 'はじめる！' : '次へ ▶';
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
    const s = TUT_STEPS[tutI], el = s.q && s.q(), h = byId('tuth'), b = byId('tutb'), W = innerWidth, H = innerHeight, M = 12;
    b.style.maxWidth = Math.min(380, W - M * 2) + 'px';
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
    byId('tut').hidden = true;
    CG.ls.set(TUT_KEY, '1');
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
    if (a === 'tutnext') {
        if (tutI >= TUT_STEPS.length - 1)
            tutEnd();
        else {
            tutI++;
            tutShow();
        }
    }
});

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
            setTimeout(tutStart, 250);
    };
}
