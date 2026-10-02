"""Apply the reviewed 701–1100 quality layer after the original curation scripts.
Sparse before/after assertions reject unexpected content rather than overwriting it.
External source IDs/authors stay intact; edited text and original text are separate.
"""
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
wp, ep = ROOT/'data/words.json', ROOT/'data/examples.json'
words, examples = json.loads(wp.read_text()), json.loads(ep.read_text())
fields = changed_words = 0
for start in (701, 801, 901, 1001):
    report = json.loads((ROOT/f'qa/reviewed_examples_{start}_{start+99}.json').read_text())
    assert report['status'] == 'frozen_after_root_cross_review'
    seen = set()
    for c in report['changes']:
        wid, field = c['word_id'], c['field']
        assert start <= wid <= start+99 and field in ('gloss', 'text', 'translation')
        w = words[wid-1]
        assert w['id'] == wid and w['word'] == c['word']
        key = (wid, field, None if field == 'gloss' else c['example_index'])
        assert key not in seen
        seen.add(key)
        if field == 'gloss':
            assert w['zh'] in (c['before'], c['after']), key
            assert w['full'].startswith('常用：'+w['zh']+'\n'), key
            w['zh'] = c['after']
            w['full'] = '常用：'+c['after']+'\n'+w['full'].split('\n',1)[1]
        else:
            x = examples[str(wid)][c['example_index']]
            assert x[field] in (c['before'], c['after']), key
            for k,v in c['original_metadata'].items():
                assert x.get(k) == v, (key,k)
            if x.get('id'):
                assert x.get(field+'Original', c['before']) == c['before'], key
                assert x.get(field+'Edited', '本站校订') == '本站校订', key
                x[field+'Original'] = c['before']
                x[field+'Edited'] = '本站校订'
            x[field] = c['after']
        fields += 1
    changed_words += len({c['word_id'] for c in report['changes']})
print(f'Validated 400 glosses and 800 bilingual pairs; {fields} corrections on {changed_words} words.')
if '--apply' in sys.argv:
    wp.write_text(json.dumps(words,ensure_ascii=False,separators=(',',':')))
    ep.write_text(json.dumps(examples,ensure_ascii=False,separators=(',',':')))
    print('Applied the quality layer while preserving external attribution and learning IDs.')
else:
    print('Preview only. Use --apply to update the two JSON files.')
