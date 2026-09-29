# 测试与构建辅助脚本

此目录包含前端逻辑测试及词库例句构建辅助脚本。

`curate_starter_examples.py` 是前100词双语句子的人工编辑层。重新构建整份例句数据时，最后运行它，避免新手句被自动构建结果覆盖。

`augment_bilingual_examples.py` 使用已下载的 Tatoeba 英中句子和关联表，从短句候选中优先选择有译文的例句。先不带参数运行并抽查结果；确认后加 `--apply`。最后再运行 `curate_starter_examples.py`，保留新手句。
