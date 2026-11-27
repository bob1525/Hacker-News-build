# 第六轮阶段 4：热度排序覆盖与默认策略

## 做了什么

`RANKING_BACKEND=sql` 时，Newest 和热度页一样在数据库里分页。`getFeed` 在没有搜索词时调用 `pageNewestPostIds` 或 `pageHotPostIds`，再按返回的 id 装载帖子。顺序是 `createdAt DESC, id DESC`。Ask、Show 和关注列表的过滤条件与热度 SQL 共用。

SQLite 用未加引号的列名和 `?`。PostgreSQL 用加引号的列名、`$1` 和 `COUNT(*)::int`。两种数据库都不再把 Newest 的全部候选读进 Node。

搜索没有下推。`searchRelevance` 在进程里打分：标题与整句相同加 120，标题包含整句加 40，正文包含整句加 12，标题里的每个词加 10，正文里的每个词加 3。分数相同再按热度打破平局。这些权重和短语判断若再写一份 SQL，会和 `lib/domain/search.ts` 分成两套规则。搜索已经先用 SQL 滤出包含词的帖子，排序的只是命中的集合，不是整张表。因此搜索继续走 `sortSearchResults`。

## 扩展范围

| 页面 | `memory` | `sql` |
| --- | --- | --- |
| 首页、Ask、Show、关注列表的热度 | 内存 `sortByHot` | `pageHotPostIds` |
| Newest | 内存 `sortByNewest` | `pageNewestPostIds` |
| 搜索 | 内存相关度，热度作平局 | 仍是内存相关度 |

默认 `RANKING_BACKEND` 仍是 `memory`。不设置或设成空字符串时行为与改动前相同。

## 生产环境推荐

仓库默认保持 `memory`。默认数据库还是 SQLite，本地和 SQLite CI 都走这条路径。

已经按 `POSTGRES_MIGRATION.md` 切到 PostgreSQL 的部署，推荐 `RANKING_BACKEND=sql`。热度页和 Newest 按页取 id，不再把全部帖子读进进程。SQLite 上的热度 SQL 用牛顿迭代近似 `^ 1.8`，PostgreSQL 用 `power()`。两者都有测试，但生产若仍是单个 SQLite 文件，220 篇帖子的测量里内存排序已经够快，不必为了切换而切换。

切换影响：

- 只影响服务端排序。没有数据迁移。
- 热度分数不同、或 Newest 的 `createdAt` 不同时，次序与内存实现一致。
- 热度分数和 `createdAt` 都相同，或 Newest 的 `createdAt` 相同，SQL 再按 `id` 降序。内存排序在比较结果为 0 时保留 `findMany` 的原顺序。平局的先后可能不同，同一页的 id 集合不变。
- 搜索页不变。
- 未知的 `RANKING_BACKEND` 抛出 `Unknown RANKING_BACKEND`，不会悄悄退回内存。

## 如何验证

```bash
npx vitest run tests/unit/ranking-sql.test.ts
npm run typecheck
npx vitest run
```

Newest 的两个新测试和原来的 6 个热度测试共用 `file:/tmp/hn-ranking-sql.db`。PostgreSQL 上的执行沿用阶段 2 的 job：同一测试文件会在 `ranking_sql` schema 上跑。这次提交之后的 CI 会带上这两个新测试。

## 结果证据

```text
npx vitest run tests/unit/ranking-sql.test.ts
Test Files  1 passed (1)
Tests       8 passed (8)
Start at    16:49:06
Duration    1.16s

npm run typecheck
通过

npx vitest run
Test Files  24 passed (24)
Tests       139 passed (139)
Start at    16:49:29
Duration    2.51s
```

139 = 第六轮开始时的 130 + 阶段 1 的 4 + 阶段 2 的 3 + 本阶段新增的 2。新增的 2 个是：

1. 五篇不同时间的帖子，SQL 次序等于 `sortByNewest`，最新的 `page-1` 在前。
2. 同一 `createdAt` 的两篇帖子按 id 降序，`pageSize` 为 1 时两页不重复，第一页 `hasMore` 为真，第二页为假，`total` 为 2。

## 发现的问题

- 搜索相关度的权重留在 JavaScript。SQL 只负责没有搜索词时的热度和 Newest。这是有意留下的，不是漏接。
- Newest 的平局规则比内存排序更稳定（id 降序）。内存路径没有改，避免改变默认页面的既有顺序。
