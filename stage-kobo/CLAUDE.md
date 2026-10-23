# つくれ！おでん横丁（旧名：ステージ工房）引き継ぎメモ

ちくわくんが走る「おでん横丁」の 2D アクションステージを作り、テストプレイし、リンクで共有するブラウザゲームメーカー。
現在 **v1.5.1**（2026-10-23）。更新履歴は `CHANGELOG.md` と、`index.html` 末尾の「更新履歴」欄。

## 公開と置き場所

- サイト：chikugames リポジトリの `stage-kobo/`。Cloudflare Worker `chikuwa-games` が `main` への push で自動デプロイ（1 分ほど）。URL は `/stage-kobo/`。
- トップページ（ゲーム一覧）：リポジトリ直下の `index.html`。`GAMES` 配列のカード（名前・説明・`version`・`updated`）と、サムネイル描画関数 `DRAW_stage` を、ゲームを更新するたびに合わせる。
- claude.ai のプレビュー版（Artifact）：https://claude.ai/artifact/DLL2tcjb9FhfsTtGPgP8Uh 。中身はサイト版とほぼ同じ 1 ファイル。違いは次の 3 点だけ。
  - サイト版は `<!doctype>`〜`<head>` とメタ情報・favicon・リセット CSS を自前で持つ（Artifact は自動で包まれる）
  - `BASE_URL`：サイト版は `location.origin + location.pathname`、プレビュー版は Artifact の URL
  - 共有ポップアップの注記文
  変更するときは両方に同じ修正を入れる（同じ Python の置換パッチを両ファイルに当てるのが確実）。
- パーツの解放状態は「パーツ棚に置けるかどうか」だけに使う。共有リンク・ステージコードで開いたステージは、遊ぶ人が未解放のパーツでも配置どおりに出て動く（プレイの処理で解放状態を見ないこと）。
- `.assetsignore` で `CLAUDE.md`・`README.md`・`CHANGELOG.md`・`dev/` は公開しない。
- 名前を変えても、共有リンクが切れないよう URL `/stage-kobo/` と保存キーは変えない。

## 作業の約束

- バージョンを上げるたびに：`const VERSION`、画面の更新履歴 `<li>`（最新の 1 件だけ上の `<ul>` に置き、1 つ前の版は「過去の更新履歴」の `<details>` の先頭に移す）、`CHANGELOG.md`、`README.md` の版数、トップページの `version` / `updated` をそろえる。
- SNS 共有の文面には必ず `#ちくわげーむず` を入れる（今は `#つくれおでん横丁 #ちくわげーむず`、Facebook は hashtag パラメータ）。
- 既存の有名ゲームに似せない（見た目・アイテム名はおでん横丁のオリジナルで）。
- コミットは `Chikuwa1014` 名義、push 前に `git fetch && git rebase origin/main`。

## コードの地図（`index.html` の `<script>` 内）

| 部分 | 中身 |
|---|---|
| 定数 | `T=24`（1 マス px）、`W=40`×`H=15` マス、`VW=20`（プレイ時の表示幅） |
| `THEMES` | 背景 5 種：day「ある日の昼下がり」、dusk「たそがれどき」、night「流星のぐんじょう」、magma「マンマンボルケーノ」、ice「カチンコチンコ」。地面の色など |
| `ALL_PARTS` / `KEY_PARTS` / `GENRES` | パーツ一覧、数字キー、パーツ棚のジャンル（プルダウンで切り替え。新パーツはどれかのジャンルの `parts` に足す） |
| `UNLOCKS` / `STAMPS` / `ALIAS` | ちくわで解放するパーツと、スタンプのミッション（`ch` が獲得で解放されるパーツ）。扉 `D` はカギ `K` といっしょに解放（`ALIAS`） |
| `normalize` / `fromData` | ステージの検証。使える記号は `.#Boe^SGPC=X?IMFEKDWLTRY`。新パーツを足すときはこの正規表現にも記号を追加 |
| `encodeShare` / `decodeShare` / `checksum` / `parseCode` | 共有リンク `#st.<base64>.<チェック値>` とステージコード `SK1.<同じ>`。改ざんすると読み込まない |
| 進行データ `PG` | ちくわ・解放済み・スタンプ。`localStorage['stage-kobo-progress']` に base64＋チェック値で保存 |
| `grantClear` | クリア報酬。各ステージ（中身から作る ID）につき 1 回。共有・サンプル 10（全しずく・ノーミス各＋5）、自作 3（1 日 5 回まで） |
| `drawPlayer` / `drawEnemy` / `drawFly` / `drawSpiky` / `drawSkewer` / `drawDrop` / `drawTile` | 描画。パーツ記号ごとの見た目は `drawTile` の `switch` |
| `STREET` / `yokocho` / `SKY` | 背景。空（`SKY.<テーマ>`）の上に横丁の町並み `yokocho()` を重ねる。町並みの下に基礎（濃い灰色→下ほど暗いグラデーション） |
| `solidAt` / `blocks` / `bonk` / `move` / `update` | 当たり判定と物理。湯気の足場は上からだけ乗れる。下からたたくとおせんべいが割れ、おみくじ箱からしずくが出る。`startGame` でお盆・飛ぶ敵・トゲの敵・串発射台・竹筒を `game` の中の一覧に移す |

パーツ記号：`P` スタート（ちくわくん）、`#` 地面、`B` かまぼこ板、`o` だしのしずく、`e` こんにゃん、`^` つまようじ山、`S` はんぺん、`G` のれん（ゴール）、`C`/`c` ちょうちん（中間・灯る前/後）、`=` 湯気の足場、`X` おせんべい、`?`/`U` おみくじ箱（引く前/後）、`I` 氷の床、`M` お盆、`F` ぱたぱた油揚げ、`E` ゆでたまご、`K` カギ、`D` 扉、`W` 竹筒、`L` 溶岩、`T` トゲの敵、`R` 串発射台、`Y` からし。

ブラウザの保存キー：`stage-kobo-v1`（自分のステージ）、`stage-kobo-progress`（進行データ）。

## テストと見た目の確認（`dev/`）

```
node stage-kobo/dev/test-gameplay.js stage-kobo/index.html   # 新パーツの動き・報酬・スタンプ。「すべて成功」と出れば OK
node stage-kobo/dev/test-smoke.js   stage-kobo/index.html   # 400 フレーム回してエラーが出ないか
node stage-kobo/dev/test-shared.js  stage-kobo/index.html   # 何も解放していない人が共有リンクを開いても、新パーツが配置どおり出て動くか
python3 stage-kobo/dev/screenshot.py stage-kobo/index.html out.png "<localStorage を仕込む JS（省略可）>"
```

スクリーンショットは環境の Chromium（Playwright）で撮れる。背景や新パーツを変えたら、5 種類の背景で画面を見て確認する。

## 残りのタスク

- なし（v1.5.0 で予定していたパーツはすべて実装済み）
- 動作確認用に、全パーツ・全スタンプを解放した Artifact がある（https://claude.ai/artifact/J1KSP7N3bjGpgWgyfPo2cK）。プレビュー版に「最初から全開放」の 1 行（`PG.u = UNLOCKS.map(u => u.ch); PG.got = STAMPS.map(s => s.id);`）とタイトル・説明文の差し替えを足したもの
- push はユーザーが動作確認してから指示する
