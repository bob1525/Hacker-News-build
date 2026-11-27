# 第八轮审计

本轮仍在分支 `cursor/hacker-news-community-1102` 上，对应 [PR #1](https://github.com/bob1525/Hacker-News-build/pull/1)。没有新开仓库，没有重写历史，没有 force push。默认业务库仍是 SQLite，默认限流仍是内存。

开工前按要求复跑了第七轮结束时的套件。之后做了邮箱验证、反对票、评论深度、搜索窗口、未登录折叠和 `npx next dev` 的密钥检查。原有测试没有删除。两处断言随规则改写，没有放宽：端到端投票仍要求分数变化 1 再回到原值；未登录折叠的存储从 `"session"` 改成 `"local"`。

## 开工前的测试

2026-11-27 11:07 UTC，头提交 `7d7d8f3f70cf8e88156c575a630a760921e99452`：

```text
npx vitest run
Test Files  27 passed | 1 skipped (28)
Tests       148 passed | 1 skipped (149)
Start at    11:07:04
Duration    4.35s

npm run test:e2e
23 passed (30.7s)
```

跳过的是没有 `REDIS_INTEGRATION=1` 的真实 Redis 测试。这 148 个单元测试和 23 个端到端测试都还在。本轮新增 21 个单元测试。148 + 21 = 169。

## 阶段完成情况

| 阶段 | 自检文档 | 提交 | 新增测试 |
| --- | --- | --- | --- |
| 1 邮箱验证 | [EMAIL_VERIFICATION.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/EMAIL_VERIFICATION.md) | `208d7d2db8a16ab902e9080082c822bc2f8ac44f` | 7 |
| 2 反对票 | [DOWNVOTES.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/DOWNVOTES.md) | `3874acdc7fa7721286bcb0eae86652c6094430ca` | 7 |
| 3 评论深度 | [COMMENT_DEPTH.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/COMMENT_DEPTH.md) | `ee807af20e32d5b9b2322ccb68cef3efa3d88f83` | 3 |
| 4 遗留限制 | [LEFTOVER_HARDENING.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/LEFTOVER_HARDENING.md) | `5b4db6324303cb2dbecbf822c52ee869083e6673` | 4 |
| 5 本审计 | [EIGHTH_ROUND_AUDIT.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/EIGHTH_ROUND_AUDIT.md) | 本文件的提交 | 0 |

### 阶段 1

注册后签发 24 小时验证链接，库里只存 SHA-256。`/verify` 写入 `emailVerifiedAt`。重发走 `verify` 限流，10 分钟 3 次。默认 `MAILER=console`，不需要付费邮件服务。`REQUIRE_EMAIL_VERIFICATION` 未设置时，发帖、评论、投票维持原样。SQLite 迁移 `20261127120000_email_verification`，PostgreSQL 追加 `0003_email_verification.sql`。

push 运行 [45988268224](https://github.com/bob1525/Hacker-News-build/actions/runs/45988268224) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140469302155](https://github.com/bob1525/Hacker-News-build/actions/runs/45988268224/job/140469302155) | success |
| `postgres` [140469302493](https://github.com/bob1525/Hacker-News-build/actions/runs/45988268224/job/140469302493) | success |
| `redis` [140469302562](https://github.com/bob1525/Hacker-News-build/actions/runs/45988268224/job/140469302562) | success |

`postgres` 在空库上按文件名执行到 `0003` 并通过漂移检查。

### 阶段 2

赞成和反对共用一行，`value` 为 `1` 或 `-1`。再点同一方向取消，点另一方向切换。显示点数是合计，可以是负数。热度公式不变。`hotScore` 原有的 0 分下限还在，SQL 用 `MAX` / `GREATEST` 与它对齐，所以负分不会排到 0 分下面。反对需要至少 1 点来自别人的业力，并走原来的 `vote` 限流。SQLite 迁移 `20261127130000_vote_value`，PostgreSQL 追加 `0004_vote_value.sql`。已有票默认 `value = 1`。

push 运行 [45989103648](https://github.com/bob1525/Hacker-News-build/actions/runs/45989103648) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140472103126](https://github.com/bob1525/Hacker-News-build/actions/runs/45989103648/job/140472103126) | success |
| `postgres` [140472103567](https://github.com/bob1525/Hacker-News-build/actions/runs/45989103648/job/140472103567) | success |
| `redis` [140472103573](https://github.com/bob1525/Hacker-News-build/actions/runs/45989103648/job/140472103573) | success |

`postgres` 在空库上执行到 `0004` 并通过漂移检查。

### 阶段 3

评论硬上限从 8 层改成 16 层。第 16 层不再显示回复入口。缩进每层 12 像素，到 120 像素停止。仓库里没有断言「最大是 8」的测试。四层线程的旧测试仍通过。

push 运行 [45989388955](https://github.com/bob1525/Hacker-News-build/actions/runs/45989388955) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140473070095](https://github.com/bob1525/Hacker-News-build/actions/runs/45989388955/job/140473070095) | success |
| `postgres` [140473070057](https://github.com/bob1525/Hacker-News-build/actions/runs/45989388955/job/140473070057) | success |
| `redis` [140473069556](https://github.com/bob1525/Hacker-News-build/actions/runs/45989388955/job/140473069556) | success |

### 阶段 4

搜索按特征分组计数，分数只调用 `searchRelevance`。同一分数的行用原来的热度 SQL 只取本页还缺的数量。未登录折叠改到 `localStorage`。`next.config.ts` 在父进程加载时拒绝不合格的 `AUTH_SECRET`，所以 `npx next dev` 也会以 1 退出。`npm run dev` 的退出码钩子还在。

本地复跑，2026-11-27 11:27 UTC，提交 `5b4db6324303cb2dbecbf822c52ee869083e6673`：

```text
npx vitest run
Test Files  31 passed | 1 skipped (32)
Tests       169 passed | 1 skipped (170)
Start at    11:27:14
Duration    5.19s

npm run test:e2e
23 passed (30.7s)
```

`npx tsc --noEmit` 通过。端到端仍是 23，没有增删。

### 阶段 5

本文件和 README 的第八轮索引。没有新增测试。包含阶段 4 代码的推送会被本提交取代。头提交的 `test`、`postgres`、`redis` 结果记在下一笔只改本文件的提交里。

## 原有测试

对照 `7d7d8f3` 的 148 个通过和 1 个跳过：

- 没有删除测试文件，没有 `it.skip` 掉原来会跑的用例，没有注释掉断言。
- `tests/e2e/votes.spec.ts` 的定位改成赞成按钮的名字，因为旁边多了反对按钮。分数变化 1、再回到原值、自己的帖子没有投票按钮，这三条还在。
- `collapseStorage(null)` 的期望从 `"session"` 改成 `"local"`。已登录仍是 `"database"`。
- `hotScore(-8, 0)` 等于 `hotScore(0, 0)`，`computeKarma(-3, 2) === 2`，都没有改。

## 剩余限制

- 历史 `AUTH_SECRET` 仍在旧提交的树里。本轮没有重写历史。
- 默认业务库仍是 SQLite。默认限流仍是进程内存。生产可以改用 PostgreSQL、`RATE_LIMIT_BACKEND=redis`、`RANKING_BACKEND=sql`，这些不是仓库默认值。
- 邮箱验证默认关闭。控制台邮件器只记录和打印，不会把信送到真实邮箱。发信失败不回滚已经创建的账号。
- 反对票可以把显示点数打成负数，但热榜把 0 分以下当成 0 分。业力每一侧先压到 0，不会出现负业力。新账号在别人赞成之前不能反对。
- 评论第 10 层以后缩进不再变宽。数据上限仍是 16。
- 搜索的分组扫描仍在数据库里读命中行。进程只给当前结果窗口打分。很深的一页最多打分到那一页为止的行。SQL 的 `lower` 和 JavaScript 的 `toLowerCase` 在非 ASCII 上仍可能不一致。
- 未登录折叠在这个浏览器的 `localStorage`。清站点数据或换浏览器会丢。
- SQLite 热度 SQL 的牛顿迭代，在 `ageHours + 2` 远大于 100000 时误差会变大。
