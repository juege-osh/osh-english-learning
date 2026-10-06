#!/usr/bin/env python3
"""Apply the frozen chapter-fourteen en-only quality layer after earlier editorial layers."""
import argparse,json
from pathlib import Path

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parent.parent)
    ap.add_argument('--apply',action='store_true')
    args=ap.parse_args();root=args.root.resolve()
    patch=json.loads((root/'qa/reviewed_definitions_13001_13600.json').read_text())
    words_path=root/'data/words.json';words=json.loads(words_path.read_text())
    seen=set();pending=[]
    assert len(words)==20000 and patch['status']=='frozen'
    for c in patch['changes']:
        assert c['field']=='en' and 13001<=c['id']<=13600 and c['id'] not in seen
        seen.add(c['id']);w=words[c['id']-1]
        assert w['id']==c['id'] and w['word']==c['word'],f"ID/word drift at {c['id']}"
        assert w.get('en','') in [c['before'],c['after']],f"Unexpected en at {c['id']}"
        if w.get('en','')!=c['after']:pending.append((w,c['after']))
    assert len(seen)==patch['changed_words']
    if args.apply and pending:
        for w,en in pending:w['en']=en
        words_path.write_text(json.dumps(words,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({'reviewed_words':600,'patch_words':patch['changed_words'],'pending':len(pending),'applied':bool(args.apply),'examples_untouched':True}))
if __name__=='__main__':main()
