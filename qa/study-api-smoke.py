#!/usr/bin/env python3
"""Local-only two-account API smoke. Credentials and cookies stay in memory."""
import http.cookiejar, json, pathlib, secrets, time, urllib.error, urllib.request
BASE = 'http://127.0.0.1:19005'
DEST = pathlib.Path('state/evidence-v1310/study-api-smoke.json')
checks, bodies, private = [], [], []
def client():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar
def call(c, path, method='GET', data=None, owner=None, origin=None):
    headers = {}
    if data is not None: headers['Content-Type'] = 'application/json'
    if owner is not None: headers['X-Study-Owner'] = owner
    if origin is not None: headers['Origin'] = origin
    req = urllib.request.Request(BASE + path, data=None if data is None else json.dumps(data).encode(), headers=headers, method=method)
    try:
        with c.open(req, timeout=15) as r: status, body = r.status, r.read().decode()
    except urllib.error.HTTPError as e: status, body = e.code, e.read().decode()
    bodies.append(body)
    try: result = json.loads(body)
    except json.JSONDecodeError: result = None
    return status, result

def check(name, passed, status=None):
    checks.append({'name': name, 'passed': bool(passed), **({'status': status} if status is not None else {})})

guest, _ = client()
s, _ = call(guest, '/api/study'); check('unauthenticated_study_rejected', s == 401, s)
s, _ = call(guest, '/api/study/assistant', 'POST', {'mode':'explain','text':'hello'}); check('unauthenticated_ai_rejected_without_provider_call', s == 401, s)
accounts = []
for suffix in ('a','b'):
    c, jar = client()
    name, password = 'smk' + secrets.token_hex(5) + suffix, secrets.token_urlsafe(24)
    private.append(password)
    s, _ = call(c, '/api/account/register', 'POST', {'name':name,'email':name+'@example.test','password':password})
    check('register_test_account_'+suffix, s == 200, s)
    s, account = call(c, '/api/account')
    aid = account.get('id') if isinstance(account, dict) else None
    check('account_identity_'+suffix, s == 200 and bool(aid), s)
    private.extend(cookie.value for cookie in jar if cookie.name == "eq_session")
    accounts.append((c, aid, name, password))
a, aid, name, password = accounts[0]; b, bid, _, _ = accounts[1]
check('distinct_account_owners', aid and bid and aid != bid)
s, initial = call(a, '/api/study'); check('bootstrap_owner', s == 200 and initial.get('owner') == aid, s)
rev = initial.get('revision', 0)
doc = {'version':1,'entries':{'word:smoke-hello':{'at':int(time.time()*1000),'deleted':False,'value':{'item':{'id':'smoke-hello','en':'hello','zh':'你好'},'favorite':True}}}}
payload = {'revision':rev,'study':doc}
for label, c, owner in [('missing_post_owner',a,None),('wrong_post_owner',a,bid),('old_owner_with_new_account_cookie',b,aid)]:
    s, result = call(c, '/api/study','POST',payload,owner)
    check(label, s == 403 and result.get('owner') == (bid if c is b else aid), s)
s, _ = call(a, '/api/study', owner=bid); check('wrong_get_owner_rejected', s == 403, s)
s, saved = call(a, '/api/study','POST',payload,aid); check('valid_favorite_save', s == 200 and saved.get('owner') == aid and saved.get('revision') == rev+1, s)
s, conflict = call(a, '/api/study','POST',payload,aid); check('stale_revision_conflict', s == 409 and conflict.get('owner') == aid, s)
s, remote = call(b, '/api/study', owner=bid); check('second_account_isolated', s == 200 and remote.get('owner') == bid and 'word:smoke-hello' not in remote['study']['entries'], s)
s, _ = call(a, '/api/study','POST',{'revision':rev+1,'study':doc},aid,'https://other.example'); check('cross_origin_rejected', s == 403, s)
s, _ = call(a, '/api/account/logout','POST',{}); check('logout',s == 200,s)
again, jar = client()
s, _ = call(again, '/api/account/login','POST',{'name':name,'password':password}); check('fresh_session_login',s == 200,s)
private.extend(cookie.value for cookie in jar if cookie.name == "eq_session")
s, reloaded = call(again, '/api/study', owner=aid)
favorite = reloaded.get('study',{}).get('entries',{}).get('word:smoke-hello',{}).get('value',{}).get('favorite') if isinstance(reloaded,dict) else None
check('favorite_persists_after_logout_and_reload', s == 200 and favorite is True and reloaded.get('revision') == rev+1,s)
forbidden = {'password','token','salt','hash','apikey','api_key','authorization','cookie','session'}
def secret_field(x):
    if isinstance(x,dict): return any(str(k).lower() in forbidden or secret_field(v) for k,v in x.items())
    if isinstance(x,list): return any(secret_field(v) for v in x)
    return False
leaked = any(secret in body for secret in private for body in bodies if secret)
fields = False
for body in bodies:
    try: fields = fields or secret_field(json.loads(body))
    except json.JSONDecodeError: pass
check('no_credentials_tokens_or_secret_fields_in_response', not leaked and not fields)
result={'base':BASE,'executedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'accountCount':2,'checks':checks,'passed':all(x['passed'] for x in checks),'credentialsRecorded':False,'cookiesRecorded':False,'providerRequestsMade':False}
DEST.parent.mkdir(parents=True, exist_ok=True)
DEST.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':result['passed'],'checks':len(checks),'failures':[x for x in checks if not x['passed']],'evidence':str(DEST)},ensure_ascii=False))
raise SystemExit(0 if result['passed'] else 1)
