/**
 * save.js — セーブデータのファイル書き出し・読み込み（「設定」タブ）。
 * 自動保存（localStorage）は state.js の save()。こちらは端末をまたぐバックアップ用。
 */

/** ファイルの目印と版番号（state の形を変えたら SAVE_VER を上げ、loadFix に移行処理を書く） */
const SAVE_GAME = 'shop-sim', SAVE_VER = 2;

/** 読み込み待ちのデータ（確認してから反映）、欄に出すメッセージ */
let svPend = null, svMsg = null, svSig = '';

/** セーブ・ロードできるか（営業中は不可。倒産後は可） */
const canSL = () => state.over || state.phase !== 'open';

/** 2桁ゼロ埋め */
const p2 = n => String(n).padStart(2, '0');

/** データの概要（難易度・時期・所持金） */
function saveSummary(s, at) {
    const d = Math.max(s.day || 0, 1), m = Math.floor((d - 1) / MD) + 1, df = DF[s.diff];
    const yen = v => (v < 0 ? '-' : '') + '¥' + fmt(Math.abs(Math.round(v || 0)));
    let t = (df ? df.n : '?') + ' / ' + (s.day ? m + 'ヶ月目・通算' + s.day + '日' : '開業前') + ' / 所持金 ' + yen(s.money);
    if (s.over)
        t += '（倒産済み）';
    if (at) {
        const a = new Date(at);
        if (!isNaN(a))
            t += '<br>保存 ' + a.getFullYear() + '/' + (a.getMonth() + 1) + '/' + a.getDate() + ' ' + a.getHours() + ':' + p2(a.getMinutes());
    }
    return t;
}

/** ファイルに書き出す（.json をダウンロード） */
function exportSave() {
    if (!canSL())
        return;
    const now = new Date(), d = Math.max(state.day, 1), m = Math.floor((d - 1) / MD) + 1;
    const data = { game: SAVE_GAME, v: SAVE_VER, key: KEY, at: now.toISOString(), state };
    const name = 'ちいさなお店_' + difficulty().n + '_' + (state.day ? m + 'ヶ月目' : '開業前') + '_' +
        now.getFullYear() + p2(now.getMonth() + 1) + p2(now.getDate()) + '-' + p2(now.getHours()) + p2(now.getMinutes()) + '.json';
    const u = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })), a = document.createElement('a');
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 10000);
    svPend = null;
    svMsg = { ok: true, t: '書き出しました：' + name };
    syncSave();
}

/** 読み込んだデータが正しいか確かめる（だめなら理由の文字列、OKなら null） */
function checkSave(o) {
    if (!o || typeof o !== 'object' || o.game !== SAVE_GAME)
        return 'このゲームのセーブデータではありません。';
    if (typeof o.v !== 'number' || o.v > SAVE_VER)
        return '新しい版のセーブデータです。ゲームを最新にしてから読み込んでください。';
    const s = o.state;
    if (!s || typeof s !== 'object' || !Array.isArray(s.shelf) || !Array.isArray(s.own) || typeof s.money !== 'number' || typeof s.day !== 'number' || !DF[s.diff])
        return 'セーブデータが壊れています。';
    return null;
}

/** 古い版のデータを今の形にそろえる（足りない項目は初期値で埋める） */
function loadFix(o) {
    const s = Object.assign(fresh(), o.state);
    ['up', 'sd'].forEach(k => {
        s[k] = PRODUCTS.map((_, i) => (s[k] && s[k][i]) || 0);
    });
    s.cm = PRODUCTS.map((_, i) => (s.cm && s.cm[i]) || 1);
    // o.v が古いときの移行処理はここに追加する（例：if (o.v < 2) { ... }）
    // v2：土嚢・かまくら（prep・kama・mbDay）を追加。初期値で埋まるので移行処理なし
    return s;
}

/** ファイルを選んだら中身を確認して、反映待ちにする */
function importFile(f) {
    if (!f)
        return;
    const r = new FileReader();
    r.onload = () => {
        let o = null;
        try {
            o = JSON.parse(r.result);
        }
        catch (e) { }
        const err = o ? checkSave(o) : 'ファイルを読み取れませんでした（JSONではありません）。';
        svPend = err ? null : o;
        svMsg = err ? { ok: false, t: err } : null;
        syncSave();
    };
    r.onerror = () => {
        svPend = null;
        svMsg = { ok: false, t: 'ファイルを読み取れませんでした。' };
        syncSave();
    };
    r.readAsText(f);
}

/** 反映待ちのデータで再開する */
function applyLoad() {
    if (!svPend || !canSL())
        return;
    state = loadFix(svPend);
    svPend = null;
    if (!LA.includes(state.ln.a))
        state.ln.a = LA[0];
    state.paused = false;
    state.tab = 0;
    applyDiff();
    applyUp();
    dragMg = false;
    ovFor = null;
    addLog('💾 セーブデータを読み込みました。');
    svMsg = { ok: true, t: '読み込みました。' };
    render();
    save();
    byId('scr').scrollTop = 0;
}

/** 「設定」タブのセーブ欄（内容が変わったときだけ作り直す） */
function syncSave() {
    const el = byId('svd');
    if (!el)
        return;
    const ok = canSL(), sig = [ok, svPend && svPend.at, svMsg && svMsg.t].join('|');
    if (sig === svSig)
        return;
    svSig = sig;
    let h = '<b>💾 セーブデータ</b>' + helpIcon('save');
    if (!ok)
        h += '<div class="meta svwarn">営業中はセーブ・ロードできません。閉店後に操作してください。</div>';
    h += '<div class="row"><button data-a="fsave"' + (ok ? '' : ' disabled') + '>📤 ファイルに書き出す</button><button class="alt" data-a="fload"' + (ok ? '' : ' disabled') + '>📥 ファイルから読み込む</button></div>';
    if (svPend)
        h += '<div class="svpend"><b>このデータで再開しますか？</b><div class="meta">' + saveSummary(svPend.state, svPend.at) + '</div><div class="meta svwarn">今のデータは上書きされます。必要なら先に書き出してください。</div>' +
            '<div class="row"><button data-a="fok"' + (ok ? '' : ' disabled') + '>このデータで再開</button><button class="alt" data-a="fno">やめる</button></div></div>';
    if (svMsg)
        h += '<div class="meta ' + (svMsg.ok ? 'svok' : 'svwarn') + '">' + (svMsg.ok ? '✅ ' : '⚠ ') + svMsg.t + '</div>';
    el.innerHTML = h;
}
