/**
 * util.js — 小さな共通関数。
 */

/** 要素の取得 */
const byId = id => document.getElementById(id);

/** 金額などを桁区切りで整形 */
const fmt = n => Math.round(n).toLocaleString();

/** 100円単位に丸める（最低100） */
const r100 = x => Math.max(100, Math.round(x / 100) * 100);

/** 日付から季節番号（0〜3）を求める */
const seaOf = d => Math.floor(Math.floor((Math.max(d, 1) - 1) / MD) / 2) % 4;

/** 季節に応じた天気を抽選 */
function roll(d) {
    const w = WW[seaOf(d)];
    let r = Math.random() * 100;
    for (let i = 0; i < 4; i++) {
        if ((r -= w[i]) < 0)
            return i;
    }
    return 1;
}

/** 0〜100に収める */
const clamp100 = v => Math.max(0, Math.min(100, v));

/** ヘルプの？アイコン（k は data.js の HELP のキー） */
const helpIcon = k => '<button type="button" class="hp" data-a="help" data-k="' + k + '" aria-label="説明">?</button>';

/** ヘルプのフロート表示（同じアイコンをもう一度触ると閉じる） */
function showHelp(b) {
    let f = byId('hlp');
    if (!f) {
        f = document.createElement('div');
        f.id = 'hlp';
        f.setAttribute('role', 'tooltip');
        f.hidden = true;
        document.body.append(f);
    }
    const k = b.dataset.k;
    if (!f.hidden && f.dataset.k === k) {
        hideHelp();
        return;
    }
    f.dataset.k = k;
    f.textContent = HELP[k] || '';
    f.hidden = false;
    const r = b.getBoundingClientRect(), W = innerWidth, H = innerHeight, fw = f.offsetWidth, fh = f.offsetHeight;
    f.style.left = Math.max(8, Math.min(W - fw - 8, r.left + r.width / 2 - fw / 2)) + 'px';
    f.style.top = (r.bottom + 6 + fh > H - 8 ? Math.max(8, r.top - fh - 6) : r.bottom + 6) + 'px';
}

/** ヘルプを閉じる */
function hideHelp() {
    const f = byId('hlp');
    if (f)
        f.hidden = true;
}
