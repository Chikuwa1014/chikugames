/**
 * save.js — セーブデータのファイル書き出し・読み込みと、セーブコード（「設定」タブ）。
 * 自動保存（localStorage）は state.js の save()。こちらは端末をまたぐバックアップ用。
 * ファイル・コードの作り方と読み方は共通部品 common/v1/save.js（CG.save）。ここはゲームに合わせた確認と画面だけ。
 * 包みの形：{ game:'shop-sim', v:SAVE_VER, at, data:state, key }（v1.1.x までのファイルは data の代わりに state。CG.save が読める形にそろえる）
 */

/** ファイルの目印と版番号（state の形を変えたら SAVE_VER を上げ、loadFix に移行処理を書く） */
const SAVE_GAME = 'shop-sim', SAVE_VER = 2;

/** 読み込み待ちのデータ（確認してから反映）、欄に出すメッセージ、作ったセーブコード、コード入力欄を開いているか */
let svPend = null, svMsg = null, svSig = '', svCode = '', svIn = false;

/** セーブ・ロードできるか（営業中は不可。倒産後は可） */
const canSL = () => state.over || state.phase !== 'open';

/** 2桁ゼロ埋め */
const p2 = CG.p2;

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
    const box = Object.assign(CG.save.wrap(state, SAVE_VER), { key: KEY });
    const name = 'ちいさなお店_' + difficulty().n + '_' + (state.day ? m + 'ヶ月目' : '開業前') + '_' +
        now.getFullYear() + p2(now.getMonth() + 1) + p2(now.getDate()) + '-' + p2(now.getHours()) + p2(now.getMinutes()) + '.json';
    CG.save.toFile(box, name);
    svPend = null;
    svMsg = { ok: true, t: '書き出しました：' + name };
    syncSave();
}

/** 読み込んだデータが正しいか確かめる（だめなら理由の文字列、OKなら null）。形とゲーム名は CG.save が確かめ済み */
function checkSave(o) {
    if (!o || typeof o !== 'object' || o.game !== SAVE_GAME)
        return 'このゲームのセーブデータではありません。';
    if (typeof o.v !== 'number' || o.v > SAVE_VER)
        return '新しい版のセーブデータです。ゲームを最新にしてから読み込んでください。';
    const s = o.data;
    if (!s || typeof s !== 'object' || !Array.isArray(s.shelf) || !Array.isArray(s.own) || typeof s.money !== 'number' || typeof s.day !== 'number' || !DF[s.diff])
        return 'セーブデータが壊れています。';
    return null;
}

/** 古い版のデータを今の形にそろえる（足りない項目は初期値で埋める） */
function loadFix(o) {
    const s = Object.assign(fresh(), o.data);
    ['up', 'sd'].forEach(k => {
        s[k] = PRODUCTS.map((_, i) => (s[k] && s[k][i]) || 0);
    });
    s.cm = PRODUCTS.map((_, i) => (s.cm && s.cm[i]) || 1);
    // o.v が古いときの移行処理はここに追加する（例：if (o.v < 2) { ... }）
    // v2：土嚢・かまくら（prep・kama・mbDay）を追加。初期値で埋まるので移行処理なし
    return s;
}

/** 読んだ包み（Promise）を確かめて、反映待ちにする */
async function pendFrom(p) {
    let o = null, err = null;
    try {
        o = await p;
        err = checkSave(o);
    }
    catch (e) {
        err = e.message;
    }
    svPend = err ? null : o;
    svMsg = err ? { ok: false, t: err } : null;
    syncSave();
}

/** ファイルを選んだら中身を確認して、反映待ちにする */
function importFile(f) {
    if (f)
        pendFrom(CG.save.fromFile(f));
}

/** セーブコードを作ってコピーする（コピーできなくても、欄に出すので手でコピーできる） */
async function makeCode() {
    if (!canSL())
        return;
    try {
        svCode = await CG.save.toCode(Object.assign(CG.save.wrap(state, SAVE_VER), { key: KEY }));
    }
    catch (e) {
        svCode = '';
        svMsg = { ok: false, t: 'セーブコードを作れませんでした。' };
        syncSave();
        return;
    }
    svPend = null;
    svIn = false;
    const ok = await CG.copy(svCode);
    svMsg = ok ? { ok: true, t: 'セーブコードをコピーしました（' + fmt(svCode.length) + '文字）。メモ帳などに貼って保管してください。' } : { ok: false, t: 'コピーできませんでした。下の欄を長押しして全部コピーしてください。' };
    syncSave();
}

/** 貼り付けたセーブコードを確かめて、反映待ちにする */
function readCode() {
    const t = byId('svci');
    const v = t ? t.value.trim() : '';
    if (!v) {
        svMsg = { ok: false, t: 'セーブコードを貼り付けてください。' };
        syncSave();
        return;
    }
    pendFrom(CG.save.fromCode(v));
}

/** 反映待ちのデータで再開する */
function applyLoad() {
    if (!svPend || !canSL())
        return;
    state = loadFix(svPend);
    svPend = null;
    svCode = '';
    svIn = false;
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
    const ok = canSL(), sig = [ok, svPend && svPend.at, svMsg && svMsg.t, svCode, svIn].join('|');
    if (sig === svSig)
        return;
    svSig = sig;
    const old = byId('svci'), typed = old ? old.value : '';
    const dis = ok ? '' : ' disabled';
    let h = '<b>💾 セーブデータ</b>' + helpIcon('save');
    if (!ok)
        h += '<div class="meta svwarn">営業中はセーブ・ロードできません。閉店後に操作してください。</div>';
    h += '<div class="row"><button data-a="fsave"' + dis + '>📤 ファイルに書き出す</button><button class="alt" data-a="fload"' + dis + '>📥 ファイルから読み込む</button></div>';
    h += '<div class="svsub">🔑 セーブコード' + helpIcon('code') + '</div>' +
        '<div class="row"><button data-a="ccopy"' + dis + '>📋 コードをコピー</button><button class="alt" data-a="cin"' + dis + '>⌨ コードで読み込む</button></div>';
    if (svCode)
        h += '<textarea class="svcode" readonly rows="3" onfocus="this.select()">' + CG.esc(svCode) + '</textarea>';
    if (svIn)
        h += '<textarea class="svcode" id="svci" rows="3" placeholder="ここにセーブコード（CK1.〜）を貼り付け"></textarea>' +
            '<div class="row"><button data-a="cread"' + dis + '>このコードを読み込む</button><button class="alt" data-a="cno">やめる</button></div>';
    if (svPend)
        h += '<div class="svpend"><b>このデータで再開しますか？</b><div class="meta">' + saveSummary(svPend.data, svPend.at) + '</div><div class="meta svwarn">今のデータは上書きされます。必要なら先に書き出してください。</div>' +
            '<div class="row"><button data-a="fok"' + (ok ? '' : ' disabled') + '>このデータで再開</button><button class="alt" data-a="fno">やめる</button></div></div>';
    if (svMsg)
        h += '<div class="meta ' + (svMsg.ok ? 'svok' : 'svwarn') + '">' + (svMsg.ok ? '✅ ' : '⚠ ') + svMsg.t + '</div>';
    el.innerHTML = h;
    const ni = byId('svci');
    if (ni)
        ni.value = typed;
}
