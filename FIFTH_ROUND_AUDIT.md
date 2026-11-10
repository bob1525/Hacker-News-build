# 第五轮审计

本轮仍在分支 `cursor/hacker-news-community-1102` 上。没有新开仓库，没有重写历史，没有删除或放宽已有测试。

## 开工前的测试

第五轮改动之前：

```text
npm run lint        通过
npm run typecheck   通过
vitest              Test Files  20 passed (20)
                    Tests       117 passed (117)
playwright          23 passed
```

这 117 个单元测试和 23 个端到端测试都还在。本轮在其上新增 13 个单元测试。

## 阶段完成情况

| 阶段 | 自检文档 | 提交 |
| --- | --- | --- |
| 1 历史密钥清理准备 | [HISTORY_CLEANUP_V2.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/HISTORY_CLEANUP_V2.md) | `1f5fa93b1ef594021791422905fced461aa5c9b8` |
| 2 Redis 速率限制 | [RATE_LIMIT_REDIS.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/RATE_LIMIT_REDIS.md) | `b2ed0b41f2b499a67d597d4d53c23f18d862e1f5` |
| 3 PostgreSQL CI | [POSTGRES_CI.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/POSTGRES_CI.md) | `64ad88dfc31dfb09efbef45d594fc37a3ad94587`、`a14ea9afb293c033dd9bbdf6e51dedc294273674` |
| 4 SQL 热度排序 | [RANKING_DB.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/RANKING_DB.md) | `5ee84ca8797f5983447b422b9a5e73a2f4f18955` |
| 5 本审计 | [FIFTH_ROUND_AUDIT.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/FIFTH_ROUND_AUDIT.md) | `6a4850db6a178cf9f480baa4e71833697d6b7325` |

### 阶段 1

`.env` 只在 `7e36ef6cdae9b0add2eee057615d6c938bf68839` 被加入。6 个提交的树里仍有它，`AUTH_SECRET` 长 31，不是占位符，判定为弱值。文档给出 filter-repo 和 BFG 两套命令、备份、清理后 `git log --all -- .env` 应为空，以及 force push 后必须重新克隆。没有执行重写。README 顶部有「安全警告」。`.env.example` 的示例是 `PLACEHOLDER_REPLACE_WITH_A_NEW_SECRET`，并写了 `openssl rand -base64 32`。31 字符和新占位符都会被拒绝。新增测试 0。阶段结束时单元测试 117，端到端沿用开工前的 23。

### 阶段 2

`RedisRateLimitStore` 实现 `check`、`record`、`clear`。`RATE_LIMIT_BACKEND=redis` 且有 `REDIS_URL` 时启用。连接失败不退回内存，`guardRateLimit` 返回 `Rate limit store is unavailable. Try again shortly.` 新增 7 个测试，使用 `ioredis-mock`。原有 5 个速率限制测试和 6 个存储测试仍通过。阶段结束时单元测试 124，端到端 23。

### 阶段 3

