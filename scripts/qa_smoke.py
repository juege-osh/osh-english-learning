#!/usr/bin/env python3
"""Disposable, multi-account HTTP smoke test. Use only against an isolated local state directory."""
import json, secrets, urllib.request, urllib.error, http.cookiejar, zlib, struct, pathlib, os
from urllib.parse import urlparse

BASE = os.environ.get('ENGLISH_QA_BASE_URL', 'http://127.0.0.1:19005').rstrip('/')
assert urlparse(BASE).scheme == 'http' and urlparse(BASE).hostname in ('127.0.0.1', 'localhost'), 'smoke tests are local only'
RUN = secrets.token_hex(3)
checks=[]

class Client:
    def __init__(self, name):
        self.name=name
        self.jar=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
    def call(self, path, body=None, status=200, raw=None, content_type=None):
        data=raw if raw is not None else (json.dumps(body,ensure_ascii=False).encode() if body is not None else None)
        headers={}
        if body is not None: headers['Content-Type']='application/json'
        if content_type: headers['Content-Type']=content_type
        request=urllib.request.Request(BASE+path,data=data,headers=headers)
        try: res=self.opener.open(request,timeout=12)
        except urllib.error.HTTPError as e: res=e
        payload=res.read()
        assert res.status==status, f'{self.name} {path}: {res.status} != {status}: {payload[:160]!r}'
        if status==200 and res.headers.get('Content-Type','').startswith('application/json'):
            return json.loads(payload)
        return payload
    def register(self):
        self.call('/api/membership')
        self.call('/api/account/register',{'name':self.name,'email':self.name+'@example.test','password':'test-pass-123'})
        assert self.call('/api/account')['name']==self.name

def ok(name, condition):
    assert condition,name
    checks.append(name)
    print('PASS',name,flush=True)

def png_100():
    width=height=100
    def chunk(kind,body): return struct.pack('>I',len(body))+kind+body+struct.pack('>I',zlib.crc32(kind+body)&0xffffffff)
    raw=b''.join(b'\x00'+b'\xc0\xdd\xff'*width for _ in range(height))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')

def multipart(fields,field,filename,filedata):
    boundary='----qa'+secrets.token_hex(8)
    chunks=[]
    for k,v in fields.items():chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\nContent-Type: image/png\r\n\r\n'.encode()+filedata+b'\r\n')
    chunks.append(f'--{boundary}--\r\n'.encode())
    return b''.join(chunks),'multipart/form-data; boundary='+boundary

