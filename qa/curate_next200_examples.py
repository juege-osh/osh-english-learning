"""Apply the edited, everyday bilingual examples for main-route words 501–700.

The TSV is the reviewable source. Run without --apply to validate it first.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "data/examples.json"
words = json.loads((ROOT / "data/words.json").read_text())
examples = json.loads(EXAMPLES.read_text())

for start, end in ((501, 600), (601, 700)):
    source = ROOT / f"data/curated_examples_{start}_{end}.tsv"
    rows = [line.split("\t") for line in source.read_text().splitlines() if line.strip()]
    assert len(rows) == 100, (source, len(rows))
    for word_id, fields in enumerate(rows, start=start):
        assert len(fields) == 5, (word_id, fields)
        word, en1, zh1, en2, zh2 = fields
        assert word == words[word_id - 1]["word"], (word_id, word)
        assert en1 != en2 and zh1 != zh2, word
        for english, chinese in ((en1, zh1), (en2, zh2)):
            assert 10 <= len(english) <= 120 and 2 <= len(chinese) <= 100, word
            assert len(re.findall(r"\b" + re.escape(word) + r"\b", english, re.I)) == 1, (word, english)
            assert english.endswith((".", "?", "!")), (word, english)
        examples[str(word_id)] = [
            {"text": en1, "translation": zh1, "source": "original"},
            {"text": en2, "translation": zh2, "source": "original"},
        ]

print("Validated 200 headwords and 400 original bilingual sentences for 501–700.")
if "--apply" in sys.argv:
    EXAMPLES.write_text(json.dumps(examples, ensure_ascii=False, separators=(",", ":")))
    print("Applied to data/examples.json.")
else:
    print("Preview only; rerun with --apply to update the site data.")
