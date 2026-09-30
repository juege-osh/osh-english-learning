"""Validate and apply concise learner-facing glosses for words 501–700."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/curated_glosses_501_700.tsv"
WORDS = ROOT / "data/words.json"
words = json.loads(WORDS.read_text())
rows = [line.split("\t") for line in SOURCE.read_text().splitlines() if line.strip()]
assert len(rows) == 200, f"expected 200 words, found {len(rows)}"
for word_id, fields in enumerate(rows, start=501):
    assert len(fields) == 2, (word_id, fields)
    headword, gloss = fields
    entry = words[word_id - 1]
    assert entry["id"] == word_id and entry["word"] == headword, (word_id, headword)
    assert 1 <= len(gloss) <= 45, (headword, gloss)
    entry["zh"] = gloss
    prefix = "常用：" + gloss + "\n"
    if entry["full"].startswith("常用："):
        entry["full"] = prefix + entry["full"].split("\n", 1)[1]
    else:
        entry["full"] = prefix + entry["full"]

print("Validated 200 common Chinese glosses for words 501–700.")
if "--apply" in sys.argv:
    WORDS.write_text(json.dumps(words, ensure_ascii=False, separators=(",", ":")))
    print("Applied to data/words.json.")
else:
    print("Preview only; rerun with --apply to update the site data.")
