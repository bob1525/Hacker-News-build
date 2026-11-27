# 第七轮阶段 4：生产配置与启动校验

## 做了什么

`npm run dev` 在启动 Next.js 之前加载 `scripts/next-dev-exit.cjs`。Next.js 15.5.29 的开发命令会 fork 一个工作进程，工作进程因 `AUTH_SECRET` 不合格执行 `process.exit(1)` 之后，父进程仍调用 `process.exit(0)`（`node_modules/next/dist/cli/next-dev.js` 的 `handleSessionStop`）。钩子记下子进程的退出码。父进程再要退出时，如果子进程的码不是 0，就用子进程的码。`Ctrl+C` 没有数字退出码，仍按父进程原来的码结束。

生产环境建议同时改这三项，本地默认都不改：

| 设置 | 生产建议 | 本地默认 | 切换之后 |
| --- | --- | --- | --- |
| 数据库 | PostgreSQL。把 Prisma datasource 改成 `postgresql`，再对空库执行 `prisma/migrations-postgres/*.sql` | SQLite，`DATABASE_URL=file:./dev.db` | 业务库离开本机文件。默认测试和端到端仍走 SQLite |
| `RATE_LIMIT_BACKEND` | `redis`，并设置 `REDIS_URL` | 不设置，等于内存 | 多进程共用一个滑动窗口，一次 Lua `EVAL`。Redis 不可用时请求被拒绝，不会退回内存 |
| `RANKING_BACKEND` | `sql` | 不设置，等于内存 | 热度和 Newest 在 SQL 里分页。搜索仍用 `searchRelevance` 给 SQL 候选打分 |

本地默认保持 SQLite 和内存，是因为仓库提交的 schema、SQLite 迁移和日常测试都按 SQLite 写，而且本机不保证有 Redis。把默认限流改成 Redis 后，没有 Redis 就会拒绝发帖、评论和投票。

## 如何验证

```bash
npx vitest run tests/unit/next-dev-exit.test.ts tests/unit/rate-limit-redis-live.test.ts tests/unit/auth-secret.test.ts
npx tsc --noEmit
npx eslint scripts/next-dev-exit.cjs tests/unit/next-dev-exit.test.ts tests/unit/rate-limit-redis-live.test.ts
```

退出码测试启动的就是 `npm run dev` 使用的命令：`node --require ./scripts/next-dev-exit.cjs ./node_modules/next/dist/bin/next dev --port 3217`，环境变量 `AUTH_SECRET=too-short`。

Redis 真实服务不在 `test` 或 `postgres` job 里。`.github/workflows/ci.yml` 的 `redis` job 使用 `redis:7`，只运行 `tests/unit/rate-limit-redis-live.test.ts`，并设置 `REDIS_INTEGRATION=1` 和 `REDIS_URL=redis://127.0.0.1:6379/0`。没有这个开关时，该测试跳过，默认 `npm test` 不会连 Redis。

## 结果证据

```text
npx vitest run tests/unit/next-dev-exit.test.ts tests/unit/rate-limit-redis-live.test.ts
↓ tests/unit/rate-limit-redis-live.test.ts (1 test | 1 skipped)
✓ tests/unit/next-dev-exit.test.ts (2 tests) 1821ms
  ✓ next dev exit code > exits 1 when next dev is started with an unacceptable AUTH_SECRET  1819ms
Test Files  1 passed | 1 skipped (2)
Tests       2 passed | 1 skipped (3)
Start at    10:01:16
Duration    2.01s

npx vitest run tests/unit/auth-secret.test.ts
✓ tests/unit/auth-secret.test.ts (9 tests) 8ms
Test Files  1 passed (1)
Tests       9 passed (9)
Start at    10:02:03

npx tsc --noEmit
通过

npx eslint scripts/next-dev-exit.cjs tests/unit/next-dev-exit.test.ts tests/unit/rate-limit-redis-live.test.ts
通过
```

