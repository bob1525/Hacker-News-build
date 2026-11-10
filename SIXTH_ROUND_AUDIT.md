# 第六轮审计

本轮仍在分支 `cursor/hacker-news-community-1102` 上。没有新开仓库，没有重写历史，没有删除或放宽已有测试。改动针对第五轮审计里还留着的四件事：Redis 的检查和计数不是原子的、PostgreSQL job 只建表、没有正式迁移 SQL、搜索和 Newest 没有走 SQL。

## 开工前的测试

第六轮改动之前，2026-11-10 16:33 UTC：

```text
npx vitest run
Test Files  22 passed (22)
Tests       130 passed (130)
Start at    16:33:12
Duration    2.43s

npx playwright test
23 passed (30.0s)
```

这 130 个单元测试和 23 个端到端测试都还在。本轮在其上新增 9 个单元测试。

## 阶段完成情况

| 阶段 | 自检文档 | 提交 | 新增测试 |
| --- | --- | --- | --- |
| 1 Redis 原子限流 | [REDIS_ATOMIC.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/REDIS_ATOMIC.md) | `8080a81359dfd1038853036257d8b8160ce2b281` | 4 |
| 2 PostgreSQL 上的单元测试 | [POSTGRES_TESTS.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/POSTGRES_TESTS.md) | `87af713252bbe3522c2f4358ebbcf2337a4bde1d`、`6801fad600bff0b3c7d8194c9c26e7bf84c19678`、`2afb70a79ae7e8159d7e8bb80db29814d207f898`、`0145946b52f8671197ac85d8644079a8537f111a` | 3 |
| 3 PostgreSQL 迁移 SQL | [POSTGRES_MIGRATION.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/POSTGRES_MIGRATION.md) | `ee6969adf16967876bfab3203705bb90713acc28` | 0 |
| 4 Newest 的 SQL 排序 | [RANKING_EXTEND.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/RANKING_EXTEND.md) | `a8d6b4c4c943ca33c0f35b733f7c7f96a3f84af6` | 2 |
| 5 本审计 | [SIXTH_ROUND_AUDIT.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/SIXTH_ROUND_AUDIT.md) | `357ffd28aed90e4a4fedae77f1a859a0a71b6dbd` | 0 |

### 阶段 1

`RedisRateLimitStore.consume` 用一次 `EVAL` 执行 `RATE_LIMIT_LUA`。脚本在同一次调用里读时间戳、丢掉窗口外的记录、决定放行或拒绝并写回。`applyRateLimitAsync` 有 `consume` 时不再先 `check` 再 `record`。时间戳是逗号分隔的整数，因为 `ioredis-mock` 的 Lua 没有 `cjson`。两个存储实例共用一个 mock，并发时限额不会被放宽。新增 4 个测试。阶段结束时单元测试 134。端到端仍是开工前的 23，默认后端是内存。

### 阶段 2

`postgres` job 生成 PostgreSQL Prisma Client，然后 `npm test` 连到 `postgres:16`。不再把 `DATABASE_URL` 改回 SQLite。并发投票和热度测试各用一个 schema。热度 SQL 在 PostgreSQL 上使用 `power()` 和 `timestamp(3)`，SQLite 仍用牛顿迭代。

运行 [42857634496](https://github.com/bob1525/Hacker-News-build/actions/runs/42857634496) 结论 success：

| job | 结果 | 时间 |
| --- | --- | --- |
| `postgres` [129974902706](https://github.com/bob1525/Hacker-News-build/actions/runs/42857634496/job/129974902706) | success | 16:44:40Z 到 16:46:06Z |
| `test` [129974903400](https://github.com/bob1525/Hacker-News-build/actions/runs/42857634496/job/129974903400) | success | 16:44:40Z 到 16:47:00Z |

`postgres` 为 24 个文件、137 个测试，并在 `ranking_sql` 和 `concurrency` schema 上建表。`test` 为 137 个单元测试和 23 个端到端测试。在此之前有一次 typecheck 失败和一次空 env 断言失败，都已修掉，过程写在 `POSTGRES_TESTS.md`。新增 3 个方言测试。

### 阶段 3

`scripts/generate-postgres-migration.sh` 用 `prisma migrate diff --from-empty --to-schema-datamodel --script` 写出 `prisma/migrations-postgres/0001_init.sql`。SQL 使用 `TIMESTAMP(3)`，没有 SQLite 的 `DATETIME`，也没有重放 `prisma/migrations`。默认 provider 仍是 `sqlite`。切换步骤、`db execute` 和漂移检查写在 `POSTGRES_MIGRATION.md`。本机没有 PostgreSQL，这份 SQL 还没有在空库上执行。新增测试 0。

### 阶段 4

`RANKING_BACKEND=sql` 时 Newest 走 `pageNewestPostIds`，按 `createdAt DESC, id DESC` 分页。搜索仍在内存里排序：相关度权重在 `searchRelevance`，再写一份 SQL 会变成第二套规则。生产环境若已切到 PostgreSQL，推荐 `RANKING_BACKEND=sql`；仓库默认仍是 `memory`。新增 2 个测试。阶段结束时单元测试 139。

## 最终验证

阶段 5 提交前在本机执行：

```text
npm run lint        通过
npm run typecheck   通过
npx vitest run
Test Files  24 passed (24)
Tests       139 passed (139)
Start at    16:49:59
Duration    2.39s

npm run test:e2e
23 passed (29.8s)
```

139 = 开工前的 130 + 9。23 个端到端测试没有增删。原有断言没有放宽。

这次提交的 push 运行 [42858792514](https://github.com/bob1525/Hacker-News-build/actions/runs/42858792514) 结论 success：

| job | 结果 | 时间 |
| --- | --- | --- |
| `postgres` [129978980635](https://github.com/bob1525/Hacker-News-build/actions/runs/42858792514/job/129978980635) | success | 16:51:14Z 到 16:52:42Z，约 1 分 28 秒 |
| `test` [129978981051](https://github.com/bob1525/Hacker-News-build/actions/runs/42858792514/job/129978981051) | success | 16:51:14Z 到 16:53:23Z，约 2 分 9 秒 |

`postgres` 上 `ranking-sql` 为 8 个测试（含 Newest 的 2 个），全部单元测试 139。`test` job 为 139 个单元测试和 `23 passed (52.8s)`。Node.js 20 弃用提示和 Ubuntu 26 提示没有让 job 失败。

## 剩余限制

- 没有邮箱验证，没有反对票。评论折叠只在 `sessionStorage`。评论深度上限是 8。
- 历史 `AUTH_SECRET` 仍在那 6 个提交的树里。本轮没有重写历史。
- 速率限制默认仍是进程内存。Redis 的原子性由 mock 执行同一段 Lua 证明，本机没有独立的 Redis 服务器。
- 默认业务库仍是 SQLite。两个进程同时写仍可能 `database is locked`。端到端仍用 SQLite。
- `prisma/migrations-postgres/0001_init.sql` 还没有在空的 PostgreSQL 上执行。CI 证明的是同一数据模型的 `db push`。
- 搜索相关度仍在进程内计算。
- SQLite 热度 SQL 的牛顿迭代，在 `ageHours + 2` 远大于 100000 时误差会变大。
- `next dev` 在密钥不合格时，工作进程会退出，父进程仍可能以 0 结束。
