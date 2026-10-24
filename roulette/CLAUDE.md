# まわせ！ちくわルーレット 引き継ぎメモ

全ゲーム共通のルールは正式版（`Chikuwa1014/chikugames`）の `CLAUDE.md`。ここにはこのゲームだけのことを書く。

## 1. 概要

ひとりで遊ぶ「ルーレットすごろくRPG（ひとりで冒険）」と、最大8人で遊ぶ「みんなで決めるルーレット」の 2 モード。
現在 **v1.0.0**（2026-10-23）。ファイルは `index.html` 1 枚（CSS・JS 込み）。

## 2. URL

- 公開：`/roulette/`
- アーティファクト（push 前の確認用）：https://claude.ai/artifact/UZmr5E7B6ndj3JRwL2Yvki
- アーティファクト版は `python3 dev/make-artifact.py roulette` で作る。サイト版との違い（`dev/artifact.json`）：
  - 招待リンク（`inviteUrl`）とクリア時の共有 URL を本番の `/roulette/` にする（公開 URL `dev/site.json` が未設定のあいだはとばされる）
  - **アーティファクトでは WebRTC が使えないので、確認できるのは「ひとりで冒険」だけ。** 「みんなで決める」は手元のテスト（6 章）と、push 後の本番で確認する
- トップページのカードは `card.js`。

## 3. コードの地図（`index.html` の `<script>` 内）

| 部分 | 中身 |
|---|---|
| `TUNING` | 調整用の数値をすべてまとめた所（5 章） |
| `Wheel` | ルーレットの描画（`draw`）と動き（`step`：摩擦の式）。`index()` で針の下の項目、`angleFor(i)` で項目 i を針に合わせる角度。ひとり・マルチ共通 |
| `drawChikuwa` / `MONSTERS` / `drawMonster` | ちくわくんと敵の絵。敵は `shape`（cat・daikon・stick・ball・bag・ghost・egg・skewer・block・knot・pot）と色で描く。ボスは冠とおこり顔 |
| `STAGES` | 5 ステージの名前・出てくる敵・ボス・色 |
| `makeBoard` / `SQ_LABEL` | すごろくの盤（ステージごとに決まった並び）。`S` スタート、`E` 敵（通過できない）、`H` だしの湯、`C` ちくわ、`T` 罠、`Q` ？、`B` ボス |
| `attackItems` / `defenseItems` / `MOVE_ITEMS` | ひとりで冒険のルーレットの中身。強化（`G.sv.up`）で中身が変わる |
| `doMove` / `landEffect` / `startBattle` / `doAttack` / `doDefense` / `winBattle` | ひとりで冒険の進行 |
| `openShop` / `UPGRADES` | ステージクリア後の強化ショップ |
| `NET` / `openSignal` / `onSignal` | マルチの接続（仲介の WebSocket と WebRTC） |
| `hostOnMessage` / `hostAttack` / `hostSpinTick` | 親の進行（NG の受付、はじくの判定、回転を配る） |
| `guestOnMessage` | 子の受け取り |
| `renderRoom` | マルチの画面 |
| `frame` | メインループ（描画と回転） |

### マルチプレイの仕組み（対戦オセロ online-game-test と同じ方式）

- 仲介（`worker/index.js` の `MultiRoom`、パス `/roulette/ws`、部屋名 `roulette:<4桁>`）で WebRTC の offer / answer / ICE を交換し、あとはデータチャネルで直接やりとり。STUN は Google。
- 最初に入った端末が親（ID `"0"`）、子はランダム ID。メッセージの `to` で宛先指定、`from` はサーバーが付ける。親が子それぞれと 1 対 1 でつながる星型。
- 子はつながったら仲介を閉じる。親は新しい人のために開けたまま（切れたら 2 秒後につなぎ直す）。
- 満員：仲介は同時 8 接続まで。子は接続後に仲介を抜けるので、人数は親が数えて 9 人目に `reject` を返す。
- ルーレットの回転は親だけが計算し、50ms ごとに `{t:"s", a:角度, w:速さ}` を配る。子は同じ摩擦の式で間を補う。止まったら結果を配る。
- 「はじく」：子は `{t:"atk"}` を送るだけ。親が「いま、または直近 `hitWindow` ミリ秒以内に針がその人の NG 項目にあったか」で判定し、当たりなら速さに `kick` を足す。
- データチャネルのメッセージ：子→親 `hello{name}`・`ng{i}`（-1 はえらばない）・`atk`。親→子 `items{items}`・`state{phase,result,players}`・`s{a,w}`・`fx{id,ok}`・`full`。
- `phase` は `edit`（親が項目編集）→ `pick`（NG えらび）→ `spin` → `result`。

## 4. 保存キー

| キー | 中身 |
|---|---|
| `chikuwa-roulette-v1` | ひとりで冒険の進み具合（ステージ・LV・EXP・ちくわ・強化・クリア済みか）。ステージの途中位置は保存しない（ステージの最初から） |
| `chikuwa-roulette-name` | マルチで使う名前 |

形を変えるときは `newSave()` に初期値を足す（`loadSave` が古いデータを `Object.assign(newSave(), …)` で埋める）。

## 5. 調整用の数値

すべて `TUNING`（`<script>` の先頭近く）。

- ルーレットの手ざわり：`friction`（自然に止まる）、`brake`（とめるボタン）、`spinSpeed`（まわし始めの速さ）
- ひとりで冒険：盤の長さとマスの数（`boardLen`・`squares`）、HP・レベル（`maxHp`・`levelUpHeal`・`expNeed`）、ダメージ（`attackValues`・`critBase`・`counterBase`）、敵（`enemy.hp`・`atk`・`exp`・`coin`）、マスの効果（`healRate`・`coinSquare`・`trapDamage`・`event`）、ゲームオーバーで残るちくわ（`gameOverKeep`）、ショップ（`upgrades`）
- みんなで決める：人数（`maxPlayers`）、項目の数と長さ（`maxItems`・`itemMaxLen`）、はじく（`guards`・`kick`・`hitWindow`）
- ルール説明の文章（タイトル画面の「あそびかた」）に回数などを書いているので、変えたらそちらもそろえる

## 6. テスト（`dev/`）

```
node roulette/dev/server.mjs 8787                  # 本物の worker/index.js の MultiRoom を Node で動かす確認用サーバー
python3 roulette/dev/test-multi.py 2 <出力フォルダ>  # 親＋子2人：参加・NG・回転・結果一致・退出
python3 roulette/dev/test-solo.py <出力フォルダ> [手数]  # ひとりで冒険を自動で遊ぶ（全クリアまでは数分かかる）
```

## 7. ゲーム固有の決まり

- SNS 共有のハッシュタグは `#まわせちくわルーレット #ちくわげーむず`。招待の文面にも `#ちくわげーむず`。
- 敵・名前はおでん横丁のオリジナル。

## 8. 残りのタスク

`claude/未実装タスク.md` を参照。いちばん優先は「マルチプレイを本番で確認」（公開 URL 待ち）。
