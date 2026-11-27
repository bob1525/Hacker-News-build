# 第十一轮审计

本轮仍在分支 `cursor/hacker-news-community-1102` 上，对应 [PR #1](https://github.com/bob1525/Hacker-News-build/pull/1)。没有新开仓库，没有重写历史，没有 force push，没有合并。默认业务库仍是 SQLite，默认限流仍是内存。`RANKING_BACKEND` 默认仍是 `memory`，`MAILER` 默认仍是 `console`。`REQUIRE_EMAIL_VERIFICATION` 仍关闭。

开工前在第十轮头提交 `d3387ef272ae6d690da4426b296ee81711a053d0` 上复跑过套件：单元测试 200 passed、1 skipped，端到端 29 passed。数字与约定一致，之后才改代码。原有测试没有删除，没有注释断言，也没有放宽。本轮新增 11 个单元测试和 2 个端到端测试。200 + 11 = 211。29 + 2 = 31。

## 做了什么

| 阶段 | 自检文档 | 提交 | 新增测试 |
| --- | --- | --- | --- |
| 1 旧地址通知 | [EMAIL_CHANGE_NOTIFY.md](EMAIL_CHANGE_NOTIFY.md) | `615439d2b1bf6407a88be08fe6314e796a5ebf95` | 2 个单元 |
| 2 退出其他设备 | [SESSION_MANAGEMENT.md](SESSION_MANAGEMENT.md) | `2f13c6ab6830db79b2a2ea1cf3dab71db4e089de` | 4 个单元 |
| 3 搜索全折叠 | [SEARCH_CASEFOLD.md](SEARCH_CASEFOLD.md) | `7162ddc33f652850d2d42cf62093ba3773850705` | 2 个单元 |
| 4 遗留限制 | [LEFTOVER_HARDENING_V4.md](LEFTOVER_HARDENING_V4.md) | `be46a7af8d708e1828574df4d763e802bbfe5b17` | 3 个单元、2 个端到端 |
| 5 本审计 | [ELEVENTH_ROUND_AUDIT.md](ELEVENTH_ROUND_AUDIT.md) | 本文件 | 0 |

阶段 1：申请更换邮箱时，确认信仍只发给新地址。送出之后给旧地址一封「Email change requested」。确认成功后再给旧地址一封「Your email was changed」。两封都不含令牌，也不含 `/change-email`。通知发不出去不挡住主流程。确认信发不出去时删掉这一次的令牌哈希。没有新迁移。

阶段 2：自己的主页可以「Sign out other devices」。`sessionVersion` 加 1，并按新版本给当前浏览器重签。确认更换邮箱的同一笔事务里也加 1。当前浏览器如果已经是这个用户，确认动作会重签它的 cookie。密码重置仍按原方式加版本，原有测试没有改断言。没有新迁移。

阶段 3：`foldSearchText` 仍是唯一折叠。补上合字 `ﬀ/ﬁ/ﬂ/ﬃ/ﬄ/ﬅ/ﬆ`、微米符号 `µ→μ`、长 s `ſ→s`，并显式映射开尔文 `K` 和埃号 `Å`。`ß` / `ς` 的原有测试还在。SQL 没有 `lower()`，也没有第二份相关度。`backfillSearchFolds` 重写对不上的旧折叠。没有新迁移。

阶段 4：`NODE_ENV=production` 时 `MAIL_LOG_PATH` 只记收件人、主题和 `[body omitted]`。非生产环境仍写全文，默认不设置这个路径。搜索深分页按页走完，和整表 `pageSearchResults` 一致，没有重复或遗漏，因此没有改打分。端到端覆盖退出其他设备和旧地址通知。截图 `docs/screenshots/sign-out-others.png`。

阶段 5：本文件，加上 README 里第十一轮五份文档的索引。没有新增测试。审计头自己的 CI 不在这一笔里；全绿之后另有一笔只把那次结果写进来。

## 怎么验证

开工前的基线记在 [EMAIL_CHANGE_NOTIFY.md](EMAIL_CHANGE_NOTIFY.md)。推送本文件之前，在阶段 4 头 `be46a7af8d708e1828574df4d763e802bbfe5b17` 上又跑了一遍：

```bash
npm run lint
env -u AUTH_SECRET npm run typecheck
npm test
npm run test:e2e
```

CI 看 `test`、`postgres`、`redis` 三个 job。本机没有 PostgreSQL，也没有为 `REDIS_INTEGRATION=1` 起 Redis。阶段 4 的两次运行已经结束，结论如下。

阶段 1 提交 `615439d2b1bf6407a88be08fe6314e796a5ebf95` 的 push [46044557550](https://github.com/bob1525/Hacker-News-build/actions/runs/46044557550) 和 pull_request [46044568663](https://github.com/bob1525/Hacker-News-build/actions/runs/46044568663) 被下一笔 push 取消。阶段 2 提交 `2f13c6ab6830db79b2a2ea1cf3dab71db4e089de` 的 push [46044752083](https://github.com/bob1525/Hacker-News-build/actions/runs/46044752083) 和 pull_request [46044759488](https://github.com/bob1525/Hacker-News-build/actions/runs/46044759488) 同样被取消。含这两阶段代码的阶段 3 运行是绿的。

阶段 3 提交 `7162ddc33f652850d2d42cf62093ba3773850705`：

push 运行 [46044936488](https://github.com/bob1525/Hacker-News-build/actions/runs/46044936488) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140661817603](https://github.com/bob1525/Hacker-News-build/actions/runs/46044936488/job/140661817603) | success |
| `postgres` [140661817984](https://github.com/bob1525/Hacker-News-build/actions/runs/46044936488/job/140661817984) | success |
| `redis` [140661817920](https://github.com/bob1525/Hacker-News-build/actions/runs/46044936488/job/140661817920) | success |

pull_request 运行 [46044946682](https://github.com/bob1525/Hacker-News-build/actions/runs/46044946682) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140661858709](https://github.com/bob1525/Hacker-News-build/actions/runs/46044946682/job/140661858709) | success |
| `postgres` [140661858990](https://github.com/bob1525/Hacker-News-build/actions/runs/46044946682/job/140661858990) | success |
| `redis` [140661859017](https://github.com/bob1525/Hacker-News-build/actions/runs/46044946682/job/140661859017) | success |

阶段 4 提交 `be46a7af8d708e1828574df4d763e802bbfe5b17`：

push 运行 [46045606743](https://github.com/bob1525/Hacker-News-build/actions/runs/46045606743) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140663975314](https://github.com/bob1525/Hacker-News-build/actions/runs/46045606743/job/140663975314) | success |
| `postgres` [140663974876](https://github.com/bob1525/Hacker-News-build/actions/runs/46045606743/job/140663974876) | success |
| `redis` [140663975196](https://github.com/bob1525/Hacker-News-build/actions/runs/46045606743/job/140663975196) | success |

pull_request 运行 [46045613935](https://github.com/bob1525/Hacker-News-build/actions/runs/46045613935) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140663999249](https://github.com/bob1525/Hacker-News-build/actions/runs/46045613935/job/140663999249) | success |
| `postgres` [140663999174](https://github.com/bob1525/Hacker-News-build/actions/runs/46045613935/job/140663999174) | success |
| `redis` [140663998716](https://github.com/bob1525/Hacker-News-build/actions/runs/46045613935/job/140663998716) | success |

## 证据

2026-11-27 17:45 UTC，改代码之前，头提交 `d3387ef`：

```text
npm test
Test Files  38 passed | 1 skipped (39)
Tests       200 passed | 1 skipped (201)
Start at    17:45:01
Duration    8.00s

npm run test:e2e
29 passed (40.5s)
```

2026-11-27 17:59 UTC，推送本文件之前，头提交 `be46a7a`：

```text
npm run lint
eslint .

env -u AUTH_SECRET npm run typecheck
Generating route types...
✓ Route types generated successfully

npm test
Test Files  40 passed | 1 skipped (41)
Tests       211 passed | 1 skipped (212)
Start at    17:59:20
Duration    8.43s

npm run test:e2e
31 passed (42.4s)
```

跳过的仍是没有 `REDIS_INTEGRATION=1` 的 live Redis。`next typegen` 没有 `AUTH_SECRET` 仍能通过。`next dev` 和 `next start` 在密钥缺失、占位或过短时仍以 1 退出，原有测试还在。页面分数可以为负，热度把低于 0 的分数按 0，karma 两侧各自按 0 封底，这些测试没有改。

## 发现的问题

- 历史 `AUTH_SECRET` 仍在旧提交的树里。本轮没有重写历史。
- 默认业务库仍是 SQLite。默认限流仍是进程内存。生产可以改用 PostgreSQL、`RATE_LIMIT_BACKEND=redis`、`RANKING_BACKEND=sql`，这些不是仓库默认值。
- 邮箱验证默认关闭。`MAILER` 默认 `console`。非 test 时全文仍打在进程标准输出。`MAILER=smtp` 可以换真实发信，CI 不依赖它。
- `MAIL_LOG_PATH` 默认不设置。非生产环境会把全文追加到文件。`NODE_ENV=production` 时这个文件只记收件人和主题，正文写成 `[body omitted]`。
- 密码重置和确认更换邮箱都会把 `sessionVersion` 加 1，同一版本上的其他 cookie 一起失效。「Sign out other devices」同样加 1，并给当前浏览器重签。不能只踢掉其中一张旧 cookie。
- 更换邮箱的两封旧地址通知不含令牌和确认链接。通知失败不回滚。确认信失败会删掉这次的令牌哈希。
- 反对票可以把显示点数打成负数。热榜把 0 分以下当成 0 分。业力每一侧先压到 0，不会出现负业力。
- 评论第 11 到 16 层有橙色数字，缩进停在 120 像素，不再叠加左边框和内边距。数据上限仍是 16。
- 搜索折叠在 `foldSearchText` 一处。除了 `ß` 和 `ς`，还展开合字、微米符号、长 s、开尔文和埃号。`ΐ` / `ΰ` 这次没有展开。单独一个 `µ` 仍因搜索词至少 2 个字符而被丢掉。已经在库里的帖子要跑一次 `backfillSearchFolds`。
- 搜索窗口仍只给排到当前页为止的行打分。深分页和整表排序对过，没有重复或遗漏。
- `next typegen` 不检查 `AUTH_SECRET`。`next dev` 和 `next start` 会检查。
- 未登录折叠在这个浏览器的 `localStorage`。清站点数据或换浏览器会丢。
- Prisma 的 SQLite `DateTime` 写不进大约公元 886 年以前，热度 SQL 因此到不了 `1e8` 小时以上的真实 `createdAt`。更大的年龄用同一段牛顿迭代在查询里比较，40 步在 `x = 1e12` 以内与 `x ** 1.8` 的相对误差小于 `1e-9`。

本轮在阶段 5 结束。
