# 热度排序的数据量

第四轮阶段 4 的自检。没有改排序代码。说明现在的做法能撑到什么量级，以及以后把公式下推到 SQL 时要动哪里。

## 做了什么

对照 `getFeed` 和 [SCALE_TEST.md](SCALE_TEST.md) 的实测，写下当前性能特征、SQL 排序草案，以及改动范围和风险。

## 当前实现的性能特征

`lib/queries.ts` 的 `getFeed` 对首页、Ask、Show、Newest 和 `/following` 使用同一次取数：

1. `prisma.post.findMany` 取出全部符合过滤条件的帖子，并带上作者和票数。
2. 没有搜索词时，热度用 `sortByHot`，最新用 `sortByNewest`。搜索词走 `sortSearchResults`。
3. `paginate` 在已经排好的数组上切片，每页 30 条。第 1 页是前 30 条，每条帖子最多出现在一页里。

热度公式在 `lib/domain/ranking.ts`：

```text
ageHours = max(0, (now - createdAt) / 3_600_000)
score = (points - 1) / (ageHours + 2) ^ 1.8
```

`points` 是 `PostVote` 的行数。分数相同则较新的 `createdAt` 在前。

[SCALE_TEST.md](SCALE_TEST.md) 在 25 个用户、220 篇帖子、1100 条评论上量过，库在本机 `/tmp/hn-scale.db`：

| 操作 | 结果 |
| --- | --- |
| 首页用的帖子查询（含作者和计数） | 4.0 ms |
| `scalefinder` 搜索 | 1.5 ms |
| `scale00` 的用户、帖子、评论查询 | 2.2 ms |
| `/` 五次中位数 | 13.3 ms（样本 13.1, 17.2, 13.3, 13.7, 12.4） |
| `/search?q=scalefinder` 五次中位数 | 10.4 ms |
| `/user/scale00` 五次中位数 | 13.5 ms |

这次测量没有改查询。220 篇全部放进内存再排序，查询本身只有几毫秒。

上限只能从这次测量外推，不能当成新的实测。若帖子查询随行数线性增长，大约是 `4.0 ms * (帖子数 / 220)`：

| 帖子数 | 只外推查询时间 |
| --- | --- |
| 220 | 4 ms（实测） |
| 2,000 | 约 36 ms |
| 10,000 | 约 180 ms |
| 50,000 | 约 0.9 s |

外推没算更大的 JSON、投票连接和排序。当前设计的硬条件是：每次请求都把候选行读进 Node，再排序。几千篇仍然合适。到一万篇以上，查询和响应体都会离开现在的十几毫秒，应该先把热度排序下推，而不是继续把整表取回来。页面中位数在 220 篇时是 13.3 ms，其中大部分不是排序本身。

## 数据库排序的方案

热度路径改成在 SQL 里算同一公式，并用 `LIMIT` / `OFFSET` 代替内存切片。`page` 从 1 开始，`pageSize` 为 30 时，`OFFSET` 是 `(page - 1) * 30`。总条数另做一次 `COUNT`，用来填 `hasMore` 和 `total`，语义与 `paginate` 相同。

下面是 PostgreSQL 形态的草案。`points` 必须是投票行数，和现在的 `_count.votes` 一致。年龄为负时按 0，和 `ageInHours` 一致。次序是分数降序，然后 `createdAt` 降序。

```sql
SELECT p.id,
       COUNT(v."userId") AS points
FROM "Post" AS p
LEFT JOIN "PostVote" AS v ON v."postId" = p.id
WHERE /* ask / show / following / search ids */
GROUP BY p.id
ORDER BY (
    (COUNT(v."userId") - 1)::float
    / power(GREATEST(EXTRACT(EPOCH FROM ($now - p."createdAt")) / 3600.0, 0) + 2, 1.8)
  ) DESC,
  p."createdAt" DESC,
  p.id DESC
LIMIT 30 OFFSET 0;
```

SQLite 可以用 `julianday` 或传入的毫秒时间戳代替 `EXTRACT`。Newest 不需要这个表达式，直接 `ORDER BY createdAt DESC`。搜索仍然先算相关度；相关度现在在应用里，不能只靠这条热度 SQL。

分页配合方式：

```text
offset = (page - 1) * pageSize
rows = query(limit = pageSize, offset = offset)
total = count(same filters)
hasMore = offset + pageSize < total
```

`OFFSET` 很大时会变慢，而且两次请求之间如果有新帖，翻页可能重或漏。现在的内存切片也是每次重新取全表，跨请求同样会动。第一版 SQL 保持这个行为即可。稳定的 keyset 分页要有不变的排序键；热度随时间变，不适合做游标，除非先把分数物化。

物化是第二步，不是第一版：定时把 `hotScore` 写回一列并加索引，查询变成 `ORDER BY hotScore DESC, createdAt DESC`。代价是分数有刷新延迟。

伪代码：

```text
if sort == newest:
  return sql order by createdAt desc limit pageSize offset ...
if query is not empty:
  keep the current in-memory relevance sort
else:
  return sql order by hotScore desc, createdAt desc limit pageSize offset ...
assert the SQL order matches sortByHot on a fixed fixture
```

## 预计工作量与风险

工作集中在 `getFeed` 的热度分支：一条分组查询、一次计数、以及用固定 `now` 对照 `sortByHot` 的测试。Newest、搜索相关度和评论树排序可以不动。不需要新的服务或新的表，除非后来做物化列。

风险：

- JavaScript 的 `**` 和 SQL 的 `power` 在边界上可能差一个末位。测试应比较次序，不要比较分数字符串。
- `GROUP BY` 写错会把一票算成多行，次序就会和现在的 `points` 不一致。
- `OFFSET` 深页在大表上会扫描被跳过的行。万级以后若深页变慢，再考虑物化分数，而不是一开始就加刷新任务。
- 物化分数会过期。未刷新时，刚投的票不会立刻改变首页位置。
- 这件事要在 PostgreSQL 上才有多实例意义。SQLite 上只是少传一些行，写者限制还在。见 [DB_MIGRATION.md](DB_MIGRATION.md)。

## 验证方法

本阶段没有改代码。核对的是文档里的数字和代码路径：

```bash
rg -n "4\\.0 ms|13\\.3 ms" SCALE_TEST.md
rg -n "sortByHot|paginate" lib/queries.ts lib/domain/ranking.ts
```

## 结果证据

- `SCALE_TEST.md` 中的查询时间是 4.0 ms、1.5 ms、2.2 ms，页面中位数是 13.3 ms、10.4 ms、13.5 ms。
- `getFeed` 在第 119 行调用 `sortByHot`，第 121 行调用 `paginate`。
- 没有新增测试，也没有改排序实现。阶段 2 的全量结果仍然是 117 个单元测试和 23 个端到端测试通过。

## 发现的问题

- 实测只覆盖 220 篇。任何更大的数字都是线性外推，不能写成已经测过。
- 搜索排序和评论树也在进程内，但不在首页热度这条路径上。下推热度不会自动让搜索变快。
