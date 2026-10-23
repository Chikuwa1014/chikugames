# ちくわゲームズ

ブラウザですぐ遊べる、ちいさなゲームのあつまりです。Cloudflare Workers（`chikuwa-games`）の静的配信で公開しています。静的ファイルは assets が返し、assets に無いパス（いまはマルチプレイの仲介 `/roulette/ws` だけ）を `worker/index.js` が受けます（Durable Objects `MultiRoom`）。`main` に push すると自動でデプロイされます。

| パス | 内容 |
|---|---|
| `/` | トップページ（ゲーム一覧）`index.html` |
| `/shop-sim/` | ちいさなお店（商品販売シミュレーター） |
| `/stage-kobo/` | つくれ！おでん横丁（ちくわくんの2Dアクションステージメーカー。旧名：ステージ工房） |
| `/roulette/` | まわせ！ちくわルーレット（ひとり：すごろくRPG／みんな：最大8人の決めごとルーレット） |

## 開発のルール

すべてのゲームに共通の約束ごと（置き場所・バージョン・SNS共有・保存・通信対戦・テスト）は、リポジトリ直下の `CLAUDE.md` にまとめています。

## ゲームを一覧に追加する

ゲームのフォルダに `card.js`（カードの中身とサムネイル）を作り、`index.html` の「ゲームの一覧」に `<script src>` を1行足します。バージョンを上げたときは、そのゲームの `card.js` の `version` と `updated` を更新します。

`README.md`・`CLAUDE.md` などは `.assetsignore` で公開対象から外しています。
