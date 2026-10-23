# まわせ！ちくわルーレット 引き継ぎメモ

ひとりで遊ぶ「ルーレットすごろくRPG」と、最大8人で遊ぶ「みんなで決めるルーレット」の 2 モード。
現在 **v1.0.0**（2026-10-23）。ファイルは `index.html` 1 枚（CSS・JS 込み）。

## 公開と置き場所

- chikugames リポジトリの `roulette/`。URL は `/roulette/`。`main` に push で自動デプロイ。
- マルチプレイの仲介はリポジトリ直下の `worker/index.js`（Durable Objects `MultiRoom`、パス `/roulette/ws`）。
  `wrangler.jsonc` の `main` / `durable_objects` / `migrations` で組み込んでいる。静的ファイルは assets が先に返すので、他のゲームには影響しない。
- `.assetsignore` で `worker/`・`dev/`・`CLAUDE.md`・`README.md` は公開しない。

## 作業の約束

- バージョンを上げるたびに：`const VERSION`、画面の「更新履歴」`<li>`、`README.md`、トップページ `GAMES` の `version` / `updated` をそろえる。
- SNS 共有・招待の文面には必ず `#ちくわげーむず`（クリア時は `#まわせちくわルーレット #ちくわげーむず`、Facebook は hashtag パラメータ）。
- 敵・名前はおでん横丁のオリジナル（既存の有名作品に似せない）。
- コミットは `Chikuwa1014` 名義、push 前に `git fetch && git rebase origin/main`。

## マルチプレイの仕組み（対戦オセロ online-game-test と同じ方式）

- 仲介（WebSocket）で WebRTC の offer / answer / ICE を交換し、あとはデータチャネルで直接やりとり。STUN は Google。
- オセロとの違い：1 部屋最大 8 台。最初に入った端末が親（ID `"0"`）、子はランダム ID。メッセージの `to` で宛先指定、`from` はサーバーが付ける。
  親が子それぞれと 1 対 1 でつながる星型。子はつながったら仲介を閉じ、親は新しい人のために開けたまま（切れたら 2 秒後につなぎ直す）。
- 満員：仲介は同時 8 接続まで。子は接続後に仲介を抜けるので、人数は親が数えて 9 人目に `reject` を返す。
- 部屋コード 4 桁。オセロとは別の Durable Object（名前に `roulette:` を付けている）。
- ルーレットの回転は親だけが計算し、50ms ごとに `{t:"s", a:角度, w:速さ}` を配る。子は同じ摩擦の式で間を補う。止まったら結果を配る。
- 「はじく」：子は `{t:"atk"}` を送るだけ。親が「いま、または直近 220ms 以内に針がその人の NG 項目にあったか」で判定し、当たりなら速さに `KICK` を足す。1 回のルーレットで `GUARDS`=3 回まで。

| 主な定数 | 値 |
|---|---|
| `MAX_PLAYERS` | 8 |
| `MAX_ITEMS` / `ITEM_MAXLEN` | 256 個 / 1 項目 16 文字 |
| `FRICTION` | dω/dt = −(0.6 + 0.35ω)（約 7 秒・5 周ほど） |
| `KICK` / `HIT_WINDOW` | 3.4 rad/s / 220ms |

データチャネルのメッセージ：子→親 `hello{name}`・`ng{i}`（-1 はえらばない）・`atk`。親→子 `items{items}`・`state{phase,result,players}`・`s{a,w}`・`fx{id,ok}`・`full`。
`phase` は `edit`（親が項目編集）→ `pick`（NG えらび）→ `spin` → `result`。

## ひとりで冒険

- `STAGES`（5 ステージ・敵とボス）、`MONSTERS`（敵の名前と形。絵は `drawMonster` の `switch`）。
- 盤は 24 マス（`makeBoard`、ステージごとに決まった並び）：`S` スタート、`E` 敵（通過できない）、`H` だしの湯、`C` ちくわ、`T` つまようじの罠、`Q` ？マス、`B` ボス。
- いどう（1〜6）→ 敵マスでバトル。こうげきルーレット（`attackItems`）→ ぼうぎょルーレット（`defenseItems`）を交互に。「まわす」→「とめる」で強いブレーキ（`BRAKE`）。
- ボスを倒すとショップ（`UPGRADES`）。HP 0 でちくわ半分を失ってステージの最初から。
- 保存：`localStorage['chikuwa-roulette-v1']`（ステージ・LV・EXP・ちくわ・強化）。ステージの途中位置は保存しない。名前は `chikuwa-roulette-name`。

## テスト（`dev/`）

```
node roulette/dev/server.mjs 8787                  # 本物の worker/index.js の MultiRoom を Node で動かす確認用サーバー
python3 roulette/dev/test-multi.py 2 <出力フォルダ>  # 親＋子2人：参加・NG・回転・結果一致・退出
python3 roulette/dev/test-solo.py <出力フォルダ>     # ひとりで冒険を自動で最後まで遊ぶ
```
WebRTC をヘッドレス Chromium どうしでつなぐため `--disable-features=WebRtcHideLocalIpsWithMdns` を付けている。

## 残りのタスク・アイデア

- 難易度の調整（自動プレイでは強化を全部買うとゲームオーバーなしでクリアできる）
- ステージ途中の保存、効果音
