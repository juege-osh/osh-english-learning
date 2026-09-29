# 测试与构建辅助脚本

此目录包含前端逻辑测试及词库例句构建辅助脚本。

`curate_starter_examples.py` 是前100词双语句子的人工编辑层。重新构建整份例句数据时，在补全和简体转换后运行它，再运行 `curate_first500_examples.py`，确保前500词都有两句双语例句。最后运行 `curate_common_examples.py`，替换其中重复、拗口或不适合日常学习的句子；顺序不要颠倒。

`augment_bilingual_examples.py` 使用已下载的 Tatoeba 英中句子和关联表，从短句候选中优先选择有译文的例句。先不带参数运行并抽查结果；确认后加 `--apply`。完成语料补全及简体转换后，再执行上述三层人工编辑脚本。

完成语料补全后，可安装 `opencc==1.1.9`，运行 `normalize_translations.py` 预览繁转简数量，再用 `--apply` 写回。[OpenCC](https://github.com/BYVoid/OpenCC) 采用 Apache-2.0 许可；这里只在构建时使用，没有把其程序或词典打包进网站。已转换的句子带 `translationAdapted` 标记，页面显示“简体转换”并保留原译文链接。

`curate_first500_glosses.py` 在 `build_vocab.py` 后运行，为第101–500词补上简短常用中文义，并保留ECDICT原释义供展开查看。重新生成 `data/words.json` 后必须重跑它。