`test` job 保持 SQLite 路径。新 job `postgres` 使用 `postgres:16`、`pg_isready` 健康检查，并用 `scripts/push-postgres-schema.sh` 做 `prisma db push`。现有迁移是 SQLite SQL，所以没有 `migrate deploy` 到 PostgreSQL。运行 [42850349762](https://github.com/bob1525/Hacker-News-build/actions/runs/42850349762) 里 `postgres` 和 `test` 都是 success。`postgres` 日志有 `PostgreSQL schema push and probe write succeeded`，单元测试 124；`test` job 端到端 23 passed。新增测试 0。

### 阶段 4

`RANKING_BACKEND=sql` 把热度下推到 SQL。SQLite 没有 `power()`，用 20 步牛顿迭代近似 `^ 1.8`。默认仍是内存。新增 6 个一致性测试。阶段结束时单元测试 130，端到端 23 passed。

## 新增测试

| 文件 | 数量 |
| --- | --- |
| `tests/unit/rate-limit-redis.test.ts` | 7 |
| `tests/unit/ranking-sql.test.ts` | 6 |
| 合计 | 13 |

## 主要文件

新增：

- `HISTORY_CLEANUP_V2.md`
- `RATE_LIMIT_REDIS.md`
- `POSTGRES_CI.md`
- `RANKING_DB.md`
- `FIFTH_ROUND_AUDIT.md`
- `lib/domain/redis-rate-limit-store.ts`
- `lib/domain/ranking-sql.ts`
- `lib/ranking-backend.ts`
- `scripts/push-postgres-schema.sh`
- `tests/unit/rate-limit-redis.test.ts`
- `tests/unit/ranking-sql.test.ts`
- `ioredis-mock.d.ts`

修改：

- `README.md`
- `.env.example`
- `.github/workflows/ci.yml`
- `lib/limits.ts`
- `lib/domain/rate-limit.ts`
- `lib/actions/posts.ts`
- `lib/actions/comments.ts`
- `lib/actions/votes.ts`
- `lib/queries.ts`
- `next.config.ts`
- `package.json`
- `package-lock.json`
- `tests/unit/rate-limit-store.test.ts`（未知后端的样例字符串改为 `not-a-backend`，断言仍要求抛出 `Unknown RATE_LIMIT_BACKEND`）

## 最终本地验证

阶段 5 写入本文之前：

```text
npm run lint        通过
npm run typecheck   通过
vitest              Test Files  22 passed (22)
                    Tests       130 passed (130)
playwright          23 passed (30.4s)
git ls-files        NO_TRACKED_DOTENV
```

130 里包含开工前的 117。端到端仍是原来的 23 个，没有新增也没有删除。`.github/workflows/ci.yml` 含有 `postgres:16`。`openRateLimitStore` 在 `RATE_LIMIT_BACKEND=redis` 时返回 `RedisRateLimitStore`。README 顶部有「安全警告」，文档索引包含本轮五份自检文档。

## CI 最新运行

阶段 5 提交 `6a4850db6a178cf9f480baa4e71833697d6b7325` 的 push 运行 [42851953604](https://github.com/bob1525/Hacker-News-build/actions/runs/42851953604) 结论 success：

| job | 结果 | 时间 |
| --- | --- | --- |
| `test` [129954872623](https://github.com/bob1525/Hacker-News-build/actions/runs/42851953604/job/129954872623) | success | 2026-11-10 16:11:16Z 到 16:13:32Z，约 2 分 16 秒 |
| `postgres` [129954873293](https://github.com/bob1525/Hacker-News-build/actions/runs/42851953604/job/129954873293) | success | 同一次运行，约 54 秒 |

`test` job：22 个文件、130 个单元测试通过，端到端 `23 passed`。`postgres` job：`PostgreSQL schema push and probe write succeeded`，单元测试同样是 130 个通过。Node.js 20 弃用提示和 Ubuntu 26 迁移提示没有让 job 失败。

## 仍未解决

- 没有邮箱验证。注册只检查用户名、邮箱格式和密码。
- 没有反对票。
- 评论折叠只在当前浏览器的 `sessionStorage`。
- 评论最多嵌套 8 层。
- 旧 `AUTH_SECRET` 仍在 6 个历史提交里。本轮按要求没有 force push。
- 速率限制默认仍是进程内存。Redis 在单个进程内对同一个 key 串行，两个进程仍可能交错 `GET` 和 `SET`。
- 业务库默认仍是 SQLite。PostgreSQL job 用 `db push` 验证 schema，单元测试仍用 SQLite 客户端。
- 热度排序默认仍在内存。SQL 后端在年龄超过大约 11 年时，牛顿迭代可能和 `**` 有可见差别。搜索和 Newest 没有下推。
- `next dev` 在密钥不合格时，工作进程退出后父进程仍可能以 0 结束。
