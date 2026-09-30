"""Replace missing translations in words 1001–1100 with edited examples."""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    (ROOT / "data/curated_examples_1001_1100_gaps.tsv", 40),
    (ROOT / "data/curated_examples_1001_1100_fixes.tsv", 22),
)
EXAMPLES = ROOT / "data/examples.json"
words = json.loads((ROOT / "data/words.json").read_text())
examples = json.loads(EXAMPLES.read_text())
word_ids = {word["word"]: word["id"] for word in words[1000:1100]}
rows = []
for source, expected in SOURCES:
    group = [line.split("\t") for line in source.read_text().splitlines() if line.strip()]
    assert len(group) == expected, (source, len(group))
    rows.extend(group)
assert len({row[0] for row in rows}) == len(rows)
assert {row[0] for row in rows} <= set(word_ids)
for fields in rows:
    assert len(fields) == 5, fields
    word, en1, zh1, en2, zh2 = fields
    assert en1 != en2 and zh1 != zh2, word
    for english, chinese in ((en1, zh1), (en2, zh2)):
        assert 10 <= len(english) <= 120 and 2 <= len(chinese) <= 100, word
        assert len(re.findall(r"\b" + re.escape(word) + r"\b", english, re.I)) == 1, (word, english)
        assert english.endswith((".", "?", "!")), (word, english)
    examples[str(word_ids[word])] = [
        {"text": en1, "translation": zh1, "source": "original"},
        {"text": en2, "translation": zh2, "source": "original"},
    ]

print(f"Validated {len(rows)} headwords and {len(rows) * 2} original bilingual sentences for words 1001–1100.")
if "--apply" in sys.argv:
    EXAMPLES.write_text(json.dumps(examples, ensure_ascii=False, separators=(",", ":")))
    print("Applied to data/examples.json.")
else:
    print("Preview only; rerun with --apply to update the site data.")
