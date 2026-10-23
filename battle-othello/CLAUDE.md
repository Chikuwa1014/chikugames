# バトルオセロ（battle-othello）

## 1. 概要

2台の端末で通信対戦するオセロ。ルールは「通常オセロ」と「バトルオセロ」（打つ側はゲージで力をこめ、受ける側は連打か擦りで防御。力で勝つと衝撃波がまわりのコマにダメージを与え、80 たまると裏返る）。もとはテスト用リポジトリ `online-game-test` の「対戦オセロ」。

- 現在：**β0.1.0（2026-10-23）・ベータ版**（トップページの「Beta」欄）。正式版にするときはリポジトリ直下 `CLAUDE.md` 3 章「ベータ版として公開するとき」の手順で `1.0.0` にする。

## 2. URL

- 公開 URL：`/battle-othello/`（招待は `/battle-othello/?room=1234`）
- アーティファクト：まだ無し（`dev/artifact.json` の `url` が空）。通信対戦はアーティファクトでは動かないので、確認は手元のテストと本番で行う。
- 仲介の接続先：同じドメインの `/battle-othello/ws`（`?signal=ws://…/battle-othello/ws` で上書き可）。

## 3. コードの地図

ファイルは `index.html` 1 つ（見た目・ロジックすべて）と、トップページ用の `card.js`。

| 場所 | 役割 |
|---|---|
| `VERSION` | 版数（β 付き）。ロビーの「ベータ版・更新履歴」に表示 |
| `DEFAULT_SIGNAL_URL`・`ICE_SERVERS` | 仲介の接続先と STUN |
| `openSignal`・`onSignal` | 仲介との WebSocket。`role`・`peer-joined`・`offer`/`answer`/`ice`・`peer-left`/`host-left`・`full` |
| `makePeer`・`setupChannel`・`sendGame`・`onLost` | WebRTC のデータチャネル |
| `createRoom`・`joinRoom`・`showInvite`・`copyLink` | 部屋づくり・参加・招待（リンク／QR） |
| `MODE_NAME`・`MODE_HELP` | ルールの名前と説明（親が選び、開始時に子へ送る） |
| `flipsFor`・`legalMoves`・`placeMove`・`finishTurn` | オセロ本体 |
| `shockLevel`・`shockRadius`・`applyShock` | バトルの計算（両端末で同じ結果になる） |
| `startBattle`・`gaugeAt`・`guardPower`・`lockPower`・`lockGuard`・`tryResolve`・`playShock` | バトルの画面と進行 |
| `doToss`・`beginMatch`・`onGameMessage`・`onCellClick` | 先後決め（親がコイントス）と対局の進行 |
| `tick`・`updateTimer`・`timeUp` | 持ち時間 |
| `render` | 盤面の描画 |

## 4. 保存キー

なし（localStorage は使っていない）。

## 5. 調整用の数値

`index.html` の「オセロ本体」の先頭：`TURN_LIMIT`（1手の持ち時間）、`GRACE`、`BATTLE_MS`、`GAUGE_PERIOD`、`TAP_POWER`、`RUB_POWER`、`FLIP_DAMAGE`。

## 6. テスト

- `node roulette/dev/server.mjs` で手元の仲介を動かし、`http://localhost:8787/battle-othello/` を2つのブラウザで開く。
- `python3 battle-othello/dev/test-multi.py`：ヘッドレス Chromium 2台で部屋を作って参加し、対局が始まって1手打てるかを確かめる（サーバーは自動で起動）。

## 7. ゲーム固有の決まり

- 1部屋 2 台まで（`worker/index.js` の `WS_GAMES` で `battle-othello: 2`）。共通の仲介 `MultiRoom` を使う。
- 親が抜けると子には `host-left` が届く（`peer-left` と同じ扱い）。

## 8. 残りのタスク

`claude/未実装タスク.md` を参照。
