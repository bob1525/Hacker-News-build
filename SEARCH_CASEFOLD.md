# 第十一轮阶段 3：补上仍缺的全大小写折叠

## 做了什么

`foldSearchText` 仍是唯一的折叠。在 `toLowerCase` 之前补上它不改写的常见项：

- 合字 `ﬀ→ff`、`ﬁ→fi`、`ﬂ→fl`、`ﬃ→ffi`、`ﬄ→ffl`、`ﬅ→st`、`ﬆ→st`
- 微米符号 `µ`（U+00B5）→ 希腊字母 `μ`（U+03BC）
- 长 s `ſ` → `s`
- 开尔文符号 `K` → `k`，埃符号 `Å` → `å`。当前 Node 的 `toLowerCase` 已经会改这两个，函数里仍显式映射，不依赖引擎。

`ß→ss` 和 `ς→σ` 保持原样。SQL 仍只比较存好的 `titleFold` / `textFold`，没有第二份相关度，也没有 `lower()`。`backfillSearchFolds` 发现旧折叠和现在的 `foldSearchText` 不一致就重写。

## 怎么验证

```bash
npx vitest run tests/unit/search-casefold.test.ts tests/unit/search-fold-v2.test.ts tests/unit/search-unicode.test.ts
npx eslint lib/domain/search-fold.ts tests/unit/search-casefold.test.ts
```

## 证据

2026-11-27 17:50 UTC：

```text
npx vitest run tests/unit/search-casefold.test.ts tests/unit/search-fold-v2.test.ts tests/unit/search-unicode.test.ts
Test Files  3 passed (3)
Tests       8 passed (8)
Start at    17:50:15
Duration    1.22s

npx eslint …通过
```

新增 2 个测试：

1. 合字、微米符号、开尔文、埃号和长 s 都在 `foldSearchText` 里对齐；`ß` / `ẞ` / `ς` / `Σ` 仍得到 `ss` / `σ`。`ﬁle` 和 `file` 的相关度相同且大于 0。SQLite 和 PostgreSQL 的搜索 SQL 都不含 `lower(`，也不含这些字符的折叠。
2. 旧折叠 `ﬁle` 和空的 `10µm` 在回填前搜不到对应的新折叠；`backfillSearchFolds` 改写 2 行之后，`file` 命中合字帖，`μm` 命中微米帖。

原有 `search-fold-v2` 的 3 个 `ß` / `ς` 测试和 `search-unicode` 的 3 个测试没有改断言，仍然通过。没有新的数据库迁移。

## 发现的问题

- 搜索词至少要 2 个字符。单独的 `µ` 会被丢掉，所以相关度测试用的是 `μm`。折叠本身把单个 `µ` 收成 `μ`。
- 希腊语里带分音和重音的 `ΐ` / `ΰ` 这次没有展开。它们比合字少见，留在折叠函数外。
