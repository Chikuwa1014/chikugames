/**
 * debuglog.js — バグ調査用のデバッグログ（記録と送信）。
 *
 * 記録・エラーの捕捉・送信は共通部品 common/v1/debug.js（CG.debug）。ここは「何を記録するか」と送信欄の見た目だけ。
 * 記録するもの（localStorage の DBG_KEY に直近 DBG_MAX 件。再読み込みしても残る）：
 *   - 操作（投資・融資・預金・開店・翌日・閉店・甘酒など）と、その前後のフェーズ・所持金
 *   - 投資ボタンが無視されたときの理由（investBlock）
 *   - イベントの文言（addEvent）
 *   - JavaScript のエラー（CG.debug が自動で記録）
 * 送信：「⚙設定」タブの「🐞 デバッグログを送る」。サーバー（worker/index.js の /shop-sim/debug）が
 *   D1（chikuwa-debug の debug_logs）に保存し、受付番号を返す。送る中身は state 全体＋上の記録。
 * ほかのファイルの関数を「包んで」記録するだけなので、ゲームの動きは変えない。
 * ui.js の後、main.js の前に読み込むこと。
 */

const DBG_KEY = 'shop-sim-debuglog';
const DBG_MAX = 300;

/** 送信欄の状態（null＝未送信、{busy}・{ok, code}・{ok:false, t}） */
let dbgMsg = null;
let dbgSig = '';

/** いまの状態の要約（1件の記録に付ける） */
const dbgSnap = () => typeof state !== 'undefined' && state ? {
    d: state.day, ph: state.phase, m: Math.round(state.money), sk: state.sick || 0, dp: state.dep || 0,
    ov: !!state.over, km: state.kama || 0, cl: state.clean || 0, sl: state.slots
} : {};

CG.debug.init({ key: DBG_KEY, max: DBG_MAX, snap: dbgSnap });

/** 1件記録する（ほかのファイルから呼んでもよい） */
const dbgAdd = (ev, extra) => CG.debug.add(ev, extra);

/** 関数を包んで、前後のフェーズ・所持金の変化を記録する。why：お金が動かなかったら「無視された理由」も残す */
function dbgWrap(name, opt) {
    CG.debug.wrap(name, {
        before: () => ({ ph0: state && state.phase, m0: state && state.money, l0: state && state.log[0] }),
        after: b => {
            const x = { ph0: b.ph0 };
            if (state && state.money !== b.m0)
                x.dm = Math.round(state.money - b.m0);
            else if (opt && opt.why)
                x.ign = investBlock() || 'お金不足か上限';
            if (state && state.log[0] !== b.l0)
                x.lg = state.log[0];
            return x;
        }
    });
}

['buy', 'upgrade', 'takeLoan', 'svMove'].forEach(n => dbgWrap(n, { why: true }));
['fillAll', 'openShop', 'nextDay', 'endDay', 'newGame', 'restart', 'applyLoad', 'amaStart', 'amaFinish', 'amaClose'].forEach(n => dbgWrap(n));
{
    const f = addEvent;
    window.addEvent = function (t) {
        dbgAdd('event', { lg: t });
        return f.apply(this, arguments);
    };
}

/** 送信する */
async function dbgSend() {
    if (dbgMsg && dbgMsg.busy)
        return;
    const nt = byId('dbgn');
    dbgMsg = { busy: true };
    syncDbg();
    const r = await CG.debug.send(nt ? nt.value : '', { why: investBlock(), state });
    dbgMsg = r.ok ? { ok: true, code: r.code } : { ok: false, t: r.t };
    if (r.ok) {
        const n2 = byId('dbgn');
        if (n2)
            n2.value = '';
    }
    syncDbg(true);
}

/** 「設定」タブのデバッグログ欄（内容が変わったときだけ作り直す。入力中のメモは消さない） */
function syncDbg(force) {
    const el = byId('dbg');
    if (!el)
        return;
    const sig = JSON.stringify(dbgMsg);
    if (!force && sig === dbgSig && el.innerHTML)
        return;
    dbgSig = sig;
    const old = byId('dbgn'), note = old ? old.value : '';
    let h = '<b>🐞 デバッグログ</b>' + helpIcon('dbg') +
        '<textarea id="dbgn" rows="2" maxlength="500" placeholder="どんなことが起きた？（任意）例：2ヶ月目に投資ボタンが押せない" style="width:100%;box-sizing:border-box;margin:6px 0;font:inherit;font-size:13px;padding:6px;border-radius:8px;border:1.5px solid var(--line);background:var(--card);color:var(--ink)"></textarea>' +
        '<button data-a="dbgsend"' + (dbgMsg && dbgMsg.busy ? ' disabled' : '') + '>' + (dbgMsg && dbgMsg.busy ? '送信中…' : '🐞 デバッグログを送る') + '</button>' +
        '<div class="meta">直近' + CG.debug.log.length + '件の操作と、いまのゲームの状態を開発者に送ります。</div>';
    if (dbgMsg && dbgMsg.ok)
        h += '<div class="meta svok">✅ 送信しました。受付番号 <b>' + dbgMsg.code + '</b>（開発者に伝えてください）</div>';
    else if (dbgMsg && dbgMsg.t)
        h += '<div class="meta svwarn">⚠ ' + dbgMsg.t + '</div>';
    el.innerHTML = h;
    byId('dbgn').value = note;
}

{
    const r0 = render;
    window.render = function () {
        r0.apply(this, arguments);
        syncDbg();
    };
}
document.addEventListener('click', e => {
    const b = e.target.closest('button[data-a="dbgsend"]');
    if (b && !b.disabled)
        dbgSend();
});
