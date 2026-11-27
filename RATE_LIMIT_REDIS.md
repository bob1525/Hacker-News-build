# Redis 速率限制

第五轮阶段 2 的自检。在现有 `RateLimitStore` 之外增加 Redis 后端。默认仍然是内存。原有内存和 SQLite 测试没有删断言。

## 具体做了什么

- 新增 `RedisRateLimitStore`，实现 `check`、`record`、`clear`。时间戳以 JSON 数组存在 `hn:rate:<key>`。拒绝的请求只写回窗口内的旧时间戳，不追加新的，和内存实现一致。
- `RATE_LIMIT_BACKEND=redis` 且设置了 `REDIS_URL` 时，`openRateLimitStore` 返回这个类。未设置 `REDIS_URL` 会立刻抛出 `REDIS_URL is required when RATE_LIMIT_BACKEND=redis.`
- 服务端动作改走 `guardRateLimit`。内存和 SQLite 仍走原来的同步 `applyRateLimit`。`enforceRateLimit` 的返回类型不变，原有测试继续同步读取 `.ok`。
- 同一进程里对同一个 key 的 Redis 判定串行执行，所以并发调用不会把限额算多。
- 连接失败不退回内存。`guardRateLimit` 把 `RateLimitStoreError` 变成拒绝，文案是 `Rate limit store is unavailable. Try again shortly.`

## 如何验证

```bash
npx vitest run tests/unit/rate-limit-redis.test.ts tests/unit/rate-limit.test.ts tests/unit/rate-limit-store.test.ts
npm test
npm run test:e2e
```

测试使用 `ioredis-mock`，不连接真实 Redis。读取配置的那条测试只构造客户端（`lazyConnect: true`），不发送计数命令。

## 结果证据

`tests/unit/rate-limit-redis.test.ts` 7 个测试通过：

| 测试 | 覆盖 |
| --- | --- |
| counts the same way as the memory store | 正常计数，并与内存逐步对比 |
| drops hits that have left the window | 窗口刚好到期后旧记录被丢掉 |
| does not record a rejected hit | 超限拒绝，且不写入新时间戳 |
| clears every key | `clear` 清掉所有 key |
| lets only the limit through when calls overlap | 10 个重叠调用、限额 4，正好 4 次通过 |
| reads redis settings and rejects a missing url | 缺少 `REDIS_URL` 抛错；有 URL 时得到 `RedisRateLimitStore` |
| rejects the action when redis cannot be reached | 命令失败抛 `RateLimitStoreError`，`guardRateLimit` 返回不可用，请求不被放行 |

同时 `tests/unit/rate-limit.test.ts` 5 个通过，`tests/unit/rate-limit-store.test.ts` 6 个通过。后者里未知后端的断言从字符串 `redis` 改成 `not-a-backend`，仍然要求未知值抛出 `Unknown RATE_LIMIT_BACKEND`。Redis 已经是合法后端，不能再拿它充当未知值。

阶段 2 结束时的全量结果写在下面的「全量结果」小节。本阶段新增 7 个单元测试。

## 环境变量

```bash
# 默认，可以不写
RATE_LIMIT_BACKEND=memory

# 单机文件
RATE_LIMIT_BACKEND=sqlite
RATE_LIMIT_SQLITE_PATH=prisma/rate-limits.db

# 多实例共享
RATE_LIMIT_BACKEND=redis
REDIS_URL=redis://127.0.0.1:6379/0
```

`.env.example` 里这几行都是注释。不设置时行为与第四轮相同。

## 三种后端

| | memory | sqlite | redis |
| --- | --- | --- | --- |
| 何时使用 | 单进程演示和当前 CI | 单进程，希望重启后还留着窗口 | 多个应用实例要共用限额 |
| 切换 | 默认，或 `RATE_LIMIT_BACKEND=memory` | `RATE_LIMIT_BACKEND=sqlite` | `RATE_LIMIT_BACKEND=redis` 且 `REDIS_URL` |
| 重启 | 计数清空 | 文件还在 | Redis 里的 key 还在 |
| 多进程 | 各记各的 | 一个写者，别的进程会锁等待 | 共用一份数据 |
| 判定接口 | 同步 `check` / `record` / `clear` | 同步，同一套规则 | 异步，同一套规则 |
| 失败 | 不依赖外部服务 | SQLite 错误向上抛 | 拒绝本次请求，不改用内存 |

## 连接失败时的策略

选择明确失败，不降级。

- 客户端使用 `lazyConnect`、`enableOfflineQueue: false`、`maxRetriesPerRequest: 1`，`retryStrategy` 返回 `null`。连不上就失败，不在内存里排队。
- `check`、`record`、`clear` 捕获命令错误，抛出 `RateLimitStoreError`。给用户的句子固定，不带 Redis 主机或内部错误。
- `guardRateLimit` 捕获这个错误并返回 `{ ok: false, error: "Rate limit store is unavailable. Try again shortly." }`。发帖、评论、投票都不会继续执行。
- socket 的 `error` 事件被空监听器接住，避免未处理的错误把进程打崩。真正的失败仍然从命令的 Promise 里抛出。

没有选择退回内存。退回之后，每个实例会各自计数，配置写着 Redis 时限额会比预期更松，故障也不明显。

## 发现的问题与处理方式

- 现有 `RateLimitStore` 是同步的。把 `enforceRateLimit` 改成返回 Promise 会让 `tests/unit/rate-limit.test.ts` 无法再读取 `.ok`。因此 Redis 走 `applyRateLimitAsync` 和 `guardRateLimit`，同步函数在内存和 SQLite 上保持原样。若在 Redis 后端上误调 `enforceRateLimit`，会抛出 `RATE_LIMIT_BACKEND=redis must be checked with guardRateLimit.`
- 第五轮里，同一进程内的重叠调用由 `exclusive` 排成队列。两个进程仍可能交错 `GET` 和 `SET`。第六轮把判定改成一次 `EVAL`，见 `REDIS_ATOMIC.md`。Redis 路径不再经过 `check` 再 `record`。
- `openRateLimitStore` 现在的返回类型包含 Redis。SQLite 测试在 `instanceof` 收窄之后再调用同步 `applyRateLimit`，断言本身没变。
- 导入 `ioredis` 会进入服务端打包。`next.config.ts` 把它列入 `serverExternalPackages`，避免被打进客户端包。

## 全量结果

提交前执行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run test:e2e`：

```text
eslint        通过
typecheck     通过
vitest        Test Files  21 passed (21)
              Tests       124 passed (124)
playwright    23 passed
```

124 = 阶段开始时的 117 + 本阶段新增的 7。端到端仍是 23，默认后端是内存。
