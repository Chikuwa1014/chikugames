/**
 * share.js — 倒産時のポップアップとSNS共有（リザルト画像・Xへの投稿・文面のコピー）。
 * 共有の文面・共有メニュー・X の投稿画面・コピーは共通部品 common/v1/share.js（CG.share）。
 */

/** 共有する文面とハッシュタグ */
const SHARE_MSG = 'ちいさなお店を開いたけど倒産しちゃった！残念😢';
const SHARE_TAG = 'ちくわげーむず';

/** ゲームのURL（今開いているページ。#以降は除く） */
const shareUrl = () => location.href.split('#')[0];

/** CG.share に渡す中身（#ちくわげーむず は CG.share が付ける） */
const shareData = () => ({ msg: SHARE_MSG, url: shareUrl() });

/** コピー用・共有メニュー用の文面（URL込み） */
const shareText = () => CG.share.text(shareData());

/** 作成済みのリザルト画像（ゲームが変わったら作り直す） */
let shareFile = null, shareFor = null;

/** 画像用：幅に収まるように折り返す（最大 max 行） */
function wrapText(g, t, w, max) {
    const L = [];
    let s = '';
    for (const ch of t) {
        if (g.measureText(s + ch).width > w) {
            L.push(s);
            s = ch;
        }
        else
            s += ch;
    }
    if (s)
        L.push(s);
    if (L.length > max) {
        L.length = max;
        L[max - 1] = L[max - 1].slice(0, -1) + '…';
    }
    return L;
}

/** リザルト画像（1200×630）を作る */
function resultImage() {
    const W = 1200, H = 630, c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d'), F = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
    // 背景と屋根
    g.fillStyle = '#0e1c19';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 44) {
        g.fillStyle = '#e63946';
        g.fillRect(x, 0, 22, 32);
        g.fillStyle = '#ffffff';
        g.fillRect(x + 22, 0, 22, 32);
    }
    // タイトル
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#8fb0a5';
    g.font = '700 34px ' + F;
    g.fillText('🏪 ちいさなお店', 48, 92);
    g.fillStyle = '#ff6b76';
    g.font = '900 60px ' + F;
    g.fillText('倒産しました…', 48, 164);
    // ドット絵（384×184 を1.5倍、ドットのまま拡大）
    g.fillStyle = '#27473e';
    g.fillRect(42, 194, 588, 288);
    g.imageSmoothingEnabled = false;
    g.drawImage(byId('px'), 48, 200, 576, 276);
    // 成績
    const d = Math.max(state.day, 1), m = Math.floor((d - 1) / MD) + 1;
    const yen = v => (v < 0 ? '-' : '') + '¥' + fmt(Math.abs(Math.round(v)));
    const rows = [
        ['難易度', difficulty().n],
        ['営業日数', m + 'ヶ月目・通算' + state.day + '日'],
        ['累計売上', yen(state.tot || 0)],
        ['最終所持金', yen(state.money)],
        ['預金', yen(state.sv || 0)],
        ['棚の数', state.slots + '台']
    ];
    rows.forEach(([k, v], i) => {
        const y = 230 + i * 46;
        g.fillStyle = '#8fb0a5';
        g.font = '700 24px ' + F;
        g.textAlign = 'left';
        g.fillText(k, 668, y);
        g.fillStyle = k === '最終所持金' && state.money < 0 ? '#ff6b76' : '#e4f3ec';
        g.font = '800 30px ' + F;
        g.textAlign = 'right';
        g.fillText(v, 1152, y);
        g.fillStyle = '#27473e';
        g.fillRect(668, y + 14, 484, 2);
    });
    // 倒産理由
    g.textAlign = 'left';
    g.fillStyle = '#e4f3ec';
    g.font = '700 26px ' + F;
    wrapText(g, state.overMsg || '資金が倒産ラインを下回り、倒産しました。', W - 96, 2).forEach((t, i) => g.fillText(t, 48, 530 + i * 36));
    // ハッシュタグ
    g.fillStyle = '#ffd23f';
    g.font = '800 24px ' + F;
    g.textAlign = 'right';
    g.fillText('#' + SHARE_TAG, W - 48, 606);
    return c;
}

/** 倒産時にリザルト画像を先に作っておく（共有ボタンを押した瞬間に渡せるように） */
function prepShare() {
    if (!state.over || shareFor === state)
        return;
    shareFor = state;
    shareFile = null;
    setTimeout(() => {
        const s = state;
        resultImage().toBlob(b => {
            if (b && s === state)
                shareFile = new File([b], 'chiisana-omise.png', { type: 'image/png' });
        }, 'image/png');
    }, 0);
}

/** 共有欄（ポップアップの中に出す） */
function shareBox() {
    const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return '<div class="share"><b>📣 結果をシェア</b>' +
        '<div class="row"><button data-a="share">📤 結果をシェア</button><button class="alt" data-a="shimg">🖼 画像を保存</button></div>' +
        '<textarea id="shtx" readonly rows="4">' + esc(shareText()) + '</textarea>' +
        '<button class="alt" data-a="shcopy" style="width:100%">📋 文面をコピー</button></div>';
}

/** 表示中のポップアップがどのゲームのものか（作り直しの判定） */
let ovFor = null;

/** 倒産ポップアップの表示・非表示を状態に合わせる（render のたびに呼ぶ。中身は1回だけ作る） */
function syncOver() {
    let o = byId('ovm');
    const show = state.over && !state.ovx;
    if (!show) {
        if (o)
            o.hidden = true;
        return;
    }
    if (!o) {
        o = document.createElement('div');
        o.id = 'ovm';
        o.setAttribute('role', 'dialog');
        o.setAttribute('aria-modal', 'true');
        document.body.append(o);
    }
    if (ovFor !== state || o.hidden) {
        ovFor = state;
        prepShare();
        let img = '';
        try {
            img = '<img class="ovimg" alt="リザルト画像" src="' + resultImage().toDataURL('image/png') + '">';
        }
        catch (e) { }
        o.innerHTML = '<div class="ovbox"><div class="ovhd">💸 倒産しました…</div>' +
            '<div class="ovmsg">' + (state.overMsg || '資金が倒産ラインを下回り、倒産しました。') + '</div>' + img + shareBox() +
            '<button class="big" data-a="restart">🔄 最初からやり直す</button>' +
            '<button class="alt" data-a="ovclose" style="width:100%">閉じる（お店の様子を見る）</button></div>';
        o.hidden = false;
        o.scrollTop = 0;
    }
}

/** 共有：使えれば端末の共有メニュー（画像付き）、だめならXの投稿画面（画像は手で添付） */
function shareResult() {
    if (shareFile)
        CG.share.open(shareData(), shareFile);
    else
        CG.share.x(shareData());
}

/** リザルト画像を保存（ダウンロード） */
function saveResultImage() {
    resultImage().toBlob(b => {
        if (b)
            CG.download('chiisana-omise.png', b);
    }, 'image/png');
}

/** 文面をコピー */
function copyShareText(b) {
    CG.share.copy(shareData()).then(ok => {
        b.textContent = ok ? '✅ コピーしました' : '⚠ 文面を長押ししてコピーしてください';
        setTimeout(() => b.textContent = '📋 文面をコピー', 2000);
    });
}
