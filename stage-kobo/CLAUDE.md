# つくれ！おでん横丁（旧名：ステージ工房）引き継ぎメモ

全ゲーム共通のルールは号口（`Chikuwa1014/chikugames`）の `CLAUDE.md`。ここにはこのゲームだけのことを書く。

## 1. 概要

ちくわくんが走る「おでん横丁」の 2D アクションステージを作り、テストプレイし、リンクで共有するブラウザゲームメーカー。
クリアでもらえるちくわとスタンプでパーツを解放していく。
現在 **v1.5.4**（2026-10-23）。更新履歴は `CHANGELOG.md` と、`index.html` 末尾の「更新履歴」欄。

## 2. URL

- 公開：`/stage-kobo/`（ゲーム名を変えても URL は変えない。共有リンクが切れるため）
- アーティファクト（push 前の確認用）：
  - 通常版：https://claude.ai/artifact/DLL2tcjb9FhfsTtGPgP8Uh
  - 全開放版（全パーツ・全スタンプ解放済みで始まる確認用）：https://claude.ai/artifact/J1KSP7N3bjGpgWgyfPo2cK
- アーティファクト版は `python3 dev/make-artifact.py stage-kobo`（全開放版は末尾に `unlocked`）で作る。**サイト版だけ直せばよい。**
  サイト版との違いは `dev/artifact.json` にまとめてある：
  - `<head>` のメタ情報・favicon・リセット CSS（`<!-- artifact:skip -->` で囲んだ部分）を消す
  - `BASE_URL`：サイト版は `location.origin + location.pathname`、アーティファクト版はアーティファクトの URL
  - 共有ポップアップの注記文
  - 全開放版だけ：タイトル・説明文と、`PG` を全開放にする 1 行
- トップページのカードは `card.js`。

## 3. コードの地図（`index.html` の `<script>` 内）

| 部分 | 中身 |
|---|---|
| 定数 | `T=24`（1 マス px）、`W=40`×`H=15` マス、`VW=20`（プレイ時の表示幅） |
| `DEF` / `TUNING` | ゲーム設定の初期値と、報酬・動きの調整用の数値（5 章） |
| `THEMES` | 背景 5 種：day「ある日の昼下がり」、dusk「たそがれどき」、night「流星のぐんじょう」、magma「マンマンボルケーノ」、ice「カチンコチンコ」。地面の色など |
| `ALL_PARTS` / `KEY_PARTS` / `GENRES` | パーツ一覧、数字キー、パーツ棚のジャンル（プルダウンで切り替え。新パーツはどれかのジャンルの `parts` に足す） |
| `UNLOCKS` / `STAMPS` / `ALIAS` | ちくわで解放するパーツと、スタンプのミッション（`ch` が獲得で解放されるパーツ）。扉 `D` はカギ `K` といっしょに解放（`ALIAS`） |
| `normalize` / `fromData` | ステージの検証。使える記号は `.#Boe^SGPC=X?IMFEKDWLTRY`。新パーツを足すときはこの正規表現にも記号を追加 |
| `encodeShare` / `decodeShare` / `checksum` / `parseCode` | 共有リンク `#st.<base64>.<チェック値>` とステージコード `SK1.<同じ>`。改ざんすると読み込まない |
| 進行データ `PG` | ちくわ・解放済み・スタンプ（4 章） |
| `grantClear` | クリア報酬。各ステージ（中身から作る ID）につき 1 回。金額は `TUNING.reward` |
| `drawPlayer` / `drawEnemy` / `drawFly` / `drawSpiky` / `drawSkewer` / `drawDrop` / `drawTile` | 描画。パーツ記号ごとの見た目は `drawTile` の `switch` |
| `STREET` / `yokocho` / `SKY` | 背景。空（`SKY.<テーマ>`）の上に横丁の町並み `yokocho()` を重ねる。町並みの下に基礎（濃い灰色→下ほど暗いグラデーション） |
| `solidAt` / `blocks` / `bonk` / `move` / `update` | 当たり判定と物理。湯気の足場は上からだけ乗れる。下からたたくとおせんべいが割れ、おみくじ箱からしずくが出る。`startGame` でお盆・飛ぶ敵・トゲの敵・串発射台・竹筒を `game` の中の一覧に移す |
| `fingers` / `gesture` / `applyGesture` / `drag` / `moveMode`（編集の `pointerdown` 〜 `endPaint`） | 編集画面の入力。一本指はパーツを置く。二本指はドラッグで画面移動・ピンチで拡大縮小（1 フレームにまとめて `applyGesture` で処理。1 本目で置いた分は `snap` から戻す）。PC は「移動モード」（`#moveBtn`）でドラッグ移動。画面を動かす量は `screenX/Y` で測る（`clientX/Y` だとページが動くたびにずれて揺れる）。スマホの移動モードは JS で動かさず、`touch-action: pan-x pan-y` でブラウザのスクロールに任せる |
| `TIPS`（`#palTip` / `#keysTip`、`.tip` / `.tipBox`） | 「？」のヒント（パーツ棚、テストプレイの操作）。新しく足すときは `TIPS` に id を足す。`@media (hover:hover)` のときはマウスを重ねて表示、それ以外は `.open` をタップで切り替え |
| `ZOOMS` / `zoom` / `setZoom` / `scrollStage` / `#zoombar` | 編集画面の拡大・縮小（35%〜200%。－／＋ は `ZOOMS` の段階、ピンチはなめらか）。`sizeCanvas` が `cv.style` の幅・高さを倍率で決める。拡大中は `#scroller` の高さを 15 マス分に制限し、枠の中で上下にスクロール |
| `beginPlay` / `#startBtn` | 共有リンクで開くとプレイ画面で止まった状態（`game.state = 'ready'`）になり、「プレイ」ボタンで始まる。リトライは止めずにすぐ始まる |