输出里有 `AUTH_SECRET is too short`，进程退出码是 1。原有 `tests/unit/auth-secret.test.ts` 没有改断言。本阶段新增 3 个测试：父进程映射、真实 `next dev` 退出码、双连接打到 Redis 服务。第三个在本机跳过，因为没有 `REDIS_INTEGRATION=1`。

第一次 `redis` job 失败。运行 [45978671119](https://github.com/bob1525/Hacker-News-build/actions/runs/45978671119)：

| job | 结果 | 时间 |
| --- | --- | --- |
| `redis` [140436732120](https://github.com/bob1525/Hacker-News-build/actions/runs/45978671119/job/140436732120) | failure | 2026-11-27 10:02:16Z 到 10:03:07Z |
| `postgres` [140436733070](https://github.com/bob1525/Hacker-News-build/actions/runs/45978671119/job/140436733070) | success | 2026-11-27 10:02:16Z 到 10:03:20Z |
| `test` [140436733162](https://github.com/bob1525/Hacker-News-build/actions/runs/45978671119/job/140436733162) | success | 2026-11-27 10:02:16Z 到 10:04:23Z |

`redis:7` 已经启动。失败断言是 6 次调用里放行了 4 次，限额是 2。两个连接用了不同的键前缀，所以各自有一份限额。测试已改为同一个前缀。同一次运行里 `postgres` 对空 schema 执行迁移并漂移检查通过，`test` 为 148 passed、1 skipped、端到端 `23 passed (1.0m)`。

修正后的 push 运行 [45979073383](https://github.com/bob1525/Hacker-News-build/actions/runs/45979073383) 结论 success：

| job | 结果 | 时间 |
| --- | --- | --- |
| `redis` [140438073984](https://github.com/bob1525/Hacker-News-build/actions/runs/45979073383/job/140438073984) | success | 2026-11-27 10:05:08Z 到 10:05:56Z |
| `postgres` [140438074539](https://github.com/bob1525/Hacker-News-build/actions/runs/45979073383/job/140438074539) | success | 2026-11-27 10:05:08Z 到 10:06:16Z |
| `test` [140438074261](https://github.com/bob1525/Hacker-News-build/actions/runs/45979073383/job/140438074261) | success | 2026-11-27 10:05:08Z 到 10:07:19Z |

`redis` job：`tests/unit/rate-limit-redis-live.test.ts (1 test)`，`1 passed`。`postgres` 对 `public`、`ranking_sql`、`collapse`、`search`、`concurrency` 的漂移检查都通过，单元测试 `148 passed | 1 skipped`。`test` 同样是 `148 passed | 1 skipped`，端到端 `23 passed (1.0m)`。跳过的是没有 `REDIS_INTEGRATION=1` 的真实 Redis 测试。

## Redis 与 mock Lua 的边界

`ioredis-mock` 用 Fengari 执行同一段 `RATE_LIMIT_LUA`。Fengari 没有 `cjson`，所以脚本把时间戳存成逗号分隔的字符串。mock 是单个进程里的假服务器，不能证明两台机器同时写同一个键。`redis` job 用两个 `ioredis` 连接连到 `redis:7`，走同一段 `EVAL`。默认限流仍是内存。本机没有 Redis 服务，所以这个测试的通过证据以该 job 为准。

## 发现的问题

- 直接执行 `npx next dev` 不会加载这个钩子。Next.js 父进程仍会以 0 结束。要用 `npm run dev`。
- `next start` 本来就会在密钥不合格时以 1 结束。这次没有改生产服务器的退出路径。
- 第一次真实 Redis 运行因为测试使用了两个键前缀而失败。同一个前缀之后，`redis` job 通过。mock 仍然不是多机 Redis。
- 生产改用 PostgreSQL 时必须改 datasource provider。只改 `DATABASE_URL` 而留下 `provider = "sqlite"` 不会连上 PostgreSQL。
