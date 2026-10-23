// 共有リンク（プレイ専用）で、まだ解放していないパーツも配置どおりに出て動くかを確かめる
// 使い方：node stage-kobo/dev/test-shared.js stage-kobo/index.html
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const a = html.indexOf('<script>') + 8, b = html.lastIndexOf('</script>');
const src = html.slice(a, b), end = src.lastIndexOf('})();');
const hook = `globalThis.__t={get game(){return game},get doc(){return doc},get PG(){return PG},get readOnly(){return readOnly},get mode(){return mode},startGame,update,keys,isUnlocked,sealed,fromData,jump(){jumpBuf=6}};\n`;
const code = src.slice(0, end) + hook + src.slice(end);

// ブラウザの代わり（test-gameplay.js と同じ最小限のもの）
const mk = (name) => { const f = function () { return mk(name + '()'); }; return new Proxy(f, { get(t, k) { if (k === Symbol.toPrimitive) return () => 0; if (k === 'then') return undefined; if (k in t && k !== 'name') return t[k]; if (k === 'getContext') return () => ctx; if (k === 'querySelectorAll') return () => []; if (k === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: 960, height: 360 }); if (k === 'classList') return { add() {}, remove() {}, toggle() {} }; if (k === 'dataset') return t.__ds || (t.__ds = {}); if (k === 'style') return t.__st || (t.__st = {}); if (k === 'hidden' || k === 'readOnly' || k === 'textContent' || k === 'value') return t['__' + k]; return mk(name + '.' + String(k)); }, set(t, k, v) { t['__' + k] = v; if (k === 'dataset') t.__ds = v; return true; } }); };
const ctx = new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (['createLinearGradient', 'createRadialGradient'].includes(k)) return () => ({ addColorStop() {} }); return () => {}; }, set(t, k, v) { t[k] = v; return true; } });
function boot(hash, store) {
  const els = {};
  global.document = { getElementById: id => els[id] || (els[id] = mk('#' + id)), createElement: () => mk('el'), createTextNode: () => mk('txt'), body: mk('body'), activeElement: null };
  global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  global.location = { hash, origin: 'https://x', pathname: '/' };
  global.addEventListener = () => {}; global.scrollTo = () => {}; global.requestAnimationFrame = () => {};
  global.performance = { now: () => 0 }; global.setTimeout = () => 0; global.clearTimeout = () => {}; global.navigator = {};
  new Function(code)();
  return globalThis.__t;
}
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

// 作者側：新パーツをすべて使ったステージの共有リンクを作る
const rows = Array(15).fill('');
rows[4]  = '..........................R.......';
rows[6]  = '......K.......F...................';
rows[8]  = '..E...BBB.........Y...............';
rows[10] = '..........MMM..............W......';
rows[11] = '..o..........................T.D..G';
rows[12] = '.P..W....e............o........D...';
rows[13] = '##########.......###LLL############';
rows[14] = '##########.......###LLL############';
const author = boot('', {});
const doc = author.fromData({ title: '新パーツぜんぶ', bg: 'ice', map: rows });
const hash = '#st.' + author.sealed(doc);

// 遊ぶ側：ちくわ0本・スタンプなし（何も解放していない）ブラウザでリンクを開く
const t = boot(hash, {});
const NEW = 'MFEKDWLTRY';
ok(t.readOnly && t.mode === 'play', '共有リンクはプレイ専用で開き、すぐテストプレイになる');
ok([...NEW].every(ch => !t.isUnlocked(ch)), '遊ぶ人は新パーツを1つも解放していない');
ok(NEW.split('').every(ch => t.doc.map.join('').includes(ch)), 'ステージのデータに新パーツ10種類がすべて残っている');
const g = t.game;
ok(g.trays.length === 1 && g.trays[0].w === 72, 'お盆が動く床として出る');
ok(g.enemies.some(e => e.kind === 'fly') && g.enemies.some(e => e.kind === 'spike'), 'ぱたぱた油揚げとトゲの敵が敵として出る');
ok(g.shooters.length === 1 && g.warps.length === 2 && g.hasKey, '串発射台・竹筒2つ・カギが配置どおり');
ok(g.map[12][31] === 'D' && g.map[11][31] === 'D' && g.map[8][2] === 'E' && g.map[8][18] === 'Y' && g.map[13][20] === 'L', 'ゆでたまご・からし・扉・溶岩が配置どおり');
const tx0 = g.trays[0].x; for (let i = 0; i < 60; i++) t.update();
ok(g.trays[0].x !== tx0, 'お盆が動いている');
// 竹筒：スタートのすぐ右の竹筒に入ると、もう一方へワープ
t.keys.right = true; for (let i = 0; i < 40 && g.p.x < 26 * 24; i++) t.update(); t.keys.right = false;
ok(g.p.x > 20 * 24, '竹筒でワープできる (x=' + g.p.x.toFixed(1) + ')');
ok(g.state === 'run' || g.state === 'dead', 'プレイが止まらずに続く');
console.log(fails ? `\n${fails} 件失敗` : '\nすべて成功');