パーツ記号：`P` スタート（ちくわくん）、`#` 地面、`B` かまぼこ板、`o` だしのしずく、`e` こんにゃん、`^` つまようじ山、`S` はんぺん、`G` のれん（ゴール）、`C`/`c` ちょうちん（中間・灯る前/後）、`=` 湯気の足場、`X` おせんべい、`?`/`U` おみくじ箱（引く前/後）、`I` 氷の床、`M` お盆、`F` ぱたぱた油揚げ、`E` ゆでたまご、`K` カギ、`D` 扉、`W` 竹筒、`L` 溶岩、`T` トゲの敵、`R` 串発射台、`Y` からし。

## 4. 保存キー

| キー | 中身 |
|---|---|
| `stage-kobo-v1` | 自分のステージ（JSON：タイトル・背景・設定・マップ） |
| `stage-kobo-progress` | 進行データ `PG`（ちくわ・解放済みパーツ・クリア記録・スタンプ）。base64＋チェック値で保存し、書き換えられていたら初期化 |

`PG` に項目を足すときは `freshPG()` に初期値を足す（古いデータは `Object.assign(freshPG(), …)` で埋まる）。

## 5. 調整用の数値

- `TUNING`（`DEF` のすぐ下）：クリア報酬、からし（無敵）の長さ、ジャンプの猶予、ミス後の待ち時間、落下の最高速度、はんぺん・ふみつけの跳ねる強さ。
- `UNLOCKS` の `cost`：パーツの解放に必要なちくわ。`STAMPS` の `goal`：スタンプの条件。
- `DEF`：ゲーム設定（重力・ジャンプ力・移動速度・敵の速さ・残機）の初期値。**共有リンクにも入る**ので、変えると既存ステージの手ざわりも変わる。
- 報酬を変えたら、画面の「ちくわのもらい方」（`#collect` の `<details>`）の文章もそろえる。

## 6. テスト（`dev/`）

```
node stage-kobo/dev/test-gameplay.js stage-kobo/index.html   # 新パーツの動き・報酬・スタンプ。「すべて成功」と出れば OK
node stage-kobo/dev/test-smoke.js   stage-kobo/index.html   # 400 フレーム回してエラーが出ないか
node stage-kobo/dev/test-shared.js  stage-kobo/index.html   # 何も解放していない人が共有リンクを開いても、新パーツが配置どおり出て動くか
python3 stage-kobo/dev/screenshot.py stage-kobo/index.html out.png "<localStorage を仕込む JS（省略可）>"
```

背景や新パーツを変えたら、5 種類の背景で画面を見て確認する。

## 7. ゲーム固有の決まり

- バージョンを上げるたびに：`const VERSION`、画面の更新履歴 `<li>`（最新の 1 件だけ上の `<ul>` に置き、1 つ前の版は「過去の更新履歴」の `<details>` の先頭に移す）、`CHANGELOG.md`、`README.md` の版数、`card.js` の `version` / `updated` をそろえる。
- SNS 共有のハッシュタグは `#つくれおでん横丁 #ちくわげーむず`（Facebook は hashtag パラメータ）。
- パーツの解放状態は「パーツ棚に置けるかどうか」だけに使う。共有リンク・ステージコードで開いたステージは、遊ぶ人が未解放のパーツでも配置どおりに出て動く（プレイの処理で解放状態を見ないこと）。
- 見た目・アイテム名はおでん横丁のオリジナルで（既存の有名ゲームに似せない）。

## 8. 残りのタスク

`claude/未実装タスク.md` を参照。いまは予定のタスクなし（v1.5.0 で予定していたパーツはすべて実装済み）。
