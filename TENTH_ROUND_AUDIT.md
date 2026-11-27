# 第十轮审计

本轮仍在分支 `cursor/hacker-news-community-1102` 上，对应 [PR #1](https://github.com/bob1525/Hacker-News-build/pull/1)。没有新开仓库，没有重写历史，没有 force push。默认业务库仍是 SQLite，默认限流仍是内存。`REQUIRE_EMAIL_VERIFICATION` 仍关闭，`MAILER` 默认仍是 `console`。

开工前在第九轮头提交 `84a8246fb166548cf53c156209d7ac6d194bee90` 上复跑过套件：单元测试 186 passed、1 skipped，端到端 26 passed。数字与约定一致，之后才改代码。原有测试没有删除，没有注释断言，也没有放宽。本轮新增 14 个单元测试和 3 个端到端测试。186 + 14 = 200。26 + 3 = 29。

## 做了什么

| 阶段 | 自检文档 | 提交 | 新增测试 |
| --- | --- | --- | --- |
| 1 作废会话 | [SESSION_REVOKE.md](SESSION_REVOKE.md) | `729dcb9d6801ded96effadaeefd79475dad875f4` | 4 个单元 |
| 2 搜索折叠 | [SEARCH_FOLD_V2.md](SEARCH_FOLD_V2.md) | `791c1c163518300b4cf6a68aa19e42ac1f5f47ae` | 3 个单元 |
| 3 更换邮箱 | [ACCOUNT_EMAIL_CHANGE.md](ACCOUNT_EMAIL_CHANGE.md) | `06b4de7f350c17eeb3999102ac4d0ceb32c4ddf0` | 5 个单元 |
| 4 遗留限制 | [LEFTOVER_HARDENING_V3.md](LEFTOVER_HARDENING_V3.md) | `6795af983c670373c0f69c58d39bba21a38afe05` | 2 个单元、3 个端到端 |
| 5 本审计 | [TENTH_ROUND_AUDIT.md](TENTH_ROUND_AUDIT.md) | 本文件这一笔提交 | 0 |

阶段 1：密码重置成功时把 `sessionVersion` 加 1。JWT 带 `sv`。`getCurrentUser` 只接受和库里版本相同的令牌。没有 `sv` 的旧令牌按 0 处理。新登录用当前版本签名。SQLite 迁移 `20261127160000_session_version`，PostgreSQL 追加 `0007_session_version.sql`。

阶段 2：`foldSearchText` 仍是唯一折叠。NFC 和 `toLowerCase` 之后把 `ß` 展成 `ss`，把 `ς` 收成 `σ`。SQL 不调用 `lower()`，也没有第二份相关度。`backfillSearchFolds` 会重写空的或仍是旧折叠的列。

阶段 3：已登录用户申请更换邮箱。库里只存 SHA-256 和新地址，链接一小时有效，10 分钟最多 3 次。确认前旧邮箱不变。发信失败不改邮箱，错误里没有令牌，可以再要一封。地址被占用时事务回滚。不打开 `REQUIRE_EMAIL_VERIFICATION`。SQLite 迁移 `20261127170000_email_change`，PostgreSQL 追加 `0008_email_change.sql`。

阶段 4：第 11 到 16 层不再叠加左边框和内边距。橙色层数标记和 16 层上限还在，缩进仍停在 120 像素。截图补了反对票、验证、重置密码、更换邮箱和深层评论。端到端走过重置链接和换邮箱确认。`MAIL_LOG_PATH` 默认不设置。

阶段 5：本文件，加上 README 里第十轮五份文档的索引。没有新增测试。

## 怎么验证

开工前的基线记在 [SESSION_REVOKE.md](SESSION_REVOKE.md)。推送本文件之前，在阶段 4 头 `6795af983c670373c0f69c58d39bba21a38afe05` 上又跑了一遍：

```bash
npm run lint
env -u AUTH_SECRET npm run typecheck
npm test
npm run test:e2e
```

CI 看 `test`、`postgres`、`redis` 三个 job。本机没有 PostgreSQL，也没有为 `REDIS_INTEGRATION=1` 起 Redis。阶段 4 的两次运行已经结束，结论如下。

阶段 4 提交 `6795af983c670373c0f69c58d39bba21a38afe05`：

push 运行 [46006478164](https://github.com/bob1525/Hacker-News-build/actions/runs/46006478164) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140530794884](https://github.com/bob1525/Hacker-News-build/actions/runs/46006478164/job/140530794884) | success |
| `postgres` [140530795626](https://github.com/bob1525/Hacker-News-build/actions/runs/46006478164/job/140530795626) | success |
| `redis` [140530795567](https://github.com/bob1525/Hacker-News-build/actions/runs/46006478164/job/140530795567) | success |

pull_request 运行 [46006486059](https://github.com/bob1525/Hacker-News-build/actions/runs/46006486059) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140530822473](https://github.com/bob1525/Hacker-News-build/actions/runs/46006486059/job/140530822473) | success |
| `postgres` [140530822166](https://github.com/bob1525/Hacker-News-build/actions/runs/46006486059/job/140530822166) | success |
| `redis` [140530822598](https://github.com/bob1525/Hacker-News-build/actions/runs/46006486059/job/140530822598) | success |

阶段 1 自己的 push [46005070702](https://github.com/bob1525/Hacker-News-build/actions/runs/46005070702) 和 pull_request [46005079996](https://github.com/bob1525/Hacker-News-build/actions/runs/46005079996) 被下一笔 push 取消。含那次代码的阶段 2 运行是绿的：push [46005237677](https://github.com/bob1525/Hacker-News-build/actions/runs/46005237677) 与 pull_request [46005248015](https://github.com/bob1525/Hacker-News-build/actions/runs/46005248015) 的 `test`、`postgres`、`redis` 都是 success。阶段 3 的 push [46005654593](https://github.com/bob1525/Hacker-News-build/actions/runs/46005654593) 与 pull_request [46005663163](https://github.com/bob1525/Hacker-News-build/actions/runs/46005663163) 的三个 job 也都是 success。

## 证据

2026-11-27 13:09 UTC，改代码之前，头提交 `84a8246`：

```text
npx vitest run
Test Files  34 passed | 1 skipped (35)
Tests       186 passed | 1 skipped (187)
Start at    13:09:39
Duration    6.66s

npx playwright test
26 passed (34.5s)
```

2026-11-27 17:36 UTC，推送本文件之前，头提交 `6795af9`：

```text
npm run lint
eslint .

env -u AUTH_SECRET npm run typecheck
Generating route types...
✓ Route types generated successfully

npm test
Test Files  38 passed | 1 skipped (39)
Tests       200 passed | 1 skipped (201)
Start at    17:36:56
Duration    8.62s

npm run test:e2e
29 passed (42.3s)
```

跳过的仍是没有 `REDIS_INTEGRATION=1` 的 live Redis。`next typegen` 没有 `AUTH_SECRET` 仍能通过。`next dev` 和 `next start` 在密钥缺失、占位或过短时仍以 1 退出，原有测试还在。页面分数可以为负，热度把低于 0 的分数按 0，karma 两侧各自按 0 封底，这些测试没有改。

## 发现的问题

- 历史 `AUTH_SECRET` 仍在旧提交的树里。本轮没有重写历史。
- 默认业务库仍是 SQLite。默认限流仍是进程内存。生产可以改用 PostgreSQL、`RATE_LIMIT_BACKEND=redis`、`RANKING_BACKEND=sql`，这些不是仓库默认值。
- 邮箱验证默认关闭。`MAILER` 默认 `console`，信打在服务器日志里，不会送到真实邮箱。`MAILER=smtp` 可以换真实发信，CI 不依赖它。发信失败时账号留下并保持未验证，可以重发。
- 密码重置会把该用户的 `sessionVersion` 加 1，同一版本上的全部 cookie 一起失效，不能只踢掉其中一张。更换邮箱不加版本，旧会话还在。
- 更换邮箱不通知旧地址。发信失败时哈希留到下一次申请。确认链接本身就是凭证，不要求浏览器里仍然登录。
- 反对票可以把显示点数打成负数。热榜把 0 分以下当成 0 分。业力每一侧先压到 0，不会出现负业力。
- 评论第 11 到 16 层有橙色数字，缩进停在 120 像素，不再叠加左边框和内边距。第 1 到 10 层的边还在。数据上限仍是 16。
- 搜索折叠在 NFC 和 `toLowerCase` 之后把 `ß` 展成 `ss`，把 `ς` 收成 `σ`。合字和微米符号还没有按 Unicode 默认 case fold 展开。已经在库里的帖子要跑一次 `backfillSearchFolds`。搜索窗口仍只给排到当前页为止的行打分。
- `next typegen` 不检查 `AUTH_SECRET`。`next dev` 和 `next start` 会检查。
- 未登录折叠在这个浏览器的 `localStorage`。清站点数据或换浏览器会丢。
- `MAIL_LOG_PATH` 会把整封信写进文件。默认不设置。
- Prisma 的 SQLite `DateTime` 写不进大约公元 886 年以前，热度 SQL 因此到不了 `1e8` 小时以上的真实 `createdAt`。更大的年龄用同一段牛顿迭代在查询里比较，40 步在 `x = 1e12` 以内与 `x ** 1.8` 的相对误差小于 `1e-9`。
- 本文件这一笔提交的 CI 还没跑。阶段 4 的三个 job 已经成功。审计头的结果等这次 push 结束再记，不在它还在跑的时候另开一轮。

不开始第十一轮。
