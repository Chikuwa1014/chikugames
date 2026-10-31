/**
 * builder.js — スタイルビルダー（v2.4.0〜）。styles.js と clear.js の後に読む。
 *
 * プレイヤーが自分でお店のスタイルを作れる。解放の条件は「お店10店舗（出店の上限）」と「純資産10億円」（2026-10-31 開発者が決定）。
 * そろった日の閉店後（engine.js の endDay の最後で sbCheck）に解放し、ちくわくんがお知らせする。一度解放したら消えない（state.co.sbU＝解放した日）。
 * 持てるのは、はじめ SB_INIT（3）個まで。広告を見ると1つずつ増え、最大 SB_MAX（5）個（state.co.sbX＝広告で増やした数。2026-10-31 開発者が決定）。state.co.myS に入る（{ id:'my…', my:true, n, e, d, r, c, cust, items[12]{ e, n, c, g, up[7] } }）。
 * 来店数の倍率 cust はプレイヤーが決めず、原価から自動で決める（12個の「原価÷いつもの原価」の相乗平均の逆数。2026-10-29 のビルダーの試作と同じ考え方）。
 * 作ったスタイルは styles.js の styAll に入り、新しいお店と改装で選べる（広告での解放はいらない）。
 * お店で使っているスタイルは、原価とよく買う人を変えられない（名前・絵・説明・色・商品の名前と絵は変えられる）。消せるのは、使っているお店が無いときだけ。
 */

/** 解放の条件 */
const SB_NEED = { stores: 10, net: 1e9 };
/** 持てるスタイルの数（はじめ SB_INIT、広告で増やして最大 SB_MAX） */
const SB_INIT = 3, SB_MAX = 5;

/** いま持てる数 */
const sbCap = () => Math.min(SB_MAX, SB_INIT + ((state.co && state.co.sbX) || 0));
/** アップグレードの名前が空のときに前に付ける言葉 */
const SB_TIER = ['お手ごろ', '定番', '人気の', '限定', 'プレミアム', '職人の', '伝説の'];
/** 原価の下限と上限 */
const SB_MINC = 10, SB_MAXC = 10000000;

/** 純資産（会社タブと同じ：所持金＋預金＋資本金−借入） */
const sbNet = () => {
    const debt = (state.loans || []).reduce((a, l) => a + l.pay * l.left, 0);
    return Math.round(state.money + (state.sv || 0) + ((state.co && state.co.cap) || 0) - debt);
};

/** 条件ごとの今の値と達成したか */
const sbParts = () => [
    { n: 'お店の数', v: allStores().length + '店舗', g: SB_NEED.stores + '店舗', ok: allStores().length >= SB_NEED.stores },
    { n: '純資産', v: yen(sbNet()), g: yen(SB_NEED.net), ok: sbNet() >= SB_NEED.net }
];

/** 解放済みか */
const sbOn = () => !!(state.co && state.co.sbU);

/** 作ったスタイル */
const sbMine = () => (state.co && state.co.myS) || [];

/** そのスタイルを使っているお店の数 */
const sbUsed = id => allStores().filter(s => !isShisha(s) && s.sty === id).length;

/** 来店数の倍率（原価から自動。0.02〜1.2） */
const sbCust = items => {
    const B = STYLES[0].items;
    let a = 0;
    items.forEach((p, i) => a += Math.log(Math.max(1, p.c) / B[i].c));
    return Math.round(Math.min(1.2, Math.max(0.02, 1 / Math.exp(a / items.length))) * 100) / 100;
};

/** 値段の倍率（いつもの何倍か） */
const sbPrice = items => {
    const B = STYLES[0].items;
    let a = 0;
    items.forEach((p, i) => a += Math.log(Math.max(1, p.c) / B[i].c));
    return Math.exp(a / items.length);
};

