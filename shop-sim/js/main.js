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
