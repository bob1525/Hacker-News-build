# 第八轮阶段 2：反对票

## 做了什么

登录用户可以给帖子和评论投反对票。同一行 `PostVote` / `CommentVote` 用 `value` 表示方向：`1` 是赞成，`-1` 是反对。再点同一方向会删掉这一票，点另一方向会改成那一方向。旧的赞成调用不传方向，仍然是赞成。

显示出来的点数是 `value` 的合计，可以是负数。热度公式仍是 `(points - 1) / (ageHours + 2) ^ 1.8`。`hotScore` 本来就把点数压到不小于 0，`ranking-hand` 里 `hotScore(-8, 0)` 等于 `hotScore(0, 0)` 的断言还在。内存排序继续用这个函数。SQLite 用 `MAX(COALESCE(SUM(value), 0), 0)`，PostgreSQL 用 `GREATEST(COALESCE(SUM(value), 0), 0)`，所以两边都不会让负分排到 0 分下面。赞成把点数从 2 拉到 1，或从 1 拉到 0 时，名次会下降。

反对票和赞成票共用 `vote` 限流。反对需要别人给过至少 `DOWNVOTE_MIN_KARMA`（1）的业力。赞成没有这道门槛。不能给自己的帖子或评论投票，也不能给已删除的评论投票。业力仍走 `computeKarma`，每一侧先压到不小于 0，所以净反对不会把业力打成负数。`computeKarma(-3, 2) === 2` 没有改。

SQLite 迁移是 `prisma/migrations/20261127130000_vote_value/migration.sql`。PostgreSQL 追加 `prisma/migrations-postgres/0004_vote_value.sql`，空库按文件名排在 `0003` 后面。已有票的 `value` 默认是 1，所以只有赞成票时合计仍等于旧的票数。

`tests/e2e/votes.spec.ts` 里分数先变化 1 再回到原值、以及自己的帖子没有投票按钮，这两个断言没改。定位从「标题里任意按钮」收成赞成按钮的名字，因为旁边多了一个反对按钮。

## 如何验证

```bash
DATABASE_URL="file:./dev.db" npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code --script
npx tsc --noEmit
npx vitest run
npm run test:e2e
npx eslint lib/voting.ts lib/actions/votes.ts lib/queries.ts lib/domain/downvotes.ts lib/domain/ranking-sql.ts components/vote-button.tsx components/post-row.tsx components/comment-thread.tsx tests/unit/downvotes.test.ts
```

PostgreSQL 的 `ALTER TABLE` 来自 `prisma migrate diff --from-schema-datamodel --to-schema-datamodel --script`。本机没有 PostgreSQL，空库执行留在 CI 的 `postgres` job。

## 结果证据

SQLite 迁移差异是空的（exit 0）。

```text
npx vitest run
Test Files  29 passed | 1 skipped (30)
Tests       162 passed | 1 skipped (163)
Start at    11:15:20
Duration    4.92s

npm run test:e2e
23 passed (34.3s)
```

跳过的仍是没有 `REDIS_INTEGRATION=1` 的真实 Redis 测试。阶段 1 之后是 155 个通过。本阶段新增 7 个，合计 162。原有排名、业力和并发测试仍通过。`npx tsc --noEmit` 和上面的 eslint 通过。

新增的 7 个测试：

1. 同一方向取消，相反方向切换。
2. 自己的内容、业力不足、已删除评论会被拒绝；业力达到 1 可以通过。
3. `hotScore(-1)` 仍等于 `hotScore(0)`，`hotScore(2)` 高于 `hotScore(1)`。
4. 赞成仍然可以打开再关掉，点数是 1 然后 0。
5. 反对把点数降到 -1，再点一次回到 0。
6. 两张赞成票的业力是 2；其中一张改成反对后合计是 0。评论反对票把评论点数降到 -1。
7. SQL 热榜把净 1 分排在互相抵消的帖子前面。净负分和 0 分分数相同，按 id 倒序打破平局。

## 发现的问题

- 已经是 0 分的帖子再被反对，显示点数会变成负数，但热榜不会排到另一条 0 分帖子下面。这是现有 `hotScore` 下限，不是新公式。
- 业力每一侧先压到 0，净反对不会出现负业力。
- 新账号在别人赞成自己的帖子或评论之前不能反对。测试里用另一位用户投一张赞成票来达到门槛。
- `0004_vote_value.sql` 还没有在本机空 PostgreSQL 上执行。
