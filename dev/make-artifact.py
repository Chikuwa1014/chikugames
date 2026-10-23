#!/usr/bin/env python3
"""サイト版のゲームから、claude.ai のアーティファクト（プレビュー）版の HTML を作る。

使い方:
    python3 dev/make-artifact.py <フォルダ> [設定名]
    例) python3 dev/make-artifact.py roulette
        python3 dev/make-artifact.py stage-kobo unlocked   ← 設定名つき（全開放の確認用など）

出力: .artifact/<フォルダ>[-<設定名>].html（git には入らない）
これを Artifact ツールで公開する。2 回目以降は <フォルダ>/dev/artifact.json の url のアーティファクトを更新する。

変換の中身（どのゲームでも同じ）:
  0. 手元のファイルを読み込む <script src="…"> と <link rel="stylesheet" href="…">（共通部品 ../common/v1/ など）を、
     中身を埋め込んだ <script> / <style> に置き換える（http で始まる外部のものはそのまま）
  1. <head> から <title>、Google Fonts の <link>、<style>、<script> だけを残す
     （<meta>・favicon などはアーティファクト側が用意するので消す）
  2. viewport-fit=cover なら <meta name="claude:viewport-fit-sides" content="cover"> を足す
  3. <body> の中身をそのまま続ける（<html>・<head>・<body> のタグは消す）
  4. <!-- artifact:skip --> 〜 <!-- /artifact:skip --> で囲んだ部分は消す（サイト専用の部分）
  5. <フォルダ>/dev/artifact.json の replace を当てる（共有用 URL など、ゲームごとの違い）
     find はちょうど 1 か所に当たること。0 か所・2 か所以上ならエラーで止める（ずれの見落とし防止）

<フォルダ>/dev/artifact.json の形:
{
  "source": "index.html",                 // 元にするファイル（shop-sim は "dist/shop-sim.html"）
  "build": "python3 build.py",            // 先に実行するコマンド（無ければ省略）
  "url": "https://claude.ai/artifact/…",  // 公開済みのアーティファクト（まだ無ければ ""）
  "replace": [ {"find": "…", "replace": "…"} ],
  "profiles": {                           // 設定名ごとの追加の置き換え（省略可）
    "unlocked": { "url": "…", "replace": [ … ] }
  }
}
replace の中では {ARTIFACT_URL}（その設定の url）、{SITE_ORIGIN}（dev/site.json の origin。例 https://example.com）、
{SITE_WS}（同じドメインの wss://。マルチプレイの仲介用）が使える。公開 URL が未設定のあいだは、
{SITE_ORIGIN}・{SITE_WS} を使う置き換えはとばす（注意を表示する）。
"""
import json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def fail(msg):
    print("エラー: " + msg, file=sys.stderr)
    sys.exit(1)


def load_json(p):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as e:
        fail(f"{p.relative_to(ROOT)} の書き方がまちがっています（{e}）")


def inline_local(html, base):
    """手元のファイルを読む <script src> と <link rel="stylesheet"> を中身に置き換える（base は元の HTML のフォルダ）"""
    def body(src):
        f = (base / src).resolve()
        if not f.is_file() or ROOT not in f.parents:
            fail(f"埋め込むファイルが見つかりません: {src}")
        return f.read_text(encoding="utf-8")

    def js(m):
        src = m.group(1)
        if re.match(r"^(https?:)?//", src):
            return m.group(0)
        return "<script>\n" + body(src) + "</script>"

    def css(m):
        href = m.group(1)
        if re.match(r"^(https?:)?//", href):
            return m.group(0)
        return "<style>\n" + body(href) + "</style>"

    html = re.sub(r'<script\s+src="([^"]+)"\s*></script>', js, html)
    html = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', css, html)
    return html


def convert(html):
    html = re.sub(r"<!--\s*artifact:skip\s*-->.*?<!--\s*/artifact:skip\s*-->\n?", "", html, flags=re.S)
    m_head = re.search(r"<head[^>]*>(.*?)</head>", html, re.S | re.I)
    m_body = re.search(r"<body[^>]*>(.*)</body>", html, re.S | re.I)
    if not m_head or not m_body:
        fail("<head> と <body> が見つかりません")
    head = m_head.group(1)
    keep = []
    for m in re.finditer(r"<title>.*?</title>|<style[^>]*>.*?</style>|<script[^>]*>.*?</script>|<link[^>]*>", head, re.S | re.I):
        tag = m.group(0)
        if tag.lower().startswith("<link"):
            if "fonts.googleapis.com" not in tag and "fonts.gstatic.com" not in tag:
                continue   # favicon など
        keep.append(tag)
        if tag.lower().startswith("<title") and "viewport-fit=cover" in head:
            keep.append('<meta name="claude:viewport-fit-sides" content="cover">')
    return "\n".join(keep) + "\n" + m_body.group(1).strip("\n") + "\n"


def main():
    if len(sys.argv) < 2:
        fail("使い方: python3 dev/make-artifact.py <フォルダ> [設定名]")
    folder, profile = sys.argv[1].strip("/"), (sys.argv[2] if len(sys.argv) > 2 else "")
    gdir = ROOT / folder
    cfg = load_json(gdir / "dev" / "artifact.json")
    if cfg is None:
        fail(f"{folder}/dev/artifact.json がありません")
    site = load_json(ROOT / "dev" / "site.json") or {}

    if cfg.get("build"):
        r = subprocess.run(cfg["build"], shell=True, cwd=gdir)
        if r.returncode:
            fail(f"build（{cfg['build']}）が失敗しました")

    src = gdir / cfg.get("source", "index.html")
    html = inline_local(src.read_text(encoding="utf-8"), src.parent)
    out = convert(html)

    url = cfg.get("url", "")
    reps = list(cfg.get("replace", []))
    if profile:
        p = (cfg.get("profiles") or {}).get(profile)
        if p is None:
            fail(f"設定名「{profile}」が artifact.json の profiles にありません")
        url = p.get("url", "")
        reps += p.get("replace", [])

    for r in reps:
        find, rep = r["find"], r["replace"]
        if ("{SITE_ORIGIN}" in rep or "{SITE_WS}" in rep) and not site.get("origin"):
            print(f"注意: 公開 URL が未設定のため、この置き換えをとばしました → {find[:50]}", file=sys.stderr)
            continue
        if "{ARTIFACT_URL}" in rep and not url:
            print(f"注意: アーティファクトの url が未設定です（初回の公開後に artifact.json に書いて、もう一度実行） → {find[:50]}", file=sys.stderr)
        origin = site.get("origin", "").rstrip("/")
        ws = re.sub(r"^http", "ws", origin)
        rep = rep.replace("{ARTIFACT_URL}", url).replace("{SITE_ORIGIN}", origin).replace("{SITE_WS}", ws)
        n = out.count(find)
        if n != 1:
            fail(f"置き換え前の文字列が {n} か所あります（1 か所のはず）: {find[:80]}")
        out = out.replace(find, rep)

    dest = ROOT / ".artifact" / (folder + (f"-{profile}" if profile else "") + ".html")
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(out, encoding="utf-8")
    print(f"{dest.relative_to(ROOT)} を作成しました（{len(out.encode('utf-8')):,} バイト）"
          + (f"　公開先: {url}" if url else "　公開先: 未設定（新しいアーティファクトとして公開）"))


if __name__ == "__main__":
    main()
