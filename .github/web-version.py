"""Writes version.json, which the web version of Dante reads to learn of a newer version.

Usage: web-version.py <version> <news.json> <output>

news.json, written by news.py history, lists the notes of every version in Italian and
English; the update banner shows those newer than the version open in the browser.
"""

import json
import sys
from pathlib import Path

version, news_file, output = sys.argv[1:4]
news = json.loads(Path(news_file).read_text(encoding="utf-8")) if Path(news_file).exists() else {}
Path(output).write_text(json.dumps({"version": version, "news": news}, ensure_ascii=False), encoding="utf-8")
print(Path(output).read_text(encoding="utf-8"))
