#!/usr/bin/env python3
"""index.html の css / js を1つのHTMLに埋め込み、dist/shop-sim.html を作る。
Claudeの画面で公開する場合や、1ファイルで配布したい場合に使う。
使い方: python3 build.py
"""
import re, pathlib

root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")

def inline_css(m):
    css = (root / m.group(1)).read_text(encoding="utf-8")
    return "<style>\n" + css + "</style>"

def inline_js(m):
    js = (root / m.group(1)).read_text(encoding="utf-8")
    return "<script>\n" + js + "</script>"

html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

out = root / "dist"
out.mkdir(exist_ok=True)
(out / "shop-sim.html").write_text(html, encoding="utf-8")
print("dist/shop-sim.html を作成しました（%d バイト）" % len(html.encode("utf-8")))
