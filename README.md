# 英语远征

[english.osh.lol](https://english.osh.lol/) 的完整源代码。普通用户先看 [使用说明.md](使用说明.md)；准备验收时看 [验收手册.md](验收手册.md)。

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
# 另开一个终端，在独立测试数据上启动服务
ENGLISH_PAYMENT_PROVIDER=mock ENGLISH_PAYMENT_TEST_PRICES=1 go run . -port 19005 -state-dir /tmp/english-quest-full-qa-state
# 再执行多账号联机检查
python3 scripts/qa_smoke.py
```

`build_vocab.py` 与 `build_scenarios.py` 是原始数据构建脚本；`build_tracks.py` 从 ECDICT 标签生成学段与考试参考池；`build_industries.py` 将 `qa/industry_core.py` 人工挑选的前 100 词及其行业含义放在每个行业最前，再用词典专业标签和主题关键词补足扩展练习池。运行构建脚本需要原始 ECDICT CSV，路径见脚本。已生成的词库随仓库提供，正常启动不需要下载源数据。

服务启动时会把嵌入的静态文件读入一次，并预先计算 ETag。2026 年 9 月 30 日在本机用 20 个并发连接下载 40 次大词库文件，旧实现进程内存峰值约 129 MB，新实现约 37 MB；用 50 个连接下载 100 次时约 43 MB。这是本机静态文件测试，不代表正式站多人竞技的容量。

## 站长操作

持久目录由 `--state-dir` 指定。生产环境为 `/var/lib/english-quest`，应只允许服务账号读取并定期做私密备份。目录包含账号密码哈希和登录会话、云端闯关进度、会员有效期、关注截图、预约联系信息、好友、竞技赛与聊天记录，不要提交到仓库或公开备份。

生产备份定时器每天运行一次，归档放在 `/var/backups/english-quest`，只有 root 能读取。它不会自动删除旧备份；应定期检查容量并制作异地副本。恢复前先停服务，将归档解压到隔离目录核对，再覆盖状态目录并确认属主和权限。备份只是数据副本，不能代替恢复演练。

2026 年 9 月 30 日已用隔离测试数据做过一次恢复演练：备份归档通过校验，解压内容与源目录逐文件一致；从还原目录启动服务后，测试账号可以登录并读到原有学习进度。正式站的数据仍需另行做一次受控恢复演练。

站长先在网站自行注册。随后在服务器上执行：

```bash
/opt/english-quest/english-quest-linux --state-dir /var/lib/english-quest --promote-admin 站长账号名
```

刷新免费申请页即可审核截图。站长账号支持人工通过或拒绝，每次通过增加 30 天交流权益。具体账号主页链接、微信群入口尚待站长提供。

在站长账号的 **免费申请 → 连麦预约管理** 可以直接查看并确认预约。需要离线处理时，查看预约：

```bash
/opt/english-quest/english-quest-linux --state-dir /var/lib/english-quest --list-bookings
```

确认预约：

```bash
/opt/english-quest/english-quest-linux --state-dir /var/lib/english-quest --confirm-booking '预约ID' --confirm-time '2026-10-10 19:00 北京时间'
```

该命令的输出会包含用户联系方式，只能在私密终端查看。

## 数据与使用边界

词典数据来自 ECDICT（MIT）；来源、文件校验值、筛选方法和许可见 `provenance/`。例句包含 Tatoeba 与 Simple Wiktionary 内容，页面逐句标注出处与许可。主线前 1,000 词已整理简短常用中文义，每词有两句双语例句；第 501–700 词的 400 句、第 701–800 词的 108 句、第 801–900 词的 134 句，以及第 901–1000 词的 100 句按日常用法重新编写。全词库 8,916 个词至少有一句中文译文，4,995 个词两句都有译文；4,510 条链接译文经 OpenCC 转成简体并标注。行业每条路线默认练 100 个精选起步词和对应行业含义，另有 600 个待审校的扩展词供主动试练；行业每日榜只用前 100 个已核对的词出题。通用例句尚未针对行业词义逐条核对，因此行业起步词暂不显示通用例句。扩展池仍需审校，发现偏题词可跳过、反馈，也能恢复已跳过的词。行业池和专八高阶池都不是官方考纲。全部 20,000 词已经过结构检查，尚未逐条完成语言编辑。

聊天对所有人可读、登录后可发言；有 10 秒慢速模式、链接限制、屏蔽、三人举报隐藏和站长隐藏。当前没有自动内容审核、账号找回邮件或完整防作弊。截图申请仅人工审核，不能自动证明真实关注。朗读由浏览器语音提供，没有口语评分。

完整主线免费。交流权益可以通过关注截图人工审核，也预留了汇付支付宝支付。支付通道默认关闭；本机测试可设置 `ENGLISH_PAYMENT_PROVIDER=mock`，再用 `ENGLISH_PAYMENT_TEST_PRICES=1` 启用 ¥0.01 / ¥0.02 / ¥0.03 试价。真实汇付通道只在服务器安全配置齐全时启用，支付密钥与用户状态都不得提交到仓库。当前验收只覆盖本地模拟支付与签名回调测试；真实扣款、支付宝回执和线上回调需另做公开测试环境验收。
