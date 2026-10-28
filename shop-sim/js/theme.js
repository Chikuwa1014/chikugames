/**
 * theme.js — イメージカラー（v2.0.0〜）。設定タブで6色から選ぶ。端末ごとに保存（セーブデータには入れない）。
 * 画面の色は :root の CSS 変数を上書きして変える（「ミント×コーラル」は style.css のまま）。
 * お店の絵（屋根・腰板・窓わく・看板・日よけ）の色は PXT を pixel.js が読む。
 */

/** イメージカラーの保存キー */
const THEME_KEY = 'shop-sim-theme';

/**
 * イメージカラーの一覧。m＝主な色（所持金・タブ・屋根）、c＝差し色（大きいボタン・看板・日よけ）、h＝背景の色あい（色相）。
 * 暗い画面では dm・dc（明るめ）を使う。
 */
const THEMES = [
    { id: 'mint', name: 'ミント×コーラル', m: '#2fbf97', c: '#ff7a68', dm: '#3ed3a8', dc: '#ff8a78', h: 158, s: 45 },
    { id: 'sakura', name: 'さくら', m: '#e8709a', c: '#ff9a5c', dm: '#f28bb0', dc: '#ffad7a', h: 340, s: 55 },
    { id: 'sora', name: 'そら', m: '#3a9fe0', c: '#ffa53a', dm: '#5cb4ef', dc: '#ffb95e', h: 205, s: 55 },
    { id: 'chikuwa', name: 'ちくわ色', m: '#c9772e', c: '#5aa65a', dm: '#e09a55', dc: '#72bd72', h: 34, s: 55 },
    { id: 'budou', name: 'ぶどう', m: '#8a6ad8', c: '#f0709e', dm: '#a58bea', dc: '#f58ab2', h: 262, s: 45 },
    { id: 'mono', name: 'モノクロ', m: '#5b6470', c: '#2f353d', dm: '#aab3be', dc: '#5f6874', h: 215, s: 8 }
];

/** いまのイメージカラー */
let themeId = 'mint';

/** お店の絵の色（pixel.js が読む）。r＝屋根・腰板・窓わく、c＝看板・日よけ */
const PXT = { r: '#2fbf97', c: '#ff7a68' };

/** HSL を #rrggbb にする */
function hslHex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, '0');
    return '#' + f(0) + f(8) + f(4);
}

/** 2つの色をまぜる（t＝b の割合） */
function mixHex(a, b, t) {
    const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** 暗い画面かどうか */
const themeDark = () => {
    const t = document.documentElement.dataset.theme;
    return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme:dark)').matches);
};

/** イメージカラーを画面に当てる */
function themeApply(id) {
    const T = THEMES.find(t => t.id === id) || THEMES[0], st = document.documentElement.style;
    themeId = T.id;
    PXT.r = T.m;
    PXT.c = T.id === 'mono' ? '#4a525c' : T.c;
    const names = ['--bg', '--bg2', '--card', '--ink', '--sub', '--line', '--mint', '--mint2', '--mintl', '--mintg', '--coral', '--coral2', '--coral3', '--corall', '--tag', '--tagink', '--ok', '--bar', '--cg-accent'];
    names.forEach(n => st.removeProperty(n));
    if (T.id === 'mint')
        return;
    const dk = themeDark(), h = T.h, s = T.s, m = dk ? T.dm : T.m, c = dk ? T.dc : T.c;
    const v = dk ? {
        '--bg': hslHex(h, s * .5, 9), '--bg2': hslHex(h, s * .5, 11), '--card': hslHex(h, s * .45, 15), '--ink': hslHex(h, s * .6, 93),
        '--sub': hslHex(h, s * .35, 64), '--line': hslHex(h, s * .4, 22), '--bar': hslHex(h, s * .5, 8),
        '--mintl': mixHex(m, hslHex(h, s * .5, 9), .72), '--corall': mixHex(c, hslHex(h, s * .5, 9), .72), '--tagink': '#1c1010'
    } : {
        '--bg': hslHex(h, s, 95.5), '--bg2': hslHex(h, s, 91.5), '--card': '#ffffff', '--ink': hslHex(h, Math.min(s, 30), 18),
        '--sub': hslHex(h, s * .35, 48), '--line': hslHex(h, s * .7, 87), '--bar': hslHex(h, s * .7, 91.5),
        '--mintl': mixHex(m, '#ffffff', .82), '--corall': mixHex(c, '#ffffff', .84), '--tagink': '#ffffff'
    };
    Object.assign(v, {
        '--mint': m, '--mint2': mixHex(m, '#000000', .16), '--mintg': mixHex(m, '#ffffff', .4),
        '--coral': c, '--coral2': mixHex(c, '#000000', .1), '--coral3': mixHex(c, '#000000', .3),
        '--tag': c, '--ok': m, '--cg-accent': m
    });
    for (const n in v)
        st.setProperty(n, v[n]);
}

/** 設定タブの「イメージカラー」の欄を描く */
function themeRender() {
    const el = byId('thc');
    if (!el)
        return;
    el.innerHTML = '<b>🎨 イメージカラー</b><div class="meta">画面とお店の絵の色を変えます（この端末だけ。セーブデータは変わりません）。</div><div class="thl">'
        + THEMES.map(t => '<button type="button" class="ths' + (t.id === themeId ? ' on' : '') + '" data-a="theme" data-v="' + t.id + '" aria-pressed="' + (t.id === themeId) + '"><i style="background:linear-gradient(135deg,' + t.m + ' 0 50%,' + t.c + ' 50% 100%)"></i><span>' + t.name + '</span></button>').join('')
        + '</div>';
}

/** イメージカラーを選ぶ */
function themeSet(id) {
    themeApply(id);
    CG.ls.set(THEME_KEY, themeId);
    themeRender();
}

themeApply(CG.ls.get(THEME_KEY) || 'mint');
themeRender();
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => themeApply(themeId));
document.addEventListener('click', e => {
    const b = e.target.closest('[data-a="theme"]');
    if (b)
        themeSet(b.dataset.v);
});
