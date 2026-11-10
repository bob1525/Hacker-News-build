# 热度排序的 SQL 后端

第五轮阶段 4 的自检。默认仍是内存排序。`RANKING_BACKEND=sql` 时，首页、Ask、Show 和 `/following` 的热度顺序改由 SQL 计算，分页规则与 `paginate` 相同。搜索和 Newest 仍在内存里排序。

## 具体做了什么

- `rankingBackend()` 读取 `RANKING_BACKEND`。空值或 `memory` 走原来的 `sortByHot`。`sql` 调用 `pageHotPostIds`。其他值抛出 `Unknown RANKING_BACKEND`。
- SQL 先按过滤条件分组计票，再按热度、`createdAt`、`id` 排序，然后 `LIMIT` / `OFFSET`。
- Prisma 自带的 SQLite 没有 `power()`。`(ageHours + 2) ^ 1.8` 写成 `x^9` 的五次方根，用 20 步牛顿迭代，只用乘法和除法。`x^1.8` 就是这个根。
- 年龄为 `(max(0, now - createdAt) / 3600000) + 2`，`createdAt` 在 SQLite 里是毫秒整数，和 `ageInHours` 的钳制一致。
- 票数是 `COUNT(PostVote.userId)`，和内存路径的 `_count.votes` 相同。
- 页码和页大小的取整与 `paginate` 相同。第 1 页从 offset 0 开始。超出末页时返回空列表，但 `total` 仍是全部候选数。

## 近似说明与可接受范围

牛顿迭代的分母相对误差，在 `ageHours + 2` 不超过 100000（大约 11 年）时约 `1e-15`。这个范围内，分数不同的帖子次序应与 JavaScript 的 `**` 一致。测试夹具都在这个范围内，次序与 `sortByHot` 相同。

分数和 `createdAt` 都相同的时候，SQL 再按 `id` 降序。内存排序在比较结果为 0 时保留 `findMany` 的原顺序，那个顺序不保证是 id。因此这种平局允许两边的先后不同，但同一页里的 id 集合必须相同，不能多也不能少。

搜索相关度没有下推。`RANKING_BACKEND=sql` 时，带搜索词的结果和 Newest 仍走内存。

## 如何验证

```bash
npx vitest run tests/unit/ranking-sql.test.ts
npm test
npm run test:e2e
```

一致性测试在临时库 `file:/tmp/hn-ranking-sql.db` 上，对照 `sortByHot`。

## 一致性测试结果

`tests/unit/ranking-sql.test.ts` 6 个测试通过：

| 测试 | 结果 |
| --- | --- |
| 新帖与同票旧帖 | SQL 次序等于内存次序，新帖在前 |
| 高票旧帖与较新的一票帖 | SQL 次序等于内存次序，高票旧帖在前 |
| 零票与同年龄的一票 | SQL 次序等于内存次序，一票在前 |
| 相同分数 | id 集合相同；SQL 按 id 降序 |
| 分页边界 | 5 篇、每页 2 条，三页拼起来等于内存全序，没有重复或遗漏，最后一页 `hasMore` 为 false |
| 切换 | 默认 `memory`，`sql` 选中 SQL，`postgres` 抛出未知后端错误 |

## 和内存实现的对比

| | memory | sql |
| --- | --- | --- |
| 默认 | 是 | `RANKING_BACKEND=sql` |
| 热度公式 | JavaScript `** 1.8` | 20 步牛顿迭代，范围内与 `**` 的相对误差约 `1e-15` |
| 平局 | 较新的 `createdAt` 在前；时间也相同则保持查询原序 | 较新的在前，再按 `id` 降序 |
| 分页 | 先取全部候选再切片 | `LIMIT` / `OFFSET`，页码规则相同 |
| 搜索、Newest | 内存 | 仍是内存 |
| 数据量 | 每次把候选行读进 Node | 数据库只返回当前页的 id，再按 id 取这一页的作者和票数 |

## 性能对比思路

[SCALE_TEST.md](SCALE_TEST.md) 在 220 篇帖子、1100 条评论上测过内存路径：帖子查询 4.0 ms，首页五次中位数 13.3 ms。那次没有 SQL 排序。

对比两种后端可以用同一套方法：

1. 用 `npx tsx scripts/scale-bench.ts` 准备 `/tmp/hn-scale.db`，不要改开发库。
2. 对同一 `DATABASE_URL` 各跑几次 `getFeed({ sort: "hot", page: 1 })`，一次 `RANKING_BACKEND=memory`，一次 `RANKING_BACKEND=sql`。先各丢弃一轮，再取中位数。
3. 同时看返回的前 30 个 id 是否一致。平局只比较 id 集合。
4. 220 篇上的内存查询是 4.0 ms。SQL 路径多一段递归 CTE，在这个量级上可能更慢；它要解决的是候选集到几千、几万篇时不再把整表送进 Node。线性外推见 [RANKING_SCALABILITY.md](RANKING_SCALABILITY.md)。这次没有重跑 220 篇的计时。

## 剩余工作量与风险

已经接上的是热度分页这一条读路径。还没做的是：

- 搜索相关度仍在应用里。
- Newest 可以直接 `ORDER BY createdAt`，但现在没有改。
- PostgreSQL 有 `power()`，可以换成真正的幂，而不用牛顿迭代。当前表达式在两边都能跑，因为只用乘除。
- 分数没有物化列，深页的 `OFFSET` 仍会扫过被跳过的行。
- 递归 CTE 对每一行做 20 步。帖子到几万时，要和「取回全部再在内存排」重新比一次，再决定要不要物化 `hotScore`。

风险：牛顿迭代在 `ageHours + 2` 远大于 100000 时可能和 `**` 差到改变相邻名次。社区帖子的年龄通常远小于这个界限。平局时 id 次序和内存原序可能不同，页面不会丢帖。

## 发现的问题与处理方式

- Prisma 的 SQLite 没有 `power()`、`sqrt()` 或 `ln()`。`node:sqlite` 有 `power()`，但不能拿来当 Prisma 查询的依据。因此用牛顿迭代，并在文档里写明误差范围。
- 全量端到端第一次跑时，注册后的退出有一次 15 秒超时，页面快照仍显示已登录。同一套命令再跑一遍是 23 passed。该流程不经过热度排序。默认后端仍是内存。

## 全量结果

```text
eslint        通过
typecheck     通过
vitest        Test Files  22 passed (22)
              Tests       130 passed (130)
playwright    23 passed
```

130 = 阶段 2 结束时的 124 + 本阶段新增的 6。端到端 23 是第二次完整运行的结果。
