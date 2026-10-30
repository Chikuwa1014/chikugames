/**
 * achv.js — 実績（v1.3.0〜）。
 *
 * 条件を満たすと解除される。所持金の行のバッジ「🏅 解除数/18」（#achb）をタップすると一覧のポップアップ（#achm）が開く（v1.4.0〜。
 * それまでは設定タブに置いていた）。解除の瞬間は画面下にお知らせ（CG.toast）。
 * 一覧の下の「実績をリセット」で、ページ内の確認画面を出してから ACH_KEY を消す（v1.4.0〜）。
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
    { g: '💴 累計売上', e: '💴', v: () => state.tot || 0, ns: [1e8, 1e9, 1e10, 1e11, 1e12], id: n => 'tot' + n, name: n => '累計売上 ' + achYen(n), fmt: v => yen(v) },
    { g: '🏪 営業', e: '🏪', v: () => state.day || 0, ns: [10 * YEAR, 50 * YEAR, 100 * YEAR], id: n => 'day' + n, name: n => '営業 ' + achTerm(n), fmt: v => '通算' + fmt(v) + '日' },
    { g: '🏦 貯金', e: '🏦', v: () => state.sv || 0, ns: [1e7, 1e8, 1e9, 1e10, 1e11, 1e12], id: n => 'sv' + n, name: n => '貯金 ' + achYen(n), fmt: v => '預金 ' + yen(v) },
    { g: '🏆 クリア', e: '🏆', v: () => state.co && state.co.clr ? 1 : 0, ns: [1], id: () => 'clear', name: () => 'ちいさなお店をクリア', fmt: v => v ? 'クリア済み' : '累計売上1兆円・5店舗・預金1,000億円・営業50年' },
    { g: '🔥 インフェルノ', e: '🔥', v: () => state.diff === 'inferno' && !state.over ? state.day || 0 : 0, ns: [6 * MD, YEAR, 5 * YEAR, 10 * YEAR], id: n => 'inf' + n, name: n => 'インフェルノで ' + achTerm(n), fmt: v => state.diff === 'inferno' ? '通算' + fmt(v) + '日' : 'インフェルノで遊ぶと進みます' }
];

/** すべての実績（並び順どおり） */
const ACHS = ACH_GROUPS.flatMap(G => G.ns.map(n => ({ id: G.id(n), G, n, name: G.name(n) })));

/** 解除済み */
let achGot = CG.ls.getJSON(ACH_KEY, {});
if (!achGot || typeof achGot !== 'object' || Array.isArray(achGot))
    achGot = {};

let achSig = '';

/** ポップアップを開いているか／リセットの確認画面を出しているか */
let achOpen = false, achAsk = false;

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
        syncAchBadge();
        syncAch(true);
    }
    return nw;
}

/** 所持金の行のバッジ（解除数） */
function syncAchBadge() {
    const b = byId('achb');
    if (!b)
        return;
    const t = '🏅 ' + ACHS.filter(a => achGot[a.id]).length + '/' + ACHS.length;
    if (b.textContent !== t)
        b.textContent = t;
}

/** 実績のポップアップ（開いているときだけ、内容が変わったら作り直す） */
function syncAch(force) {
    let el = byId('achm');
    if (!achOpen) {
        if (el)
            el.hidden = true;
        return;
    }
    if (!el) {
        el = document.createElement('div');
        el.id = 'achm';
        el.addEventListener('click', e => {
            if (e.target === el)
                achShow(false);
        });
        document.body.appendChild(el);
    }
    el.hidden = false;
    const got = ACHS.filter(a => achGot[a.id]).length;
    const sig = got + '|' + achAsk + '|' + state.day + '|' + Math.floor((state.tot || 0) / 1e6) + '|' + Math.floor((state.sv || 0) / 1e5);
    if (!force && sig === achSig && el.innerHTML)
        return;
    achSig = sig;
    const box = el.querySelector('.achbody'), st = box ? box.scrollTop : 0;
    let h = '<div class="ovbox achbox"><div class="achtop"><b>🏅 実績' + helpIcon('achv') + '</b><span class="achn">' + got + ' / ' + ACHS.length + '</span><button class="alt achx" data-a="achclose" aria-label="閉じる">✕</button></div><div class="achbody">';
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
    h += '<div class="meta" style="margin-top:10px">実績は最初からやり直しても消えません。</div>';
    if (achAsk)
        h += '<div class="card rst achask"><b>⚠ 本当に消しますか？</b><div class="meta">解除した実績' + got + '個がすべて消え、元に戻せません。今のお店の数字がすでに条件を満たしている実績は、次の閉店のあとにもう一度解除されます。</div><div class="btns"><button class="rstb" data-a="achdel">消す</button><button class="alt" data-a="achno">やめる</button></div></div>';
    else
        h += '<button class="alt achr" data-a="achask"' + (got ? '' : ' disabled') + '>🗑 実績をリセット</button>';
    h += '</div></div>';
    el.innerHTML = h;
    const nb = el.querySelector('.achbody');
    if (nb)
        nb.scrollTop = achAsk ? nb.scrollHeight : st;
}

/** ポップアップを開く・閉じる */
function achShow(on) {
    achOpen = on;
    achAsk = false;
    achSig = '';
    if (!on)
        hideHelp();
    syncAch(true);
}

/** 実績をすべて消す（確認画面の「消す」） */
function achReset() {
    achGot = {};
    CG.ls.setJSON(ACH_KEY, achGot);
    achAsk = false;
    if (typeof dbgAdd === 'function')
        dbgAdd('achv', { reset: true });
    CG.toast('🗑 実績をリセットしました', 2500);
    syncAchBadge();
    syncAch(true);
}

document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled)
        return;
    const a = b.dataset.a;
    if (a === 'achopen')
        achShow(true);
    if (a === 'achclose')
        achShow(false);
    if (a === 'achask' || a === 'achno') {
        achAsk = a === 'achask';
        syncAch(true);
    }
    if (a === 'achdel')
        achReset();
});

// 閉店のあと・預金の操作のあとに判定する
['endDay', 'svMove'].forEach(name => {
    const f = window[name];
    window[name] = function () {
        const r = f.apply(this, arguments);
        achCheck();
        return r;
    };
});

// 描画のたびにバッジをそろえる（ポップアップは開いているときだけ中身を作り直す）
{
    const r0 = render;
    window.render = function () {
        r0.apply(this, arguments);
        syncAchBadge();
        syncAch();
    };
}