/** 入力の文字を整える（HTML の記号を消し、長さをそろえる） */
const sbTxt = (t, n) => [...String(t || '').replace(/[<>&"'`]/g, '').trim()].slice(0, n).join('');

/** 閉店のたびに調べる（まだで、条件がそろったら解放してお知らせ） */
function sbCheck() {
    if (!state.co || !state.co.est || sbOn() || state.over || !sbParts().every(p => p.ok))
        return;
    state.co.sbU = state.day;
    addEvent('🛠️ スタイルビルダーが使えるようになりました！会社タブから、自分だけのお店のスタイルを作れます');
    save();
    setTimeout(() => sbOpen('hello'), 400);
}

/** 会社タブのカード */
function sbCard() {
    if (!state.co || !state.co.est)
        return '';
    if (!sbOn())
        return '<div class="card sbc"><b>🛠️ スタイルビルダー 🔒</b><div class="meta">自分だけのお店のスタイル（商品12個・色・名前）を作れるようになります。解放の条件：</div><div class="sbneed">'
            + sbParts().map(p => '<span class="' + (p.ok ? 'ok' : '') + '">' + (p.ok ? '✅' : '⬜') + ' ' + p.n + ' ' + p.g + '<small>いま ' + p.v + '</small></span>').join('') + '</div></div>';
    const M = sbMine();
    return '<div class="card sbc"><b>🛠️ スタイルビルダー</b><div class="meta">自分だけのお店のスタイルを作れます（' + M.length + ' / ' + sbCap() + '）。作ったスタイルは、新しいお店と「🎨 スタイル」の改装で選べます。</div>'
        + (M.length ? '<div class="sbmine">' + M.map(t => '<span>' + t.e + ' ' + t.n + '</span>').join('') + '</div>' : '')
        + '<button class="big" data-a="sbopen">🛠️ スタイルビルダーを開く</button></div>';
}

/** 編集中のスタイル（保存するまで state には入れない）と、そのもと（新しく作るときは null） */
let sbDraft = null, sbEditId = null;

/** ビルダーの画面を開く（v：'list' 一覧・'edit' 編集・'hello' 解放のお知らせ・'close' 閉じる） */
function sbOpen(v) {
    let el = byId('sbm');
    if (v === 'close') {
        if (el)
            el.hidden = true;
        sbDraft = null;
        return;
    }
    if (!el) {
        el = document.createElement('div');
        el.id = 'sbm';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        document.body.appendChild(el);
    }
    const top = t => '<div class="achtop"><b>' + t + '</b><button class="alt achx" data-a="sbclose" aria-label="閉じる">✕</button></div>';
    if (v === 'hello') {
        el.innerHTML = '<div class="ovbox sbbox sbhi">' + top('🛠️ スタイルビルダー') + '<div class="clrsay"><canvas class="clrface" width="32" height="32"></canvas><p>お店が10軒、純資産も10億円！ここまで来たきみなら、自分だけのお店をつくれるよ。商品も色も名前も、ぜんぶきみが決めていいんだ。</p></div>'
            + '<button class="big" data-a="sblist">🛠️ さっそく作ってみる</button><button class="alt sblater" data-a="sbclose">あとで（会社タブから開けます）</button></div>';
        tutFace(el.querySelector('.clrface'));
    }
    else if (v === 'edit' && sbDraft)
        el.innerHTML = '<div class="ovbox cobox sbbox">' + top(sbEditId ? '🛠️ スタイルを直す' : '🛠️ 新しいスタイル') + '<div class="achbody">' + sbForm() + '</div></div>';
    else {
        const M = sbMine(), O = styAll().filter(t => styOpen().includes(t.id));
        el.innerHTML = '<div class="ovbox cobox sbbox">' + top('🛠️ スタイルビルダー') + '<div class="achbody">'
            + '<div class="meta">自分だけのお店のスタイルを、いまは' + sbCap() + 'つまで持てます' + (sbCap() < SB_MAX ? '（広告を見ると増やせます。最大' + SB_MAX + 'つ）' : '') + '。来店数は商品の原価から自動で決まります（高い商品ばかりだとお客さんは少なめ、安い商品ばかりだと多め）。</div>'
            + '<div class="styl">' + (M.length ? M.map(t => {
                const u = sbUsed(t.id);
                return '<div class="styr"><span class="ste">' + t.e + '</span><div class="stx"><b>' + t.n + '</b><span>' + (t.d || '') + '</span><span class="styit">' + t.items.map(p => p.e).join('') + '</span><span class="meta">来店数×' + t.cust + (u ? '・' + u + '店で営業中' : '') + '</span></div>'
                    + '<div class="sbbtn"><button data-a="sbedit" data-v="' + t.id + '">直す</button><button class="alt" data-a="sbdel" data-v="' + t.id + '"' + (u ? ' disabled' : '') + '>消す</button></div></div>';
            }).join('') : '<div class="meta">まだありません。</div>') + '</div>'
            + (M.length < sbCap() ? '<div class="card sbnew"><b>＋ 新しく作る</b><label class="cof">もとにするスタイル<select id="sbbase">' + O.map(t => '<option value="' + t.id + '">' + t.e + ' ' + t.n + '</option>').join('') + '</select></label><button class="big" data-a="sbnew">このスタイルをもとに作る</button></div>' : '<div class="meta">いっぱいです。新しく作るときは、どれかを消してください（使っているお店があるスタイルは消せません）。</div>')
            + (sbCap() < SB_MAX ? (CG.ad.ready() ? '<button class="alt sblater" data-a="sbslot">📺 広告を見て、持てる数を1つ増やす（' + sbCap() + ' → ' + (sbCap() + 1) + '）</button>' : '<div class="meta">🔒 あと' + (SB_MAX - sbCap()) + 'つ分は、広告で増やせるようになる予定です。</div>') : '')
            + '</div></div>';
    }
    el.hidden = false;
    if (v === 'edit')
        sbSync();
}

/** 編集の欄 */
function sbForm() {
    const t = sbDraft, lock = sbEditId && sbUsed(sbEditId) > 0;
    const G = [['a', 'みんな'], ['m', '男性'], ['f', '女性']];
    const inp = (k, v, ph, n, w) => '<input data-sb="' + k + '" value="' + esc(v) + '" placeholder="' + ph + '" maxlength="' + n + '"' + (w ? ' class="' + w + '"' : '') + '>';
    return '<div class="sbpv"><canvas width="96" height="60"></canvas><span class="sbpe">' + t.e + '</span></div>'
        + '<div class="sbrow">' + inp('e', t.e, '🏬', 4, 'sbe') + inp('n', t.n, 'スタイルの名前', 12, 'sbn') + '</div>'
        + inp('d', t.d || '', '説明（例：○○を扱うお店）', 24, 'sbd')
        + '<div class="sbrow sbcol"><label>屋根の色<input type="color" data-sb="r" value="' + t.r + '"></label><label>看板の色<input type="color" data-sb="c" value="' + t.c + '"></label></div>'
        + '<div class="sbbal" id="sbbal"></div>'
        + (lock ? '<div class="meta svwarn">このスタイルのお店が営業中なので、原価とよく買う人は変えられません（名前・絵・色は変えられます）。</div>' : '<div class="meta">原価は ' + yen(SB_MINC) + '〜' + yen(SB_MAXC) + '。保存すると、安い順に並べ替えます（棚は安い順に増えていきます）。</div>')
        + '<div class="sbits">' + t.items.map((p, i) => '<div class="sbit"><div class="sbrow"><span class="sbno">' + (i + 1) + '</span>' + inp(i + '.e', p.e, '📦', 4, 'sbe') + inp(i + '.n', p.n, '商品の名前', 9, 'sbn')
            + '<input type="number" data-sb="' + i + '.c" value="' + p.c + '" min="' + SB_MINC + '" max="' + SB_MAXC + '" step="1" inputmode="numeric" class="sbcst"' + (lock ? ' disabled' : '') + '>'
            + '<select data-sb="' + i + '.g"' + (lock ? ' disabled' : '') + '>' + G.map(g => '<option value="' + g[0] + '"' + (p.g === g[0] ? ' selected' : '') + '>' + g[1] + '</option>').join('') + '</select></div>'
            + '<details><summary>上位品の名前（空なら「<span class="sbup1">' + SB_TIER[1] + (p.n || '◯◯') + '</span>」のように自動）</summary><div class="sbups">' + p.up.map((u, k) => '<input data-sb="' + i + '.u' + k + '" value="' + esc(u) + '" placeholder="' + SB_TIER[k] + (p.n || '◯◯') + '" maxlength="12">').join('') + '</div></details></div>').join('') + '</div>'
        + '<div class="sberr" id="sberr"></div>'
        + '<button class="big" data-a="sbsave">保存する</button><button class="alt sblater" data-a="sblist">やめる（一覧へ）</button>';
}

/** 見本の絵とバランスの表示を今の入力に合わせる */
function sbSync() {
    const el = byId('sbm'), t = sbDraft;
    if (!el || !t)
        return;
    const cv = el.querySelector('.sbpv canvas');
    if (cv)
        clrShop(cv, state, { r: t.r, c: t.c });
    const pe = el.querySelector('.sbpe');
    if (pe)
        pe.textContent = t.e;
    // 上位品の名前の見本（空のときに付く名前）を、いまの商品の名前に合わせる
    el.querySelectorAll('.sbit').forEach((d, i) => {
        const n = t.items[i].n || '◯◯', s = d.querySelector('.sbup1');
        if (s)
            s.textContent = SB_TIER[1] + n;
        d.querySelectorAll('.sbups input').forEach((x, k) => x.placeholder = SB_TIER[k] + n);
    });
    const b = byId('sbbal');
    if (b) {
        const p = sbPrice(t.items), c = sbCust(t.items);
        b.innerHTML = '<span>値段 <b>いつもの×' + (p >= 10 ? p.toFixed(0) : p.toFixed(2)) + '</b></span><span>来店数 <b>×' + c + '</b>（自動）</span>';
    }
}

/** 入力を確かめて、まちがいの一覧を返す */
function sbErrors(t) {
    const out = [];
    if (!sbTxt(t.n, 12))
        out.push('スタイルの名前を入れてください。');
    if (styAll().some(x => x.id !== sbEditId && x.n === sbTxt(t.n, 12)))
        out.push('同じ名前のスタイルがあります。');
    t.items.forEach((p, i) => {
        if (!sbTxt(p.n, 9))
            out.push((i + 1) + '番目の商品の名前を入れてください。');
        if (!(p.c >= SB_MINC && p.c <= SB_MAXC))
            out.push((i + 1) + '番目の原価は' + yen(SB_MINC) + '〜' + yen(SB_MAXC) + 'にしてください。');
    });
    return out;
}

/** 保存する */
function sbSave() {
    const t = sbDraft, c = state.co;
    if (!t || !c)
        return;
    const er = sbErrors(t);
    if (er.length) {
        const e = byId('sberr');
        if (e)
            e.innerHTML = er.map(x => '<div>⚠️ ' + x + '</div>').join('');
        return CG.toast(er[0], 2200);
    }
    const old = sbEditId && sbMine().find(x => x.id === sbEditId), lock = old && sbUsed(old.id) > 0;
    let items = t.items.map((p, i) => {
        const n = sbTxt(p.n, 9);
        return { e: sbTxt(p.e, 4) || '📦', n, c: lock ? old.items[i].c : Math.round(p.c), g: lock ? old.items[i].g : (['a', 'm', 'f'].includes(p.g) ? p.g : 'a'), up: p.up.map((u, k) => sbTxt(u, 12) || SB_TIER[k] + n) };
    });
    if (!lock)
        items = items.sort((a, b) => a.c - b.c);
    const s = { id: old ? old.id : 'my' + Date.now().toString(36), my: true, n: sbTxt(t.n, 12), e: sbTxt(t.e, 4) || '🏬', d: sbTxt(t.d, 24), r: /^#[0-9a-f]{6}$/i.test(t.r) ? t.r : '#2fbf97', c: /^#[0-9a-f]{6}$/i.test(t.c) ? t.c : '#ff7a68', cust: sbCust(items), items };
    c.myS = old ? sbMine().map(x => x.id === old.id ? s : x) : sbMine().concat(s);
    if (styAlt() && styAlt().id === s.id)
        applyKind();
    addEvent('🛠️ スタイル「' + s.e + ' ' + s.n + '」を' + (old ? '直しました' : '作りました') + '（来店数×' + s.cust + '）');
    sbEditId = null;
    sbDraft = null;
    sbOpen('list');
    render();
    save();
}

/** 編集を始める（id：直すスタイル、base：新しく作るときのもと） */
function sbStart(id, base) {
    const src = id ? sbMine().find(x => x.id === id) : styAll().find(x => x.id === base) || STYLES[0];
    if (!src || (!id && sbMine().length >= sbCap()))
        return;
    sbEditId = id || null;
    sbDraft = JSON.parse(JSON.stringify({ n: id ? src.n : '', e: src.e, d: id ? (src.d || '') : '', r: src.r, c: src.c, items: src.items.map(p => ({ e: p.e, n: p.n, c: p.c, g: p.g || 'a', up: id ? p.up : p.up.map(() => '') })) }));
    sbOpen('edit');
}

/** 広告を見て、持てる数を1つ増やす */
function sbSlotAd() {
    const c = state.co;
    if (!c || sbCap() >= SB_MAX || !CG.ad.ready())
        return;
    CG.ad.reward({ name: 'builder-slot' }).then(ok => {
        if (!ok)
            return CG.toast('広告を最後まで見ると増やせます', 2200);
        c.sbX = Math.min(SB_MAX - SB_INIT, (c.sbX || 0) + 1);
        addEvent('🔓 スタイルビルダーで持てる数が' + sbCap() + 'つになりました');
        sbOpen('list');
        render();
        save();
    });
}

/** 消す（使っているお店が無いときだけ） */
function sbDel(id) {
    const t = sbMine().find(x => x.id === id);
    if (!t || sbUsed(id))
        return;
    if (!confirm('「' + t.n + '」を消しますか？（元にもどせません）'))
        return;
    state.co.myS = sbMine().filter(x => x.id !== id);
    if (state.co.ssel === id)
        state.co.ssel = 'normal';
    addEvent('🗑️ スタイル「' + t.e + ' ' + t.n + '」を消しました');
    sbOpen('list');
    render();
    save();
}

document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled)
        return;
    const a = b.dataset.a;
    if (a === 'sbopen' || a === 'sblist')
        sbOpen('list');
    if (a === 'sbclose')
        sbOpen('close');
    if (a === 'sbnew')
        sbStart(null, (byId('sbbase') || {}).value);
    if (a === 'sbedit')
        sbStart(b.dataset.v);
    if (a === 'sbdel')
        sbDel(b.dataset.v);
    if (a === 'sbsave')
        sbSave();
    if (a === 'sbslot')
        sbSlotAd();
});

// 入力のたびに下書きへ入れる（画面は作り直さない。入力中の欄を消さないため）
['input', 'change'].forEach(ev => document.addEventListener(ev, e => {
    const k = e.target.dataset && e.target.dataset.sb;
    if (!k || !sbDraft)
        return;
    const v = e.target.value, m = k.match(/^(\d+)\.(e|n|c|g|u(\d))$/);
    if (!m)
        sbDraft[k] = v;
    else {
        const p = sbDraft.items[+m[1]];
        if (m[2] === 'c')
            p.c = Math.round(+v || 0);
        else if (m[3] !== undefined)
            p.up[+m[3]] = v;
        else
            p[m[2]] = v;
    }
    sbSync();
}));
