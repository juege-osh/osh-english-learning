# 联机验收脚本

在独立的本机测试服务上运行 `python3 scripts/qa_smoke.py`。脚本会创建临时测试账号，请勿对正式站运行。

## macOS 持久预览

先在本机编译，再安装到登录自动启动的预览服务：

```sh
mkdir -p state
go build -o state/english-quest-preview .
python3 scripts/install_preview_macos.py state/english-quest-preview
```

预览地址为 http://127.0.0.1:19004/，只使用模拟支付。程序、状态和日志保存于当前用户的 `~/Library/Application Support/EnglishQuestPreview/`，不再依赖重启可能清空的临时目录。安装时保留已有预览状态和上一个程序，不复制正式站账号。LaunchAgent 为 `~/Library/LaunchAgents/com.osh.english-preview.plist`。只有登录这个 macOS 用户之后才会自动启动。

状态包含测试账号与会话，禁止上传到仓库。后续验收证据保存在项目内已忽略的 `state/evidence-v<版本>/`。2026年10月2日重启前放在 `/tmp` 的旧预览状态与验收文件已丢失；历史说明中的这些路径仅作当时记录，不再表示文件仍存在。
