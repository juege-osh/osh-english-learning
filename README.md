# 英语远征

[english.osh.lol](https://english.osh.lol/) 的完整源代码。普通用户先看 [使用说明.md](使用说明.md)。

网站提供 5,000 / 10,000 / 20,000 词通用主线、逐级题型、双例句与朗读、错词补练和间隔复习。行业与考试专项是可跳过的练习池；单排、双排、好友和聊天使用服务端持久状态。学习进度先保存在浏览器，登录后也同步到账号；仍可手动导出导入。

## 本地运行

需要 Go 1.26 和 Node.js（用于前端语法检查）。

```bash
go run . --port 18999 --state-dir /tmp/english-quest-state
```

打开 `http://127.0.0.1:18999/`。服务仅监听本机地址；生产环境由 HTTPS 反向代理转发。

## 验证

```bash
go test ./...
node qa/core.test.js
node qa/progress-sync.test.js
node --check app.js
node --check features-ui.js
node --check member-ui.js
node --check chat-ui.js
```

`build_vocab.py` 与 `build_scenarios.py` 是原始数据构建脚本；`build_tracks.py` 从 ECDICT 标签生成学段与考试参考池；`build_industries.py` 使用原有核心词、词典专业标签和主题关键词扩展行业池。运行构建脚本需要原始 ECDICT CSV，路径见脚本。已生成的词库随仓库提供，正常启动不需要下载源数据。

## 站长操作

持久目录由 `--state-dir` 指定。生产环境为 `/var/lib/english-quest`，应只允许服务账号读取并定期做私密备份。目录包含账号密码哈希和登录会话、云端闯关进度、会员有效期、关注截图、预约联系信息、好友、竞技赛与聊天记录，不要提交到仓库或公开备份。

站长先在网站自行注册。随后在服务器上执行：

```bash
/opt/english-quest/english-quest-linux --state-dir /var/lib/english-quest --promote-admin 站长账号名
```

刷新免费申请页即可审核截图。站长账号支持人工通过或拒绝，每次通过增加 30 天交流权益。具体账号主页链接、微信群入口尚待站长提供。

查看预约：

```bash
/opt/english-quest/english-quest-linux --state-dir /var/lib/english-quest --list-bookings
```

确认预约：

```bash
/opt/english-quest/english-quest-linux --state-dir /var/lib/english-quest --confirm-booking '预约ID' --confirm-time '2026-10-10 19:00 北京时间'
```

该命令的输出会包含用户联系方式，只能在私密终端查看。

## 数据与使用边界

词典数据来自 ECDICT（MIT）；来源、文件校验值、筛选方法和许可见 `provenance/`。例句包含 Tatoeba 与 Simple Wiktionary 内容，页面逐句标注出处与许可。行业的 700 词是扩展练习池，并非职业资格考纲；专八高阶池也不是官方专八词表。全部 20,000 词已经过结构检查，尚未逐条完成语言编辑。

聊天对所有人可读、登录后可发言；有 10 秒慢速模式、链接限制、屏蔽、三人举报隐藏和站长隐藏。当前没有自动内容审核、账号找回邮件或完整防作弊。截图申请仅人工审核，不能自动证明真实关注。朗读由浏览器语音提供，没有口语评分。完整主线免费，不接入收费或支付。
