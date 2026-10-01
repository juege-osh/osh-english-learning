"""Validate editorial main vocabulary slices; apply only with --apply."""
import json
import re
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
words_path = ROOT / 'data/words.json'
examples_path = ROOT / 'data/examples.json'
words = json.loads(words_path.read_text())
examples = json.loads(examples_path.read_text())
for start in (7901, 8001, 8101, 8201, 8301, 8401):
    rows = [line.split('\t') for line in (ROOT / f'data/curated_glosses_{start}_{start+99}.tsv').read_text().splitlines() if line]
    assert len(rows) == 100
    for entry, fields in zip(words[start-1:start+99], rows):
        assert len(fields) == 2 and fields[0] == entry['word']
        gloss = fields[1]
        assert 1 <= len(gloss) <= 45
        entry['zh'] = gloss
        prefix = '常用：' + gloss + '\n'
        entry['full'] = prefix + (entry['full'].split('\n', 1)[1] if entry['full'].startswith('常用：') else entry['full'])
for start in (7901, 8001, 8101, 8201, 8301, 8401):
    rows = [line.split('\t') for line in (ROOT / f'data/curated_examples_{start}_{start+99}.tsv').read_text().splitlines() if line]
    assert len(rows) == 100
    for entry, row in zip(words[start-1:start+99], rows):
        assert len(row) == 5 and row[0] == entry['word']
        assert row[1] != row[3] and row[2] != row[4]
        for en, zh in ((row[1],row[2]), (row[3],row[4])):
            assert 10 <= len(en) <= 120 and 2 <= len(zh) <= 100
            assert len(re.findall(r'\b'+re.escape(entry['word'])+r'\b',en,re.I)) == 1
            assert en.endswith(('.', '?', '!')) and re.search('[\u4e00-\u9fff]', zh)
        examples[str(entry['id'])] = [{'text':row[1],'translation':row[2],'source':'original'}, {'text':row[3],'translation':row[4],'source':'original'}]
print('Validated 600 common glosses and 600 words / 1200 bilingual examples.')
if '--apply' in sys.argv:
    words_path.write_text(json.dumps(words,ensure_ascii=False,separators=(',',':')))
    examples_path.write_text(json.dumps(examples,ensure_ascii=False,separators=(',',':')))
    print('Applied without changing learning IDs or original dictionary definitions.')
else:
    print('Preview only; use --apply to write data.')
