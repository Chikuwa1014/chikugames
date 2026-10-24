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
