# ちくわゲームズ

ブラウザですぐ遊べる、ちいさなゲームのあつまりです。Cloudflare Workers（`chikuwa-games`）の静的配信で公開しています。`main` に push すると自動でデプロイされます。

| パス | 内容 |
|---|---|
| `/` | トップページ（ゲーム一覧）`index.html` |
| `/shop-sim/` | ちいさなお店（商品販売シミュレーター） |
| `/stage-kobo/` | つくれ！おでん横丁（ちくわくんの2Dアクションステージメーカー。旧名：ステージ工房） |

## ゲームを一覧に追加する

`index.html` の `GAMES` 配列に1件追加します。サムネイルは同じファイルの描画関数（`DRAW_shop` など）を `DRAW` に登録して、`thumb` に名前を書きます。バージョンを上げたときは `version` と `updated` も更新してください。

`README.md`・`CLAUDE.md` などは `.assetsignore` で公開対象から外しています。
