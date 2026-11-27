# 第七轮阶段 2：搜索可扩展性

## 做了什么

搜索不再把每个命中的帖子连同作者、评论数、投票和收藏一起读进内存再打分。步骤是：

1. SQL 预过滤。`searchPostSql` 要求每个词都出现在标题或正文里。没命中的帖子不会进入打分。
2. 只读取候选的 `id`、`title`、`text`、`createdAt` 和票数。
3. 用现有的 `searchRelevance` 排序。`sortSearchResults` 仍是唯一的打分规则：标题全等 120，标题含整句 40，正文含整句 12，标题单词 10，正文单词 3，然后用热度打破平局。没有第二套分数。
4. `pageSearchResults` 再分页。相关度和热度都相同则按 `id` 降序，所以同一页不会因读取顺序变化而换人。
5. 只为当前页装载完整卡片。Ask、Show 和关注列表的过滤在打分前应用到候选集，和原来的 `feedWhere` 一样。

## 与全量打分的对比

| | 改动前 | 改动后 |
| --- | --- | --- |
| 谁进入打分 | SQL 命中的全部帖子 | 同一条 SQL 预过滤后的候选 |
| 打分读什么 | 作者、评论数、当前用户的投票和收藏 | 标题、正文、时间、票数 |
| 完整行 | 每个命中都装载 | 只有当前页，最多 30 条 |
| 分数 | `searchRelevance` | 同一个 `searchRelevance` |
| 平局 | 热度相同则保留读取顺序 | 热度相同再按 `id` 降序 |

预过滤没有改匹配条件。一个词仍要出现在标题或正文，多个词要同时命中。相关度高但正文很长的帖子不会因为 LIMIT 被提前丢掉，因为分页发生在打分之后。

## 如何验证

```bash
npx vitest run tests/unit/search.test.ts tests/unit/search-scale.test.ts
npx eslint lib/domain/search.ts lib/queries.ts tests/unit/search-scale.test.ts
```

预过滤测试在 `file:/tmp/hn-search.db` 上执行 `searchPostSql`。分页测试不连库。

## 结果证据

```text
npx vitest run tests/unit/search.test.ts tests/unit/search-scale.test.ts
Test Files  2 passed (2)
Tests       6 passed (6)
Start at    09:57:15
Duration    1.08s

npx tsc --noEmit
通过

npx eslint lib/domain/search.ts lib/queries.ts tests/unit/search-scale.test.ts tests/helpers/database.ts
通过
```

原有 3 个搜索测试仍通过。本阶段新增 3 个：

1. `sqlite wal` 只留下标题里两个词都有的帖子；`sqlite` 留下标题和正文命中，不留下无关帖。
2. 5 篇候选、每页 2 条，三页拼起来是 `page-0` 到 `page-4`，没有重复或遗漏。第 4 页为空，`total` 仍是 5。
3. 相关度和热度都相同的两篇帖子按 `id` 降序，`b` 在 `a` 前。

## 发现的问题

- 打分仍然要把候选的标题和正文读进进程。`searchRelevance` 的短语和权重没有下推，避免第二套规则。候选集已经是词过滤之后的集合，不是整张表。
- 票数仍要按候选计数，用来做热度平局。这一步比装载评论和收藏轻，但候选很多时仍会读这些行。
- 端到端搜索仍走默认 SQLite。本阶段没有改端到端断言。
