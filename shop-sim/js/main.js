/**
 * main.js — 起動処理（読み込みの最後に実行）。
 */

PRODUCTS.forEach(p => {
    p.b = p.c;
    p.n0 = p.n;
});
applyUp();
if (!LA.includes(state.ln.a))
    state.ln.a = LA[0];
applyDiff();
initLayout();
// セーブの引っ越し（新しいアドレス・別の端末へ。共通部品 common/v1/move.js）。お店のセーブと実績を運ぶ
CG.move.mount(byId('cgMove'), { keys: [KEY, ACH_KEY] });
CG.move.mount(byId('cgMoveD'), { keys: [KEY, ACH_KEY] });   // 難易度えらびの画面にも（新しいアドレスで最初に開いたとき用）
byId('ver').innerHTML = 'ちいさなお店 v' + VERSION + '<br>' + COPYRIGHT;
{
    // 更新履歴（最新だけ表示し、過去の分は開いて見る）
    const li = c => '<li><b>v' + c[0] + '</b>（' + c[1] + '）' + c[2] + '</li>';
    byId('chg').innerHTML = '<b>📝 更新履歴</b><ul>' + li(CHANGES[0]) + '</ul>' +
        (CHANGES.length > 1 ? '<details><summary>過去の更新履歴</summary><ul>' + CHANGES.slice(1).map(li).join('') + '</ul></details>' : '');
}
setInterval(() => {
    fr++;
    drawPx();
}, 180);
drawPx();
fill();
render();
(function loop() {
    tick();
    setTimeout(loop, 1000 / (state.spd || 1));
})();

/* ---------- 画面の拡大を止める（v2.2.0〜。号口 CLAUDE.md 19 章）----------
   iPhone の Safari は user-scalable=no を無視するので、2 本指のピンチ（gesture*・2 本以上の touchmove）とダブルタップを止める */
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
// スライダーなどを 1 本指で動かし始めたあとは touchmove を止められないので、ポップアップ（.ovbox）の中では 2 本目の指が触れた時点で止める
document.addEventListener('touchstart', e => { if (e.touches.length > 1 && e.target.closest && e.target.closest('.ovbox')) e.preventDefault(); }, { passive: false });
