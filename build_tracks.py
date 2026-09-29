"""Build ECDICT-tagged school and exam practice lists from the licensed source CSV."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).parent
source = Path('/tmp/english-ecdict-full.csv')
words = json.loads((ROOT / 'data/words.json').read_text())
current = json.loads((ROOT / 'data/industries.json').read_text())
current = [x for x in current if x.get('category') != 'exam']
lookup = {item['word'].lower(): item['id'] for item in words}
tagged = {tag: set() for tag in ('zk', 'gk', 'cet4', 'cet6', 'toefl', 'ielts', 'gre')}
with source.open(newline='', encoding='utf-8') as handle:
    for row in csv.DictReader(handle):
        word_id = lookup.get(row['word'].lower())
        if word_id:
            for tag in row['tag'].split():
                if tag in tagged:
                    tagged[tag].add(word_id)
specs = (
    ('junior', '初中·中考', 'zk', 'ECDICT 中考标签参考词'),
    ('senior', '高中·高考', 'gk', 'ECDICT 高考标签参考词'),
    ('cet4', '大学英语四级', 'cet4', 'ECDICT 四级标签参考词'),
    ('cet6', '大学英语六级', 'cet6', 'ECDICT 六级标签参考词'),
    ('toefl', '托福', 'toefl', 'ECDICT 托福标签参考词'),
    ('ielts', '雅思', 'ielts', 'ECDICT 雅思标签参考词'),
)
for track_id, name, tag, description in specs:
    current.append({'id': track_id, 'name': name, 'category': 'exam', 'description': description, 'wordIds': sorted(tagged[tag])})
# ECDICT does not contain a TEM8 tag. This is an explicitly labelled advanced
# practice pool, not a purported official TEM8 syllabus.
advanced = sorted((tagged['gre'] | tagged['toefl']) - tagged['cet6'])
current.append({'id': 'tem8', 'name': '专八高阶训练', 'category': 'exam', 'description': '高阶参考词池；不是专八官方考纲词表', 'wordIds': advanced})
(ROOT / 'data/industries.json').write_text(json.dumps(current, ensure_ascii=False, separators=(',', ':')))
print([(x['id'], len(x['wordIds'])) for x in current])
