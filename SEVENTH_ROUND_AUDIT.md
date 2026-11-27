# 第七轮审计

本轮仍在分支 `cursor/hacker-news-community-1102` 上，对应 [PR #1](https://github.com/bob1525/Hacker-News-build/pull/1)。没有新开仓库，没有重写历史，没有 force push，没有删除或放宽已有测试。默认业务库仍是 SQLite，默认限流仍是内存。没有加邮箱验证或反对票，评论最大层数仍是 8。

改动针对第六轮审计里还能在这些限制下处理的四件事：PostgreSQL 迁移 SQL 没有在空库执行、搜索把命中行全量装进内存打分、评论折叠只在 `sessionStorage`、`next dev` 在密钥不合格时父进程可能以 0 结束。

## 开工前的测试

2026-11-27 09:50 UTC，头提交 `67576525d698f476658db6e330d2297ea329ff09`：

```text
npx vitest run
Test Files  24 passed (24)
Tests       139 passed (139)
Start at    09:50:56
Duration    2.85s

npm run test:e2e
23 passed (40.9s)
```

这 139 个单元测试和 23 个端到端测试都还在。本轮新增 10 个单元测试。默认 `npm test` 跑其中 9 个，另 1 个只在设置了 `REDIS_INTEGRATION=1` 时连真实 Redis。

## 阶段完成情况

| 阶段 | 自检文档 | 提交 | 新增测试 |
| --- | --- | --- | --- |
| 1 空库执行 PostgreSQL 迁移 | [POSTGRES_MIGRATE_APPLY.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/POSTGRES_MIGRATE_APPLY.md) | `6064a4b7f94bfbd11e014acd50539ed0e34395fb`、`6f536d9a140cfb93f8fcf05078b69482bc61f300` | 0 |
| 2 搜索可扩展性 | [SEARCH_SCALE.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/SEARCH_SCALE.md) | `24892f1a5606356a0193b757efdfc640a43553c0` | 3 |
| 3 评论折叠持久化 | [COMMENT_COLLAPSE.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/COMMENT_COLLAPSE.md) | `7528da037f4cdae8b12b90fa4b51f98bc3f014d1` | 4 |
| 4 生产配置与启动校验 | [PRODUCTION_DEFAULTS.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/PRODUCTION_DEFAULTS.md) | `41a860fc75a80964a2cf6978936c1543ff734992`、`db40895b82595d069cec2f3d917346692ccf035b` | 3 |
| 5 本审计 | [SEVENTH_ROUND_AUDIT.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/SEVENTH_ROUND_AUDIT.md) | `d2a18ec2461b7c2910eefaeda199ba42d370bdff` 与记录该次 CI 的后续提交 | 0 |

### 阶段 1

`postgres` job 用 `psql` 在空 schema 上按文件名执行 `prisma/migrations-postgres/*.sql`，再用 `prisma migrate diff --from-url --to-schema-datamodel --exit-code` 对照数据模型。不再用 `db push` 当迁移证据。SQLite 的 `test` job 保留。阶段 1 当时只有 `0001_init.sql`。阶段 3 追加 `0002_comment_collapse.sql` 后，同一脚本会按顺序执行两份。运行 [45977501868](https://github.com/bob1525/Hacker-News-build/actions/runs/45977501868) 的 `postgres` job 漂移检查通过。新增测试 0。

### 阶段 2

搜索先用 SQL 筛出每个词都出现在标题或正文的候选，只读取打分需要的字段，再用现有的 `searchRelevance` 排序和分页，然后只装载当前页。没有第二套分数。平局在热度之后按 `id` 降序。候选集本身仍在进程内打分。新增 3 个测试。

### 阶段 3

`CommentCollapse` 按用户保存折叠。已登录用户关闭浏览器或换设备后仍读数据库。未登录用户继续用 `sessionStorage`。SQLite 迁移是 `20261127100000_comment_collapse`，PostgreSQL 是追加的 `0002_comment_collapse.sql`。评论最大层数仍是 8。新增 4 个测试。

### 阶段 4

`npm run dev` 加载 `scripts/next-dev-exit.cjs`。工作进程因 `AUTH_SECRET` 不合格以 1 退出时，父进程不再改成 0。直接执行 `npx next dev` 不会加载这个钩子。生产建议是 PostgreSQL、`RATE_LIMIT_BACKEND=redis`、`RANKING_BACKEND=sql`。本地默认仍是 SQLite 和内存，因为没有 Redis 时 Redis 限流会拒绝写入，而且提交的 schema 仍是 SQLite。

独立的 `redis` job 使用 `redis:7`。第一次运行 [45978671119](https://github.com/bob1525/Hacker-News-build/actions/runs/45978671119) 里这个 job 失败：两个连接用了不同的键前缀，所以放行了 4 次而不是 2 次。`postgres` 和 `test` 在那次运行里是成功的。前缀改成同一个之后，运行 [45979073383](https://github.com/bob1525/Hacker-News-build/actions/runs/45979073383) 的 `redis` job 为 `1 passed`。新增 3 个测试，其中真实 Redis 那条在默认套件里跳过。

## 最终验证

阶段 5 提交前在本机执行。端到端跑在应用代码上，随后的 Redis 前缀修改只影响默认跳过的测试：

```text
npm run lint
通过

npm run typecheck
通过

npx vitest run
Test Files  27 passed | 1 skipped (28)
Tests       148 passed | 1 skipped (149)
Start at    10:07:38
Duration    4.04s

npm run test:e2e
23 passed (31.8s)
```

148 = 开工前的 139 + 本轮默认会跑的 9。跳过的 1 个是真实 Redis 测试。23 个端到端测试没有增删。原有断言没有放宽。

包含全部代码改动的 push 运行 [45979073383](https://github.com/bob1525/Hacker-News-build/actions/runs/45979073383) 结论 success：

| job | 结果 | 时间 |
| --- | --- | --- |
| `redis` [140438073984](https://github.com/bob1525/Hacker-News-build/actions/runs/45979073383/job/140438073984) | success | 2026-11-27 10:05:08Z 到 10:05:56Z |
| `postgres` [140438074539](https://github.com/bob1525/Hacker-News-build/actions/runs/45979073383/job/140438074539) | success | 2026-11-27 10:05:08Z 到 10:06:16Z |
| `test` [140438074261](https://github.com/bob1525/Hacker-News-build/actions/runs/45979073383/job/140438074261) | success | 2026-11-27 10:05:08Z 到 10:07:19Z |

`postgres` 对空 schema `public` 执行迁移 SQL，漂移检查通过，随后 `ranking_sql`、`collapse`、`search`、`concurrency` 也通过。单元测试 `148 passed | 1 skipped`。`test` job 同样是 `148 passed | 1 skipped`，端到端 `23 passed (1.0m)`。`redis` job 对 `redis:7` 执行 `tests/unit/rate-limit-redis-live.test.ts`，`1 passed`。Node.js 20 弃用提示没有让 job 失败。

审计提交 `d2a18ec2461b7c2910eefaeda199ba42d370bdff` 的 push 运行 [45979520726](https://github.com/bob1525/Hacker-News-build/actions/runs/45979520726) 结论 success：

| job | 结果 | 时间 |
| --- | --- | --- |
| `postgres` [140439558932](https://github.com/bob1525/Hacker-News-build/actions/runs/45979520726/job/140439558932) | success | 2026-11-27 10:08:12Z 到 10:09:58Z，约 1 分 46 秒 |
| `test` [140439559358](https://github.com/bob1525/Hacker-News-build/actions/runs/45979520726/job/140439559358) | success | 2026-11-27 10:08:13Z 到 10:10:16Z，约 2 分 3 秒 |
| `redis` [140439559438](https://github.com/bob1525/Hacker-News-build/actions/runs/45979520726/job/140439559438) | success | 2026-11-27 10:08:13Z 到 10:09:03Z，约 50 秒 |

`postgres` 再次对空 schema `public` 做漂移检查并通过，单元测试 `148 passed | 1 skipped`。`test` 同样是 `148 passed | 1 skipped`，端到端 `23 passed (59.0s)`。`redis` 为 `1 passed`。这次运行包含本轮文档。记录该结果的提交只改这份审计。

## 剩余限制

- 没有邮箱验证，没有反对票。评论最大层数仍是 8。
- 历史 `AUTH_SECRET` 仍在那 6 个提交的树里。本轮没有重写历史。
- 默认业务库仍是 SQLite。两个进程同时写仍可能 `database is locked`。端到端仍用 SQLite。生产改用 PostgreSQL 时必须改 datasource provider，只改 `DATABASE_URL` 不够。
- 默认限流仍是进程内存。真实 Redis 只覆盖独立 job 里的一条测试。`ioredis-mock` 仍用 Fengari 跑同一段 Lua，没有 `cjson`，也不是多机服务器。
- 搜索仍把 SQL 候选的标题和正文读进进程打分。分页发生在打分之后，所以不会为了少读行而丢掉高相关的帖子。
- 未登录用户的折叠仍只在当前浏览器的 `sessionStorage`。
- 直接执行 `npx next dev` 不会加载退出码钩子，父进程仍可能以 0 结束。`npm run dev` 会返回工作进程的非零码。
- SQLite 热度 SQL 的牛顿迭代，在 `ageHours + 2` 远大于 100000 时误差会变大。
