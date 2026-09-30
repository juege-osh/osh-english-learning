# 词库数据

主线词库、例句、场景和行业专项数据保存在本目录。来源、许可及生成方式见上级目录 provenance/ 和项目说明。

前 900 个主线词有简短中文义和两句双语例句；第 701–800 词有 46 个、第 801–900 词有 33 个仍沿用语料原句，尚待逐句审读。重建词库后依次运行 `qa/curate_first500_glosses.py`、`qa/curate_next200_glosses.py --apply`、`qa/curate_next100_glosses.py --apply`、`qa/curate_next100_glosses_801_900.py --apply`；例句的第 501–700 词由 `qa/curate_next200_examples.py --apply` 恢复，第 701–800 词中缺中文或不合适的句子由 `qa/curate_701_800_example_gaps.py --apply` 恢复，第 801–900 词由 `qa/curate_801_900_example_gaps.py --apply` 恢复。原词典释义仍保存在每条词的 `full` 字段。第 501–700 词的可编辑句子分别存于两份 `curated_examples_*.tsv`。

第 847 词 `de` 是词频源混入的外语连接词，并非常用英语独立单词。当前只修正了展示释义和例句；正式发布前应替换该词，同时处理按词编号保存的既有进度，避免把原进度误记到新词上。
