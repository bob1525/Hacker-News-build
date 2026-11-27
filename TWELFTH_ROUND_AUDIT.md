# 第十二轮审计

本轮仍在分支 `cursor/hacker-news-community-1102` 上，对应 [PR #1](https://github.com/bob1525/Hacker-News-build/pull/1)。没有新开仓库，没有重写历史，没有 force push，没有合并。默认业务库仍是 SQLite，默认限流仍是内存。`RANKING_BACKEND` 默认仍是 `memory`，`MAILER` 默认仍是 `console`。`REQUIRE_EMAIL_VERIFICATION` 仍关闭。

开工前在第十一轮头提交 `671db349843c2711a1657b99a8fc2ddd761f87b5` 上复跑过套件：单元测试 211 passed、1 skipped，端到端 31 passed。数字与约定一致，之后才改代码。原有测试没有删除，没有注释断言，也没有放宽。本轮新增 16 个单元测试和 2 个端到端测试。211 + 16 = 227。31 + 2 = 33。

## 做了什么

| 阶段 | 自检文档 | 提交 | 新增测试 |
| --- | --- | --- | --- |
| 1 按设备撤销 | [SESSION_DEVICES.md](SESSION_DEVICES.md) | `89603c7e5511a03bb634f0b309ae8c10f05ad72a` | 7 个单元 |
| 2 剩余全折叠 | [SEARCH_FOLD_V3.md](SEARCH_FOLD_V3.md) | `531790e3df073b7b8d5f044a34d6bb2201a134e4` | 3 个单元 |
| 3 合并访客折叠 | [COLLAPSE_SYNC.md](COLLAPSE_SYNC.md) | `656c5bebe2c8f21abf66ad0918337b85c269aec2` | 3 个单元 |
| 4 生产日志与端到端 | [LEFTOVER_HARDENING_V5.md](LEFTOVER_HARDENING_V5.md) | `afb4ce627be5e55d3c11eec804b7bc240cf391b5` | 3 个单元、2 个端到端 |
| 5 本审计 | [TWELFTH_ROUND_AUDIT.md](TWELFTH_ROUND_AUDIT.md) | `cdac0a07bb7a9a296fd2c550ce8a6a2d2ed832ca` | 0 |

阶段 1：新增 `Session` 表。JWT 带 `sid`。个人页列出仍有效的设备，可以只撤销其中一台，不增加 `sessionVersion`。没有 `sid` 的旧 cookie 即使版本匹配也按 `legacy` 拒绝。密码重置、确认换邮箱和「Sign out other devices」仍加版本，并撤销该用户尚未作废的设备行。SQLite 迁移 `20261127180000_session`，PostgreSQL `prisma/migrations-postgres/0009_session.sql`。`session-revoke` 里旧 cookie 的断言加上了 `sessionId: null`，版本匹配没有放宽。

阶段 2：`foldSearchText` 仍是唯一折叠。补上 `ΐ`、`ΰ`、`ŉ`、`ǰ`、`ẖ`、`ẗ`、`ẘ`、`ẙ`、`ẚ`。展开后不再 NFC。折叠后不足 2 个字符的词丢掉，所以单独的 `µ` 搜不到，`ΐ` 展开成 3 个码位会留下。`npm run search:backfill` 先数过期折叠，再重写，再数一次。`ß` / `ς` 和第十一轮折叠测试没有改。

阶段 3：未登录折叠仍在 `localStorage`。登录后 `mergeGuestCollapses` 把这份列表并进已有的 `CommentCollapse`。一次最多 100 个 id，只接受库里存在的评论，再跑一次不会多出一行。没有另开一套存储。

阶段 4：生产环境的 console 标准输出和 `MAIL_LOG_PATH` 都只留收件人和主题。非生产仍写全文。端到端的令牌从本机 SMTP 收件箱读取，应用里没有生产环境写回令牌的开关。新增单独撤设备和登录后折叠仍在的端到端。截图 `docs/screenshots/devices.png`、`docs/screenshots/collapse-sync.png`。

阶段 5：本文件，加上 README 里第十二轮五份文档的索引。没有新增测试。审计正文在 `cdac0a07bb7a9a296fd2c550ce8a6a2d2ed832ca`。这一笔只补上该提交的 CI，没有改测试。不开始第十三轮。

## 怎么验证

开工前的基线记在 [SESSION_DEVICES.md](SESSION_DEVICES.md)。阶段 4 头 `afb4ce627be5e55d3c11eec804b7bc240cf391b5` 的本地结果：

```text
npm test
Test Files  43 passed | 1 skipped (44)
Tests       227 passed | 1 skipped (228)
Start at    18:34:20
Duration    10.07s

npm run lint
eslint . 通过

unset AUTH_SECRET; npm run typecheck
next typegen && tsc --noEmit 通过

npm run test:e2e
33 passed (46.7s)
```

CI 看 `test`、`postgres`、`redis` 三个 job。本机没有 PostgreSQL，也没有为 `REDIS_INTEGRATION=1` 起 Redis。四个阶段的 push 和 pull_request 都已结束，结论都是 success。

阶段 1 提交 `89603c7e5511a03bb634f0b309ae8c10f05ad72a`：

push 运行 [46048032882](https://github.com/bob1525/Hacker-News-build/actions/runs/46048032882)：`test` [140672095723](https://github.com/bob1525/Hacker-News-build/actions/runs/46048032882/job/140672095723)、`postgres` [140672096089](https://github.com/bob1525/Hacker-News-build/actions/runs/46048032882/job/140672096089)、`redis` [140672096274](https://github.com/bob1525/Hacker-News-build/actions/runs/46048032882/job/140672096274)。

pull_request 运行 [46048043657](https://github.com/bob1525/Hacker-News-build/actions/runs/46048043657)：`test` [140672128361](https://github.com/bob1525/Hacker-News-build/actions/runs/46048043657/job/140672128361)、`postgres` [140672128695](https://github.com/bob1525/Hacker-News-build/actions/runs/46048043657/job/140672128695)、`redis` [140672128553](https://github.com/bob1525/Hacker-News-build/actions/runs/46048043657/job/140672128553)。

阶段 2 提交 `531790e3df073b7b8d5f044a34d6bb2201a134e4`：

push 运行 [46048354563](https://github.com/bob1525/Hacker-News-build/actions/runs/46048354563)：`test` [140673153814](https://github.com/bob1525/Hacker-News-build/actions/runs/46048354563/job/140673153814)、`postgres` [140673153289](https://github.com/bob1525/Hacker-News-build/actions/runs/46048354563/job/140673153289)、`redis` [140673153608](https://github.com/bob1525/Hacker-News-build/actions/runs/46048354563/job/140673153608)。

pull_request 运行 [46048361530](https://github.com/bob1525/Hacker-News-build/actions/runs/46048361530)：`test` [140673178448](https://github.com/bob1525/Hacker-News-build/actions/runs/46048361530/job/140673178448)、`postgres` [140673178555](https://github.com/bob1525/Hacker-News-build/actions/runs/46048361530/job/140673178555)、`redis` [140673178188](https://github.com/bob1525/Hacker-News-build/actions/runs/46048361530/job/140673178188)。

阶段 3 提交 `656c5bebe2c8f21abf66ad0918337b85c269aec2`：

push 运行 [46048700552](https://github.com/bob1525/Hacker-News-build/actions/runs/46048700552)：`test` [140674331276](https://github.com/bob1525/Hacker-News-build/actions/runs/46048700552/job/140674331276)、`postgres` [140674331600](https://github.com/bob1525/Hacker-News-build/actions/runs/46048700552/job/140674331600)、`redis` [140674331646](https://github.com/bob1525/Hacker-News-build/actions/runs/46048700552/job/140674331646)。

pull_request 运行 [46048709197](https://github.com/bob1525/Hacker-News-build/actions/runs/46048709197)：`test` [140674360372](https://github.com/bob1525/Hacker-News-build/actions/runs/46048709197/job/140674360372)、`postgres` [140674360133](https://github.com/bob1525/Hacker-News-build/actions/runs/46048709197/job/140674360133)、`redis` [140674360051](https://github.com/bob1525/Hacker-News-build/actions/runs/46048709197/job/140674360051)。

阶段 4 提交 `afb4ce627be5e55d3c11eec804b7bc240cf391b5`：

push 运行 [46050767346](https://github.com/bob1525/Hacker-News-build/actions/runs/46050767346) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140681201034](https://github.com/bob1525/Hacker-News-build/actions/runs/46050767346/job/140681201034) | success |
| `postgres` [140681200946](https://github.com/bob1525/Hacker-News-build/actions/runs/46050767346/job/140681200946) | success |
| `redis` [140681200633](https://github.com/bob1525/Hacker-News-build/actions/runs/46050767346/job/140681200633) | success |

pull_request 运行 [46050779855](https://github.com/bob1525/Hacker-News-build/actions/runs/46050779855) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140681242012](https://github.com/bob1525/Hacker-News-build/actions/runs/46050779855/job/140681242012) | success |
| `postgres` [140681242264](https://github.com/bob1525/Hacker-News-build/actions/runs/46050779855/job/140681242264) | success |
| `redis` [140681242230](https://github.com/bob1525/Hacker-News-build/actions/runs/46050779855/job/140681242230) | success |

审计提交 `cdac0a07bb7a9a296fd2c550ce8a6a2d2ed832ca` 只改了 README 索引和本文件。它的 push 运行 [46051228402](https://github.com/bob1525/Hacker-News-build/actions/runs/46051228402) 和 pull_request 运行 [46051234801](https://github.com/bob1525/Hacker-News-build/actions/runs/46051234801) 结论都是 success：

| job | push | pull_request |
| --- | --- | --- |
| `test` | success [140682747692](https://github.com/bob1525/Hacker-News-build/actions/runs/46051228402/job/140682747692) | success [140682769259](https://github.com/bob1525/Hacker-News-build/actions/runs/46051234801/job/140682769259) |
| `postgres` | success [140682747957](https://github.com/bob1525/Hacker-News-build/actions/runs/46051228402/job/140682747957) | success [140682768863](https://github.com/bob1525/Hacker-News-build/actions/runs/46051234801/job/140682768863) |
| `redis` | success [140682748037](https://github.com/bob1525/Hacker-News-build/actions/runs/46051228402/job/140682748037) | success [140682769110](https://github.com/bob1525/Hacker-News-build/actions/runs/46051234801/job/140682769110) |

## 证据

2026-11-27 18:09 UTC，改代码之前，头提交 `671db34`：

```text
npm test
Test Files  40 passed | 1 skipped (41)
Tests       211 passed | 1 skipped (212)
Start at    18:09:41
Duration    9.39s

npm run test:e2e
31 passed (44.8s)
```

2026-11-27 18:34 UTC，阶段 4 代码，随后连同本文件一起推送之前的本地结果见上面的 227 / 33。跳过的仍是没有 `REDIS_INTEGRATION=1` 的 live Redis。`next typegen` 没有 `AUTH_SECRET` 仍能通过。`next dev` 和 `next start` 在密钥缺失、占位或过短时仍以 1 退出。页面分数可以为负，热度把低于 0 的分数按 0，karma 两侧各自按 0 封底，这些测试没有改。

这次端到端的 `/tmp/hn-e2e-server.log` 没有 `token=`。`/tmp/hn-e2e-mail.log` 是 `[body omitted]`。确认链接来自本机 SMTP 收件箱。

## 发现的问题

- 历史 `AUTH_SECRET` 仍在旧提交的树里。本轮没有重写历史。
- 默认业务库仍是 SQLite。默认限流仍是进程内存。生产可以改用 PostgreSQL、`RATE_LIMIT_BACKEND=redis`、`RANKING_BACKEND=sql`，这些不是仓库默认值。
- 邮箱验证默认关闭。`MAILER` 默认 `console`。`NODE_ENV=production` 时标准输出和 `MAIL_LOG_PATH` 都只记收件人和主题。非生产环境仍写全文。
- 没有 `sid` 的旧 cookie 必须重新登录。单独撤销一台设备不增加 `sessionVersion`。密码重置、确认换邮箱和「Sign out other devices」仍会把同一版本的其它 cookie 一起作废。
- `lastSeenAt` 在打开会话时写入，超过一分钟才会再更新。
- 反对票可以把显示点数打成负数。热榜把 0 分以下当成 0 分。业力每一侧先压到 0，不会出现负业力。
- 搜索折叠仍只在 `foldSearchText`。亚美尼亚连字和希腊语带 prosgegrammeni 的字母还没有展开。单独一个 `µ` 折成 `μ` 后因为不足 2 个字符而被丢掉。
- 未登录折叠仍先写在本机 `localStorage`。登录后按最多 100 条、只接受存在的评论 id、可重复执行的规则并进账号。
- 搜索窗口仍只给排到当前页为止的行打分。
- `next typegen` 不检查 `AUTH_SECRET`。`next dev` 和 `next start` 会检查。
- Prisma 的 SQLite `DateTime` 写不进大约公元 886 年以前。
- 审计头 `cdac0a0` 的 `test`、`postgres`、`redis` 已经成功。这一笔只把那次结果写进本文件，不再为记录提交本身另开一轮。

本轮在阶段 5 结束。不开始第十三轮。
