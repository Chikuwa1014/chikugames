/**
 * adgame.js — 広告のごほうび（v2.3.0〜）。広告そのものは共通部品 common/v1/ad.js（CG.ad）。
 *
 * いまは広告を出していない（CG.ad.on が false）ので、どのボタンも画面に出ない。開発で試すときは URL に ?ad=test を付ける。
 * ・倒産からの復活：倒産ポップアップの「📺 広告を見て復活」。「大企業に買い取られた！」で、所持金のマイナスを0に戻し、
 *   ノルマの50%を支給して続ける（回数の上限なし。実績もそのまま数える。2026-10-24 決定）
 * ・返済不要の融資：お金タブ。広告の長さ（種類）でもらえる額が変わる。1日（ゲームの1日）1回まで
 * ・新しいスタイルの解放：styles.js の styAdUnlock（端末の日付で1日1回まで）
 * 金額の倍率は CG.ad.kinds() の m（本物の広告は長さを選べないので1種類）
 */

/** 返済不要の融資の額（基本＝ノルマの20%、最低¥30,000。広告の種類の倍率をかける） */
const adLoanAmt = m => r100(Math.max(30000, quota() * 0.2) * m);

/** 倒産から復活する（広告を最後まで見たら） */
function adRevive() {
    if (!state.over || !CG.ad.ready())
        return;
    CG.ad.reward({ name: 'revive' }).then(ok => {
        if (!ok || !state.over)
            return ok || CG.toast('広告を最後まで見ると復活できます', 2200);
        const g = r100(quota() * 0.5);
        state.money = Math.max(0, state.money) + g;
        state.over = false;
        state.overMsg = '';
        state.ovx = false;
        state.low = state.low5 = 0;
        state.happy = Math.max(state.happy, 30);
        state.revive = (state.revive || 0) + 1;
        addEvent('🏢 大企業に買い取られた！借金を肩代わりしてもらい、運転資金' + yen(g) + 'で営業を続けます');
        render();
        save();
    });
}

/** 返済不要の融資（広告を最後まで見たら。ゲームの1日1回まで） */
function adLoan(kind) {
    if (state.phase !== 'closed' || state.over || state.adLoan === state.day || !CG.ad.ready())
        return;
    const K = CG.ad.kinds().find(k => k.k === kind) || CG.ad.kinds()[0];
    CG.ad.reward({ kind: K.k, name: 'free-loan' }).then(ok => {
        if (!ok)
            return CG.toast('広告を最後まで見ると受け取れます', 2200);
        const a = adLoanAmt(K.m);
        state.money += a;
        state.adLoan = state.day;
        addEvent('📺 スポンサーから返済不要の融資 +' + yen(a));
        render();
        save();
    });
}

/** お金タブの「返済不要の融資」カード（広告が出ていないときは空） */
function adLoanCard() {
    if (!CG.ad.ready())
        return '';
    const used = state.adLoan === state.day;
    return '<div class="card"><b>📺 返済不要の融資</b><div class="meta">広告を最後まで見ると、返済しなくてよいお金がもらえます。長い広告ほど多くもらえます（1日1回まで' + (used ? '・今日はもう受け取りました' : '') + '）。</div><div class="row adl">'
        + CG.ad.kinds().map(k => '<button data-a="adloan" data-v="' + k.k + '"' + (used ? ' disabled' : '') + '>' + k.n + '<br><small>+' + yen(adLoanAmt(k.m)) + '</small></button>').join('') + '</div></div>';
}

/** 倒産ポップアップの「広告を見て復活」ボタン（広告が出ていないときは空） */
const adReviveBtn = () => CG.ad.ready() ? '<button class="big adrev" data-a="adrev">📺 広告を見て復活<br>（大企業に買い取られる）<small>所持金のマイナスを0に戻し、ノルマの50%（' + yen(r100(quota() * 0.5)) + '）がもらえます</small></button>' : '';

document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled)
        return;
    if (b.dataset.a === 'adrev')
        adRevive();
    if (b.dataset.a === 'adloan')
        adLoan(b.dataset.v);
});