def main():
    a,b,c,d=[Client('qa_'+RUN+'_'+x) for x in 'abcd']
    for x in a,b,c,d:x.register()
    ok('四账号注册与登录态隔离',len({x.call('/api/account')['name'] for x in [a,b,c,d]})==4)
    community=a.call('/api/community')
    ok('免费账号不读取入群联系信息',not community['groupAccess'] and not community['settings']['groupContact'] and not community['settings']['groupInstructions'])
    a.call('/api/community/settings',{'followLinks':{}},status=403)
    a.call('/api/codes/create',{'kind':'month'},status=403)
    ok('普通账号不能修改社区或生成兑换码',True)
    Client('guest').call('/api/redeem',{'code':'test-invalid-code'},status=401)
    ok('兑换码必须绑定已登录账号',True)
    a.call('/api/account/logout',{})
    ok('退出后账号不可见',not a.call('/api/account')['registered'])
    a.call('/api/account/login',{'name':a.name,'password':'test-pass-123'})
    ok('退出后可重新登录',a.call('/api/account')['registered'])
    payload={'revision':0,'progress':{'version':1,'xp':100,'goal':10000,'levels':{'1':100},'bosses':{},'missions':{},'words':{},'days':{},'dailyGoal':20,'industries':{'programmer':{'seen':[1],'answers':{'1':{'correct':False,'at':100}}}}}}
    saved=a.call('/api/progress',payload)
    ok('账号进度保存/读取',a.call('/api/progress')['revision']==saved['revision'])
    another_device=Client('second-device')
    another_device.call('/api/account/login',{'name':a.name,'password':'test-pass-123'})
    ok('另一浏览器登录后能读取进度',another_device.call('/api/progress')['revision']==saved['revision'])
    ok('专项错词跨设备保存且对其他账号隐藏',another_device.call('/api/progress')['progress']['industries']['programmer']['answers']['1']['correct'] is False and not b.call('/api/progress')['progress'])
    a.call('/api/progress',payload,status=409)
    ok('过期版本不能覆盖进度',True)
    extra=a.call('/data/industry_words.json')
    meiosis=next(word for word in extra if word['word']=='meiosis')
    payload['revision']=saved['revision']
    payload['progress']['industries']['biology']={'seen':[meiosis['id']],'answers':{str(meiosis['id']):{'correct':False,'at':200}}}
    a.call('/api/progress',payload)
    synced=another_device.call('/api/progress')['progress']
    ok('独立行业词跨设备保存且不进入主线计数',meiosis['id']>20000 and synced['industries']['biology']['seen']==[meiosis['id']] and not synced['words'])
    biology=b.call('/api/industries/challenge?sector=biology')
    b.call('/api/industries/submit',{'sector':'biology','edition':biology['edition'],'name':b.name,'answers':[q['options'][0]['id'] for q in biology['questions']]})
    ok('生物专业词参与专项题及榜单',len(biology['questions'])==20 and len(b.call('/api/industries/leaderboard?sector=biology')['entries'])==1)
    daily_before=len(a.call('/api/daily/leaderboard?goal=5000')['entries'])
    other_before=len(a.call('/api/daily/leaderboard?goal=20000')['entries'])
    daily=a.call('/api/daily?goal=5000')
    answers=[q['options'][0]['id'] for q in daily['questions']]
    a.call('/api/daily/submit',{'goal':5000,'name':a.name,'answers':answers})
    entries=a.call('/api/daily/leaderboard?goal=5000')['entries']
    ok('每日题与同档榜单',len(daily['questions'])==20 and len(entries)==daily_before+1 and len(a.call('/api/daily/leaderboard?goal=20000')['entries'])==other_before)
    sectors=a.call('/api/industries')['industries']
    ok('行业及考试目录',len(sectors)==16)
    industry_before=len(b.call('/api/industries/leaderboard?sector=programmer')['entries'])
    iq=b.call('/api/industries/challenge?sector=programmer')
    b.call('/api/industries/submit',{'sector':'programmer','edition':iq['edition'],'name':b.name,'answers':[q['options'][0]['id'] for q in iq['questions']]})
    ok('行业题与独立榜单',len(iq['questions'])==20 and len(b.call('/api/industries/leaderboard?sector=programmer')['entries'])==industry_before+1)
    ac=a.call('/api/friends/status')['me']['code']
    b.call('/api/friends/status')
    b.call('/api/friends/request',{'code':ac})
    incoming=a.call('/api/friends/status')['incoming']
    a.call('/api/friends/accept',{'id':incoming[0]['id']})
    ok('好友申请/接受/双向展示',len(a.call('/api/friends/status')['friends'])==1 and len(b.call('/api/friends/status')['friends'])==1)
    a.call('/api/chat/post',{'channel':'lobby','text':'多账号自动验收 '+RUN})
    msg=b.call('/api/chat?channel=lobby')['items'][-1]
    ok('聊天跨账号可见',RUN in msg['text'])
    c.call('/api/chat/report',{'channel':'lobby','id':msg['id']})
    ok('聊天举报',True)
    c.call('/api/chat/post',{'channel':'lobby','text':'https://example.test'},status=400)
    ok('聊天链接限制',True)
    waiting=a.call('/api/race/join',{'goal':100,'name':a.name})
    racing=b.call('/api/race/join',{'goal':100,'name':b.name})
    ok('单排随机匹配',waiting['mode']=='waiting' and racing['mode']=='racing')
    q=racing['question']; choice=q['options'][0]['id']
    ans=b.call('/api/race/answer',{'matchId':racing['matchId'],'index':0,'choice':choice})
    ok('单排答题反馈',ans.get('correct') in (True,False))
    a.call('/api/race/forfeit',{})
    ok('单排认输与赛果',b.call('/api/race/status')['mode']=='finished')
    room=c.call('/api/race/room/create',{'goal':100,'name':c.name,'password':'secret8'})
    d.call('/api/race/room/join',{'code':room['roomId'],'name':d.name,'password':'wrong'},status=403)
    joined=d.call('/api/race/room/join',{'code':room['roomId'],'name':d.name,'password':'secret8'})
    ok('单排密码房拒错密码且可加入',joined['mode']=='racing')
    c.call('/api/race/forfeit',{})
    ta=a.call('/api/duo/create',{'name':a.name,'password':'team8'})
    team=ta['team']['inviteCode']
    b.call('/api/duo/join',{'code':team,'name':b.name,'password':'wrong'},status=403)
    b.call('/api/duo/join',{'code':team,'name':b.name,'password':'team8'})
    ok('双排密码组队',b.call('/api/duo/status')['mode']=='ready')
    p=a.call('/api/duo/practice/start',{'goal':100})
    q=p['question']; choice=q['options'][0]['id']
    answer=b.call('/api/duo/practice/answer',{'index':0,'choice':choice})
    ok('双排协作答题同步',answer.get('correct') in (True,False) and a.call('/api/duo/status')['team']['practiceErrors']>=0)
    a.call('/api/duo/practice/stop',{})
    tc=c.call('/api/duo/create',{'name':c.name})
    d.call('/api/duo/join',{'code':tc['team']['inviteCode'],'name':d.name})
    da=a.call('/api/duo/race/join',{'goal':100})
    dc=c.call('/api/duo/race/join',{'goal':100})
    ok('双排随机2对2匹配',da['mode']=='waiting' and dc['mode']=='racing' and b.call('/api/duo/status')['mode']=='racing')
    a.call('/api/duo/race/forfeit',{})
    # New room after a finished match must be visible.
    ra=a.call('/api/duo/race/room/create',{'goal':100,'password':'race8'})
    c.call('/api/duo/race/room/join',{'code':ra['roomId'],'password':'wrong'},status=403)
    rj=c.call('/api/duo/race/room/join',{'code':ra['roomId'],'password':'race8'})
    ok('双排竞技密码房',rj['mode']=='racing')
    a.call('/api/duo/race/forfeit',{})
    a.call('/api/duo/leave',{})
    ok('解除双排',a.call('/api/duo/status')['mode']=='solo')
    plan=a.call('/api/payment/plans')
    ok('支付宝套餐与测试价',plan['channel']=='alipay' and [x['amountCents'] for x in plan['plans']]==[1,2,3])
    order=a.call('/api/payment/create',{'plan':'month'})['order']
    b.call('/api/payment/status?order='+order['orderNo'],status=404)
    ok('订单仅本人可见',a.call('/api/payment/status?order='+order['orderNo'])['order']['status']=='pending')
    a.call('/api/payment/mock-success?order='+order['orderNo'],{})
    ok('模拟支付开通会员',a.call('/api/membership')['status']=='member')
    year=b.call('/api/payment/create',{'plan':'year'})['order']
    life=c.call('/api/payment/create',{'plan':'lifetime'})['order']
    b.call('/api/payment/mock-success?order='+year['orderNo'],{})
    c.call('/api/payment/mock-success?order='+life['orderNo'],{})
    ok('年卡与永久卡权益分别生效',b.call('/api/membership')['status']=='member' and c.call('/api/membership')['status']=='lifetime')
    body,ct=multipart({'platform':'douyin'},'screenshot','qa.png',png_100())
    application=d.call('/api/applications/apply',raw=body,content_type=ct)['application']
    d.call('/api/applications/admin',status=403)
    d.call('/api/applications/review',{'id':application['id'],'decision':'approve'},status=403)
    ok('关注截图申请与普通用户隔离',len(d.call('/api/applications')['items'])==1)
    word_ids={w['word']:w['id'] for w in json.loads((pathlib.Path(__file__).resolve().parents[1]/'data/words.json').read_text())}
    b.call('/api/race/join',{'goal':100,'name':b.name})
    solo=a.call('/api/race/join',{'goal':100,'name':a.name})
    assert solo['mode']=='racing'
    for i in range(100):
        word=solo['question']['word']
        solo=a.call('/api/race/answer',{'matchId':solo['matchId'],'index':i,'choice':word_ids[word]})['state']
    ok('单排完整完赛、段位积分与系统战报',solo['mode']=='finished' and solo['won'] and solo['profile']['wins']>=1 and any(n['winner']==a.name for n in solo['notices']))
    team=a.call('/api/duo/create',{'name':a.name})['team']
    b.call('/api/duo/join',{'code':team['inviteCode'],'name':b.name})
    c.call('/api/duo/race/join',{'goal':100})
    duo=a.call('/api/duo/race/join',{'goal':100})
    assert duo['mode']=='racing'
    for i in range(100):
        actor=a if i%2==0 else b
        word=duo['question']['word']
        duo=actor.call('/api/duo/race/answer',{'matchId':duo['matchId'],'index':i,'choice':word_ids[word]})['state']
    ok('双排完整完赛、共享段位与战报',duo['mode']=='finished' and duo['won'] and duo['team']['wins']>=1 and b.call('/api/duo/status')['mode']=='finished' and len(duo['notices'])>0)
    print('TOTAL',len(checks),'checks. Admin review and booking need a promoted test account.',flush=True)

if __name__=='__main__':main()
