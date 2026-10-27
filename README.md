# ちくわゲームズ

ブラウザですぐ遊べる、ちいさなゲームのあつまりです。Cloudflare Workers（`chikuwa-games`）の静的配信で公開しています。静的ファイルは assets が返し、assets に無いパス（いまはマルチプレイの仲介 `/roulette/ws`・`/battle-othello/ws`・`/hayaoshi-chikupon/ws`・`/horimogu/ws` とデバッグログの受け口 `/shop-sim/debug`・`/battle-othello/debug`）を `worker/index.js` が受けます（Durable Objects `MultiRoom`）。`main` に push すると自動でデプロイされます。

| パス | 内容 |
|---|---|
| `/` | トップページ（ゲーム一覧）`index.html` |
| `/shop-sim/` | ちいさなお店（商品販売シミュレーター） |
| `/stage-kobo/` | つくれ！おでん横丁（ちくわくんの2Dアクションステージメーカー。旧名：ステージ工房） |
| `/roulette/` | まわせ！ちくわルーレット（ひとり：すごろくRPG／みんな：最大8人の決めごとルーレット） |
| `/battle-othello/` | バトルオセロ（2台で通信対戦するオセロ） |
| `/hayaoshi-chikupon/` | 早押し！ちくぽん！（ひとり：反応速度／みんな：最大8台の早押し） |
| `/horimogu/` | ほりほりもぐもぐ（お豆腐を掘り進む3Dバトル。ひとり：ボス5体を全滅／みんな：最大8台） |
| `/ugokase-chikuwa/` | うごかせ！ちくわくん（指示ピースを組んでちくわ君ロボに製品を運ばせる、パズル×プログラミング） |

## 開発のルール

すべてのゲームに共通の約束ごと（置き場所・バージョン・SNS共有・保存・通信対戦・テスト）は、号口（`Chikuwa1014/chikugames`）の `CLAUDE.md`にまとめています。

## ゲームを一覧に追加する

ゲームのフォルダに `card.js`（カードの中身とサムネイル）を作り、`index.html` の「ゲームの一覧」に `<script src>` を1行足します。バージョンを上げたときは、そのゲームの `card.js` の `version` と `updated` を更新します。

ベータ版として公開するゲームは `card.js` に `beta: true` を書くと、トップページの「Beta」欄に並びます（版数は `β0.1.0` のように `β` 付き）。号口にするときは `beta: true` を消し、`β` を外して版数を `1.0.0` にします。

`README.md`・`CLAUDE.md` などは `.assetsignore` で公開対象から外しています。
