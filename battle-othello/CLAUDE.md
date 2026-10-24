# バトルオセロ（battle-othello）

> 共通のルールは号口（`Chikuwa1014/chikugames`）の `CLAUDE.md` を参照する。ここにはこのゲーム・フォルダだけのことを書く。

## 1. 概要

2台の端末で通信対戦するオセロ。ルールは「通常オセロ」と「バトルオセロ」（打つ側はゲージで力をこめ、受ける側は連打と「輪を円を描くようになぞる」で防御。力で勝つと衝撃波がまわりのコマにダメージを与え、80 たまると裏返る）。もとはテスト用リポジトリ `online-game-test` の「対戦オセロ」。

- 現在：**1.0.0（2026-10-24）・号口**（トップページの「Games」欄）。

## 2. URL

- 公開 URL：`/battle-othello/`（招待は `/battle-othello/?room=1234`）
- アーティファクト：https://claude.ai/artifact/EfvGS9sCpLKUseWkj7JXtv （ロビーの見た目の確認用）。通信対戦とデバッグログの送信はアーティファクトでは動かないので、確認は手元のテストと本番で行う。
- 仲介の接続先：同じドメインの `/battle-othello/ws`（`?signal=ws://…/battle-othello/ws` で上書き可）。

## 3. コードの地図

ファイルは `index.html` 1 つ（見た目・ロジックすべて）と、トップページ用の `card.js`。

| 場所 | 役割 |
|---|---|
| `VERSION` | 版数。ロビーの「バージョン・更新履歴」に表示 |
| `KEY_NAME`・`KEY_THEME`・`KEY_DBG`・`load`・`save` | 端末に保存するもの（4 章） |
| `dbg`・`dbgLog`・`#dbgSend` の処理 | デバッグログ（操作・通信・バトル・エラーを直近 `DBG_MAX` 件）と、ページ下の「不具合の報告」からの送信（`POST debug` → `worker/index.js` の `/battle-othello/debug` → D1 `chikuwa-debug`） |
| `DEFAULT_NAME`・`myName`・`theirName`・`showNames` | プレイヤー名。接続したら `{t:"name"}` で相手に送る。未入力なら親「ちくわ」・子「こんにゃん」 |
| `setTheme` | 盤面の色（`#board` の `data-theme`：green・brown・shogi・chikuwa。色は CSS の `#board[data-theme=…]`、将棋の星は `#stars`） |
| `DEFAULT_SIGNAL_URL`・`ICE_SERVERS` | 仲介の接続先と STUN |
| `openSignal`・`onSignal` | 仲介との WebSocket。`role`・`peer-joined`・`offer`/`answer`/`ice`・`peer-left`/`host-left`・`full` |
| `makePeer`・`setupChannel`・`sendGame`・`onLost` | WebRTC のデータチャネル |
| `createRoom`・`joinRoom`・`showInvite`・`copyLink` | 部屋づくり・参加・招待（リンク／QR） |
| `MODE_NAME`・`MODE_HELP` | ルールの名前と説明（親が選び、開始時に子へ送る） |
| `flipsFor`・`legalMoves`・`placeMove`・`finishTurn` | オセロ本体 |
| `shockLevel`・`shockRadius`・`applyShock` | バトルの計算（両端末で同じ結果になる） |
| `startBattle`・`gaugeAt`・`ringAngle`・`guardPower`・`showGuard`・`lockPower`・`lockGuard`・`tryResolve`・`playShock` | バトルの画面と進行。防御は連打（`taps`）と、輪（`#ring`）の上で角度を足していき 1 周ごとに `circles`+1。輪から外れる・逆回りでその周はやり直し。両方を組み合わせてよい（ヘルプには書かない） |
| `doToss`・`beginMatch`・`onGameMessage`・`onCellClick` | 先後決め（親がコイントス）と対局の進行 |
| `tick`・`updateTimer`・`timeUp` | 持ち時間 |
| `render` | 盤面の描画 |

## 4. 保存キー

| キー | 中身 |
|---|---|
| `battle-othello-name` | 自分の名前（未入力なら保存しない） |
| `battle-othello-board` | 盤面の色（green・brown・shogi・chikuwa） |
| `battle-othello-debuglog` | デバッグログ（直近 300 件の配列） |

## 5. 調整用の数値

`index.html` の「オセロ本体」の先頭：`TURN_LIMIT`（1手の持ち時間）、`GRACE`、`BATTLE_MS`、`GAUGE_PERIOD`、`TAP_POWER`（連打1回）、`CIRCLE_POWER`・`CIRCLE_MAX`（1周の防御力と上限。4×25＝100）、`RING_IN`・`RING_OUT`（なぞったと認める輪の幅）、`FLIP_DAMAGE`。防御の合計は 100 まで。

## 6. テスト

- `node roulette/dev/server.mjs` で手元の仲介を動かし、`http://localhost:8787/battle-othello/` を2つのブラウザで開く。
- `python3 battle-othello/dev/test-multi.py`：ヘッドレス Chromium 2台で部屋を作って参加し、対局が始まって1手打てるかを確かめる（サーバーは自動で起動）。
- `python3 battle-othello/dev/test-v1.py [出力先]`：名前・盤面の色・防御の輪（円＋連打）・バトル画面の重なり順・デバッグログの送信（`shop-sim/dev/server.mjs` の D1 のまね）を確かめる。

## 7. ゲーム固有の決まり

- 1部屋 2 台まで（`worker/index.js` の `WS_GAMES` で `battle-othello: 2`）。共通の仲介 `MultiRoom` を使う。
- 親が抜けると子には `host-left` が届く（`peer-left` と同じ扱い）。
- 防御で「連打」と「円」を組み合わせられることは、ヘルプ・説明に書かない（ユーザーの指示）。
- 盤面の色は自分の端末だけの見た目（相手には送らない）。

## 8. 残りのタスク

`claude/未実装タスク.md` を参照。
