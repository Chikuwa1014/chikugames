/**
 * achv.js — 実績（v1.3.0〜）。
 *
 * 条件を満たすと解除され、「⚙設定」タブの「🏅 実績」欄に並ぶ。解除の瞬間は画面下にお知らせ（CG.toast）。
 * 保存はゲームとは別の localStorage（ACH_KEY）なので、最初からやり直しても・倒産しても消えない。
 *   形：{ <実績のid>: { at: 解除した日時(ISO), diff: 難易度のキー } }
 * 判定（achCheck）は閉店のあと（endDay）と預金の操作のあと（svMove）。ほかの関数を包むだけで、ゲームの動きは変えない。
 * 1年＝12ヶ月＝84日（1ヶ月＝MD日）。
 * ui.js の後、debuglog.js の前に読み込むこと。
 */

const ACH_KEY = 'shop-sim-achv';

/** 1年の日数（12ヶ月） */
const YEAR = MD * 12;

/** 金額を「1億」「1000億」「1兆」の形にする */
const achYen = v => v >= 1e12 ? (v / 1e12) + '兆' : v >= 1e8 ? (v / 1e8) + '億' : (v / 1e4) + '万';

/** 期間（日数）を「6ヶ月」「10年」の形にする */
const achTerm = d => d % YEAR === 0 ? (d / YEAR) + '年' : (d / MD) + 'ヶ月';

/**
 * 実績の一覧。g：見出し、v()：いまの値、n：目標、ok()：追加の条件（なければ値が目標以上で解除）
 * id は保存に使うので、公開後は変えない
 */
const ACH_GROUPS = [
    { g: '💴 累計売上', e: '💴', v: () => state.tot || 0, ns: [1e8, 1e9, 1e10, 1e11, 1e12], id: n => 'tot' + n, name: n => '累計売上 ' + achYen(n), fmt: v => '¥' + fmt(v) },
    { g: '🏪 営業', e: '🏪', v: () => state.day || 0, ns: [10 * YEAR, 50 * YEAR, 100 * YEAR], id: n => 'day' + n, name: n => '営業 ' + achTerm(n), fmt: v => '通算' + fmt(v) + '日' },
    { g: '🏦 貯金', e: '🏦', v: () => state.sv || 0, ns: [1e7, 1e8, 1e9, 1e10, 1e11, 1e12], id: n => 'sv' + n, name: n => '貯金 ' + achYen(n), fmt: v => '預金 ¥' + fmt(v) },
    { g: '🔥 インフェルノ', e: '🔥', v: () => state.diff === 'inferno' && !state.over ? state.day || 0 : 0, ns: [6 * MD, YEAR, 5 * YEAR, 10 * YEAR], id: n => 'inf' + n, name: n => 'インフェルノで ' + achTerm(n), fmt: v => state.diff === 'inferno' ? '通算' + fmt(v) + '日' : 'インフェルノで遊ぶと進みます' }
];

/** すべての実績（並び順どおり） */
const ACHS = ACH_GROUPS.flatMap(G => G.ns.map(n => ({ id: G.id(n), G, n, name: G.name(n) })));

/** 解除済み */
let achGot = CG.ls.getJSON(ACH_KEY, {});
if (!achGot || typeof achGot !== 'object' || Array.isArray(achGot))
    achGot = {};

let achSig = '';

/** 条件を満たしたものを解除する（新しく解除したものの一覧を返す） */
function achCheck() {
    if (!state || !state.diff)
        return [];
    const nw = [];
    ACHS.forEach(a => {
        if (achGot[a.id] || a.G.v() < a.n)
            return;
        achGot[a.id] = { at: new Date().toISOString(), diff: state.diff };
        nw.push(a);
    });
    if (nw.length) {
        CG.ls.setJSON(ACH_KEY, achGot);
        CG.toast('🏅 実績解除：' + nw.map(a => a.name).join('・'), 3500);
        if (typeof dbgAdd === 'function')
            dbgAdd('achv', { got: nw.map(a => a.id) });
        syncAch(true);
    }
    return nw;
}

/** 「設定」タブの実績欄（解除数が変わったとき・開いたときだけ作り直す） */
function syncAch(force) {
    const el = byId('ach');
    if (!el)
        return;
    const got = ACHS.filter(a => achGot[a.id]).length;
    const sig = got + '|' + (state.tab || 0) + '|' + state.day + '|' + Math.floor((state.tot || 0) / 1e6) + '|' + Math.floor((state.sv || 0) / 1e5);
    if (!force && sig === achSig && el.innerHTML)
        return;
    achSig = sig;
    let h = '<div class="row"><b>🏅 実績' + helpIcon('achv') + '</b><span class="achn">' + got + ' / ' + ACHS.length + '</span></div>';
    ACH_GROUPS.forEach(G => {
        const cur = G.v();
        h += '<div class="achg"><div class="achgh"><span>' + G.g + '</span><span class="meta">' + G.fmt(cur) + '</span></div><div class="achl">';
        G.ns.forEach(n => {
            const a = ACHS.find(x => x.id === G.id(n)), r = achGot[a.id];
            if (r) {
                const d = new Date(r.at), df = DF[r.diff];
                h += '<div class="ach on" title="' + (isNaN(d) ? '' : d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate()) + (df ? '・' + df.n : '') + '">' +
                    '<span class="achi">🏅</span><span class="acht">' + a.name + '</span><span class="achd">' + (isNaN(d) ? '' : (d.getMonth() + 1) + '/' + d.getDate()) + (df ? ' ' + df.n : '') + '</span></div>';
            }
            else {
                const pc = Math.max(0, Math.min(100, cur / n * 100));
                h += '<div class="ach"><span class="achi">🔒</span><span class="acht">' + a.name + '</span><span class="achp"><i style="width:' + pc + '%"></i></span></div>';
            }
        });
        h += '</div></div>';
    });
    h += '<div class="meta">実績は最初からやり直しても消えません。</div>';
    el.innerHTML = h;
}

// 閉店のあと・預金の操作のあとに判定する
['endDay', 'svMove'].forEach(name => {
    const f = window[name];
    window[name] = function () {
        const r = f.apply(this, arguments);
        achCheck();
        return r;
    };
});

// 描画のたびに実績欄をそろえる（設定タブを開いているときだけ中身を作り直す）
{
    const r0 = render;
    window.render = function () {
        r0.apply(this, arguments);
        if ((state.tab || 0) === 3)
            syncAch();
    };
}
