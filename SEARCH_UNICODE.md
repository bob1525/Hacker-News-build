# 第九轮阶段 3：搜索的非 ASCII 大小写

## 做了什么

搜索只保留一套大小写折叠：`foldSearchText`，也就是 NFC 之后再 `toLowerCase`。`tokenize`、`searchRelevance` 和搜索特征都用它。相关度公式没有第二份，SQL 里不计算分数。

帖子写入 `titleFold` 和 `textFold`。发帖和种子数据在写入时就算好。SQL 候选筛选和搜索窗口分组直接比较这两列，不再调用 `lower()`。因此 SQLite 只折叠 ASCII 的 `lower()` 和 PostgreSQL 按区域设置折叠的 `lower()` 不再和 JavaScript 各算各的。

旧行的两列默认是空字符串，搜索会漏掉。`backfillSearchFolds` 用同一个函数把它们补上。

SQLite 迁移是 `prisma/migrations/20261127150000_search_fold/migration.sql`。PostgreSQL 追加 `prisma/migrations-postgres/0006_search_fold.sql`，语句与 provider 改成 postgresql 后的 `prisma migrate diff` 一致。

`tests/unit/sql-dialect.test.ts` 仍逐字检查搜索谓词，期望从 `lower(title)` 改成 `titleFold`。这是谓词本身换了，不是把断言放宽。

## 如何验证

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code --script
npx vitest run tests/unit/search-unicode.test.ts tests/unit/search.test.ts tests/unit/search-window.test.ts tests/unit/search-scale.test.ts tests/unit/sql-dialect.test.ts
npx eslint lib/domain/search.ts lib/domain/search-fold.ts lib/domain/search-window.ts lib/domain/search-sql.ts lib/sql-dialect.ts lib/search-fold-db.ts lib/actions/posts.ts tests/unit/search-unicode.test.ts tests/unit/search-scale.test.ts tests/unit/search-window.test.ts tests/unit/sql-dialect.test.ts
npx tsc --noEmit
```

## 结果证据

2026-11-27 12:40 UTC：

```text
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code
-- This is an empty migration.
sqlite-diff:0

npx vitest run tests/unit/search-unicode.test.ts tests/unit/search.test.ts tests/unit/search-window.test.ts tests/unit/search-scale.test.ts tests/unit/sql-dialect.test.ts
Test Files  5 passed (5)
Tests       16 passed (16)
Start at    12:40:16
Duration    1.37s

npx eslint …通过
npx tsc --noEmit
通过
```

原有搜索、搜索窗口、候选预筛选和 SQL 方言测试仍通过。本阶段新增 3 个：

1. `CAFÉ` 和分解的 `café` 折成同一串。`ΩMEGA` 和 `ωmega` 也一样。两边的 `searchRelevance` 相等，标题命中高于正文命中。
2. SQLite 和 PostgreSQL 的搜索 SQL 都读 `titleFold`，字符串里没有 `lower(`。
3. 已写入折叠列的 `CAFÉ menu` 能用分解形式的查询找到，正文「笔记」也能找到。没有折叠列的 `ΩMEGA` 先搜不到，`backfillSearchFolds` 补上 1 行之后能搜到。

## 发现的问题

- 已经在库里的帖子要跑一次 `backfillSearchFolds`，否则折叠列是空的，非 ASCII 和普通搜索都会漏。新发的帖子和种子数据会自己写上。
- 折叠是 JavaScript 的 NFC 加 `toLowerCase`，不是 Unicode 完整 case fold。`ß` 和 `SS` 仍然不相等，SQL 和进程内倒是同一结果。
- 本机没有 PostgreSQL。`0006_search_fold.sql` 留在 CI 的空库任务里执行。
