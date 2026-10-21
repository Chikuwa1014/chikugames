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
