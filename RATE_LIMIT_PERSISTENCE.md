# 速率限制持久化

第四轮阶段 2 的自检。内存计数改成可替换的存储。默认仍是内存，现有限额和错误文案不变。

## 做了什么

`RateLimitStore` 有两个操作：

- `check(key)`：读出这个键已经记下的时间戳。
- `record(key, stamps)`：用给出的时间戳替换这个键的记录。
- `clear()`：清空，供测试和 `resetRateLimits` 使用。

`applyRateLimit` 执行原来的滑动窗口：窗口外的时间戳丢掉；达到上限就拒绝，并且这次拒绝不占名额；没满则记下当前时间。拒绝文案仍是 `Too many requests. Try again in N seconds.`

`consumeRateLimit(buckets, ...)` 还在，内部改成对一块 `Map` 调用 `applyRateLimit`。原来的 5 个速率测试没有改断言。

两种实现：

| | 内存 `MemoryRateLimitStore` | SQLite `SqliteRateLimitStore` |
| --- | --- | --- |
| 数据放在哪 | 进程里的 `Map` | 单独的 SQLite 文件，表 `rate_limit_hit(key, at_ms)` |
| 重启之后 | 计数清空 | 同一文件里的记录还在 |
| 多进程 | 各记各的 | 可以共写一个文件，但仍受 SQLite 单写者限制 |
| 默认 | 是 | 否 |

SQLite 文件不是 Prisma 那份业务库，避免把计数表混进帖子迁移。默认路径是 `prisma/rate-limits.db`。`*.db` 已被 gitignore。

## 如何切换

不设置环境变量时用内存。

```bash
RATE_LIMIT_BACKEND=sqlite
RATE_LIMIT_SQLITE_PATH=prisma/rate-limits.db
```

`RATE_LIMIT_SQLITE_PATH` 可省略。未知的 `RATE_LIMIT_BACKEND` 会抛出 `Unknown RATE_LIMIT_BACKEND`。

## 新增测试

`tests/unit/rate-limit-store.test.ts`，6 个：

1. 内存存储和 `consumeRateLimit` 在同一串操作上的允许、拒绝、过窗结果一致。
2. 内存里被拒绝的请求不会多记下一次。
3. 关掉 SQLite 再打开同一文件，已记下的时间戳还在，并且会继续计数。
4. 窗口到期后 SQLite 丢掉旧记录；`clear()` 清空表。
5. `openRateLimitStore` 默认内存，`sqlite` 打开指定文件，`redis` 被拒绝。
6. `resetRateLimits` 清的是当前装上的那个存储。

原有 `tests/unit/rate-limit.test.ts` 的 5 个测试未改，仍然通过。

## 验证方法

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

## 结果证据

- `eslint` 通过。
- `npm run typecheck` 通过。
- Vitest：20 个文件、117 个测试通过。本阶段新增 6 个。原来的 111 个都在。
- Playwright：23 passed。

## 发现的问题

- `node:sqlite` 在 Node 22 里能用，但导入时会打印 ExperimentalWarning。只要代码引用了这个模块，即使用内存后端，进程启动也会看到这行警告。端到端的生产服务器日志里出现了一次，测试仍然通过。
- SQLite 后端能跨重启保留计数，不能解决多实例各自持有内存、或者多个进程抢同一 SQLite 写锁的问题。多实例要等业务库换成 PostgreSQL 之后，再把这张表放进同一份数据库。
