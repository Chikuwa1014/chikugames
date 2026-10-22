# ステージ工房

パーツを並べて 2D アクションのステージを作り、その場でテストプレイし、リンクで共有できるブラウザゲームメーカーです。

- 現在のバージョン：v1.2.0（更新履歴は `CHANGELOG.md`）
- ビルド不要。`index.html` 1 枚で動きます。

## 公開のしくみ

chikugames リポジトリの `stage-kobo/` フォルダとして、Worker `chikuwa-games` から公開しています（設定はリポジトリ直下の `wrangler.jsonc`）。
GitHub の `main` ブランチに push すると、Cloudflare が自動でデプロイします。公開パスは `/stage-kobo/` です。

## 共有リンク

ステージのデータは URL の `#st.` 以降に入っています（サーバー保存なし）。
リンクを開くとプレイ専用モードで起動し、編集はできません。

## ローカルで確認する

リポジトリ直下で `npx wrangler dev` を実行し、`/stage-kobo/` を開きます。
