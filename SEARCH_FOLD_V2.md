# 第十轮阶段 2：ß 与 SS 使用同一套搜索折叠

## 做了什么

搜索仍然只有一个 `foldSearchText`。它先做 NFC，再 `toLowerCase`，然后把 `ß`（含大写 `ẞ` 转成的小写）展开成 `ss`，并把词尾 sigma `ς` 收成 `σ`。`searchRelevance`、分词和 SQL 用的折叠列都走这一条路径。SQL 里没有第二套相关度，也没有 `lower()`。

已经写进库里的 `titleFold` / `textFold` 如果还是旧折叠（例如 `straße`）或空字符串，`backfillSearchFolds` 会按新函数重写。新帖和种子数据在写入时就用新折叠。

## 如何验证

```bash
npx vitest run tests/unit/search-fold-v2.test.ts tests/unit/search-unicode.test.ts tests/unit/search-window.test.ts tests/unit/search-scale.test.ts tests/unit/sql-dialect.test.ts
```

## 结果证据

2026-11-27 13:13 UTC：

```text
Test Files  5 passed (5)
Tests       16 passed (16)
Start at    13:13:10
Duration    2.19s
```

新增 3 个测试：

1. `ß`、`SS`、`ss`、`Ss`、`ẞ` 都折成 `ss`。`Straße` 与 `STRASSE` 相同。`ς` 与 `Σ` 都折成 `σ`。
2. `Hello` 仍是 `hello`，`CAFÉ` 与分解形式仍相同，`ΩMEGA` 仍是 `ωmega`。`Straße` 对查询 `SS` 的相关度等于 `STRASSE` 对查询 `ß`。SQLite 和 PostgreSQL 的搜索 SQL 仍不含 `lower(`。
3. 用新折叠写入的 `STRASSE map` 能被 `SS` 搜到。旧折叠 `straße` 和空折叠 `große` 在回填之前搜不到；`backfillSearchFolds` 改写 2 行之后，查询 `ß` 命中这 3 行，其中旧行的 `titleFold` 变成 `strasse`。

原有 Unicode、搜索窗口、规模和 SQL 方言测试仍通过。

## 发现的问题

- 合字（例如 `ﬁ`）和微米符号 `µ` 还没有按 Unicode 默认 case fold 展开。这一步只补了 `ß`/`ss` 和词尾 sigma。
- 已经在库里的帖子要跑一次 `backfillSearchFolds`。种子会删掉再按新折叠重写，不会自动修一台已经有旧折叠列的线上库。
- 搜索窗口仍只给排到当前页为止的行打分。
