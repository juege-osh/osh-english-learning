"""Find additional licensed Tatoeba translations outside the old short-list.

Requires the separately downloaded Tatoeba English, Chinese, and link exports.
Writes a review candidate to /tmp and never changes site data. Linked
translations include awkward, wrong-sense, and occasionally inappropriate
sentences, so editorial selection is required before importing any of them.
"""

import bz2
import collections
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "data/examples.json"
ENGLISH = Path("/tmp/english-quest-tatoeba-eng.tsv.bz2")
CHINESE = Path("/tmp/english-quest-tatoeba-cmn-detailed.tsv.bz2")
LINKS = Path("/tmp/english-quest-tatoeba-links.tar.bz2")
TOKEN = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
WORDS = {w["word"]: str(w["id"]) for w in json.loads((ROOT / "data/words.json").read_text()) if w["id"] > 700}
existing = json.loads(EXAMPLES.read_text())
needs = {word for word, word_id in WORDS.items() if not all(item.get("translation") for item in existing[word_id])}

chinese = {}
with bz2.open(CHINESE, "rt", encoding="utf8") as source:
    for line in source:
        fields = line.rstrip("\n").split("\t")
        if len(fields) >= 4:
            chinese[int(fields[0])] = (fields[2], fields[3])

linked = {}
process = subprocess.Popen(["tar", "-xOjf", str(LINKS), "links.csv"], stdout=subprocess.PIPE, text=True)
for line in process.stdout:
    try:
        left, right = (int(x) for x in line.rstrip("\n").split("\t"))
    except ValueError:
        continue
    if left in chinese and right not in chinese:
        linked.setdefault(right, left)
    elif right in chinese and left not in chinese:
        linked.setdefault(left, right)
if process.wait():
    raise RuntimeError("links export failed")

candidates = collections.defaultdict(list)
with bz2.open(ENGLISH, "rt", encoding="utf8") as source:
    for line in source:
        fields = line.rstrip("\n").split("\t")
        if len(fields) < 4:
            continue
        sid, _lang, sentence, author = fields[:4]
        cid = linked.get(int(sid))
        if cid is None or not sentence.endswith((".", "!", "?")) or not 12 <= len(sentence) <= 120:
            continue
        tokens = TOKEN.findall(sentence)
        if not 4 <= len(tokens) <= 17:
            continue
        lower = [token.lower() for token in tokens]
        for word in set(lower) & needs:
            if lower.count(word) != 1:
                continue
            score = (abs(len(tokens) - 7) + (5 if re.search(r"\b(Tom|Mary|Sami|Ziri|Tatoeba)\b", sentence) else 0), len(sentence), int(sid))
            item = {"id": int(sid), "text": sentence, "author": author,
                    "translation": chinese[cid][0], "translationId": cid,
                    "translationAuthor": chinese[cid][1]}
            candidates[word].append((score, item))

updated = json.loads(json.dumps(existing))
changed = 0
for word in needs:
    word_id = WORDS[word]
    original = existing[word_id]
    picked = [item for item in original if item.get("translation")]
    seen = {item["text"] for item in picked}
    for _, item in sorted(candidates[word], key=lambda pair: pair[0]):
        if len(picked) == 2:
            break
        if item["text"] not in seen:
            picked.append(item)
            seen.add(item["text"])
    for item in original:
        if len(picked) == 2:
            break
        if item["text"] not in seen:
            picked.append(item)
            seen.add(item["text"])
    if len(picked) == 2 and picked != original:
        updated[word_id] = picked
        changed += 1

for limit in (1000, 5000, 10000, 20000):
    before = sum(all(item.get("translation") for item in existing[str(i)]) for i in range(1, limit + 1))
    after = sum(all(item.get("translation") for item in updated[str(i)]) for i in range(1, limit + 1))
    print(f"first {limit}: two bilingual examples {before} -> {after}")
print("changed entries:", changed, "linked English sentences:", len(linked))
preview = Path("/tmp/english-quest-linked-bilingual-preview.json")
preview.write_text(json.dumps(updated, ensure_ascii=False, separators=(",", ":")))
print("Candidate only; review each selected sentence before importing:", preview)
