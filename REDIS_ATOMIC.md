# 第六轮阶段 1：Redis 限流原子性

## 做了什么

把 Redis 限流的检查和计数收成一次 `EVAL`。`RedisRateLimitStore.consume` 执行 `RATE_LIMIT_LUA`，脚本在同一次调用里读取时间戳、丢掉窗口外的记录、决定放行或拒绝，并写回结果。`applyRateLimitAsync` 在存储实现了 `consume` 时只走这一次调用，不再先 `check` 再 `record`，也不再依赖进程内的 `exclusive` 队列。

时间戳存成逗号分隔的整数，例如 `1000,1000,1000`。脚本只用 `string.gmatch`，不依赖 `cjson`。`ioredis-mock` 用 Fengari 执行这段 Lua，所以测试跑的是脚本本身，不是 TypeScript 里的另一份判定。

拒绝时不追加新时间戳，只把仍在窗口内的旧记录写回。窗口边界与内存实现相同：`now - stamp < window`，刚好等于窗口长度的记录会被丢掉。

## 开工前基线

改动前在本机执行：

```text
npx vitest run
Test Files  22 passed (22)
Tests       130 passed (130)
Start at    16:33:12
Duration    2.43s

npx playwright test
23 passed (30.0s)
```

## Lua 脚本

脚本常量是 `lib/domain/redis-rate-limit-store.ts` 里的 `RATE_LIMIT_LUA`。`KEYS[1]` 是带 `hn:rate:` 前缀的存储键，`ARGV` 依次是 `limit`、`windowMs`、`now`。返回 `{ allowed, retry }`，`allowed` 为 1 表示放行。

```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local raw = redis.call('GET', key)
local recent = {}
if raw and raw ~= false and raw ~= '' then
  for stamp in string.gmatch(tostring(raw), '[0-9]+') do
    local n = tonumber(stamp)
    if now - n < window then
      recent[#recent + 1] = n
    end
  end
end
local allowed = 0
local retry = 0
if #recent >= limit then
  local oldest = recent[1]
  retry = window - (now - oldest)
  if retry < 0 then
    retry = 0
  end
else
  recent[#recent + 1] = now
  allowed = 1
end
if #recent == 0 then
  redis.call('DEL', key)
else
  local parts = {}
  for i = 1, #recent do
    parts[i] = string.format('%.0f', recent[i])
  end
  redis.call('SET', key, table.concat(parts, ','))
end
return { allowed, retry }
```

## 如何验证

- 新增 `tests/unit/rate-limit-atomic.test.ts`。两个 `RedisRateLimitStore` 共用同一个 `ioredis-mock` 客户端，模拟两个进程，各自没有对方的进程内队列。
- 原有 `tests/unit/rate-limit-redis.test.ts` 的 7 个用例继续走 `applyRateLimitAsync`，现在也会进入这次 `EVAL`。连接失败的用例改为让 `eval` 抛出 `ECONNREFUSED`，断言仍是 `RateLimitStoreError` 和固定的不可用文案。
- 执行 `npx tsc --noEmit` 和 `npx vitest run`。

## 结果证据

```text
npx tsc --noEmit
通过

npx vitest run tests/unit/rate-limit-atomic.test.ts tests/unit/rate-limit-redis.test.ts tests/unit/rate-limit.test.ts tests/unit/rate-limit-store.test.ts
Test Files  4 passed (4)
Tests       22 passed (22)

npx vitest run
Test Files  23 passed (23)
Tests       134 passed (134)
Start at    16:35:21
Duration    2.46s
```

134 = 开工前的 130 + 本阶段新增的 4。新增用例：

1. 脚本包含 `GET` 和 `SET`，且不使用 `cjson`。
2. 两个存储实例并发 12 次、限额 3，恰好 3 次成功，两边读到的时间戳都是 `[1000, 1000, 1000]`。
3. 限额 1 已被占用后，两个实例同时再请求都被拒绝，时间戳仍只有 `[0]`。
4. 两个键并发时各自保留自己的限额，互不占用。

端到端仍是开工前的 23 个通过。本阶段默认后端仍是内存，端到端不经过 Redis。

## 发现的问题

- `ioredis-mock` 的 Lua 运行时没有 `cjson`。若脚本用 `cjson.decode`，测试无法执行真实脚本。因此时间戳改为逗号分隔，真实 Redis 和 mock 都能跑同一段脚本。
- `exclusive` 仍留在接口上，给没有 `consume` 的异步存储用。Redis 判定不再使用它。单进程队列不能代替 Redis 的原子执行。
- 本机没有独立的 Redis 服务器。原子性证据来自 mock 对这段 Lua 的实际执行，以及两个存储实例共享同一份数据时限额不会被放宽。
