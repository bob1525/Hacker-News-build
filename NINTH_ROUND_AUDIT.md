# 第九轮审计

本轮仍在分支 `cursor/hacker-news-community-1102` 上，对应 [PR #1](https://github.com/bob1525/Hacker-News-build/pull/1)。没有新开仓库，没有重写历史，没有 force push。默认业务库仍是 SQLite，默认限流仍是内存。`REQUIRE_EMAIL_VERIFICATION` 仍关闭，`MAILER` 默认仍是 `console`。

开工前按要求复跑了第八轮结束时的套件，头提交 `cf9088c194a2437a750ede60f098c555b87aadc0`。单元测试 171 passed、1 skipped，端到端 23 passed。数字与约定一致，之后才改代码。原有测试没有删除，没有注释断言，也没有放宽。

## 开工前的测试

2026-11-27 12:31 UTC，头提交 `cf9088c194a2437a750ede60f098c555b87aadc0`：

```text
npx vitest run
Test Files  31 passed | 1 skipped (32)
Tests       171 passed | 1 skipped (172)
Duration    5.47s

npx playwright test
23 passed (31.8s)
```

跳过的是没有 `REDIS_INTEGRATION=1` 的真实 Redis 测试。这 171 个单元测试和 23 个端到端测试都还在。本轮新增 15 个单元测试和 3 个端到端测试。171 + 15 = 186。23 + 3 = 26。

## 阶段完成情况

| 阶段 | 自检文档 | 提交 | 新增测试 |
| --- | --- | --- | --- |
| 1 发信 | [EMAIL_DELIVERY.md](EMAIL_DELIVERY.md) | `3bec96033388df1d9b41a5a1a56ac849a6ab342e` | 4 个单元 |
| 2 重置密码 | [PASSWORD_RESET.md](PASSWORD_RESET.md) | `796fbf996709fc13451c34ba3abe444582375a23` | 5 个单元 |
| 3 搜索折叠 | [SEARCH_UNICODE.md](SEARCH_UNICODE.md) | `e0794c358f812aa86bd607f0eb64421cfe4edd51` | 3 个单元 |
| 4 遗留限制 | [LEFTOVER_HARDENING_V2.md](LEFTOVER_HARDENING_V2.md) | `0d1b5b5669de2aff98ace7b50fa58ed0f4979e89` | 3 个单元、3 个端到端 |
| 5 本审计 | [NINTH_ROUND_AUDIT.md](NINTH_ROUND_AUDIT.md) | `7af6b374fa4bbd69a06f24e6845ee5d0c74eb548` | 0 |

### 阶段 1

`MAILER=smtp` 走 nodemailer。默认仍是 `console`，CI 不连接付费邮件服务。注册时如果信发不出去，账号留下、保持未验证，验证信可以重发。成功和失败两条路都有测试。原有邮箱验证测试仍在。

这一阶段的 push 运行 [45999900777](https://github.com/bob1525/Hacker-News-build/actions/runs/45999900777) 被后面的 push 取消。同一提交的 pull_request 运行 [45999909604](https://github.com/bob1525/Hacker-News-build/actions/runs/45999909604) 结论 success：

| job | 结果 |
| --- | --- |
| `test` [140508593878](https://github.com/bob1525/Hacker-News-build/actions/runs/45999909604/job/140508593878) | success |
| `postgres` [140508593250](https://github.com/bob1525/Hacker-News-build/actions/runs/45999909604/job/140508593250) | success |
| `redis` [140508593691](https://github.com/bob1525/Hacker-News-build/actions/runs/45999909604/job/140508593691) | success |

### 阶段 2

密码重置链接 1 小时过期，库里只存 SHA-256。同一邮箱 10 分钟最多 3 次。成功后旧密码不能再登录。生产路径不打印明文令牌。没有因此打开强制邮箱验证。未知邮箱和已知邮箱的页面提示一样。

push 运行 [46000226403](https://github.com/bob1525/Hacker-News-build/actions/runs/46000226403) 和 pull_request 运行 [46000234385](https://github.com/bob1525/Hacker-News-build/actions/runs/46000234385) 结论都是 success：

| job | push | pull_request |
| --- | --- | --- |
| `test` | success [140509724289](https://github.com/bob1525/Hacker-News-build/actions/runs/46000226403/job/140509724289) | success [140509707096](https://github.com/bob1525/Hacker-News-build/actions/runs/46000234385/job/140509707096) |
| `postgres` | success [140509724930](https://github.com/bob1525/Hacker-News-build/actions/runs/46000226403/job/140509724930) | success [140509707167](https://github.com/bob1525/Hacker-News-build/actions/runs/46000234385/job/140509707167) |
| `redis` | success [140509724739](https://github.com/bob1525/Hacker-News-build/actions/runs/46000226403/job/140509724739) | success [140509706647](https://github.com/bob1525/Hacker-News-build/actions/runs/46000234385/job/140509706647) |

### 阶段 3

搜索只保留 `foldSearchText`（NFC 再 `toLowerCase`）。SQL 比较 `titleFold` 和 `textFold`，不再调用 `lower()`，也没有第二份相关度公式。

push 运行 [46000649542](https://github.com/bob1525/Hacker-News-build/actions/runs/46000649542) 和 pull_request 运行 [46000657973](https://github.com/bob1525/Hacker-News-build/actions/runs/46000657973) 结论都是 success：

| job | push | pull_request |
| --- | --- | --- |
| `test` | success [140511115379](https://github.com/bob1525/Hacker-News-build/actions/runs/46000649542/job/140511115379) | success [140511142881](https://github.com/bob1525/Hacker-News-build/actions/runs/46000657973/job/140511142881) |
| `postgres` | success [140511115789](https://github.com/bob1525/Hacker-News-build/actions/runs/46000649542/job/140511115789) | success [140511143280](https://github.com/bob1525/Hacker-News-build/actions/runs/46000657973/job/140511143280) |
| `redis` | success [140511115828](https://github.com/bob1525/Hacker-News-build/actions/runs/46000649542/job/140511115828) | success [140511143263](https://github.com/bob1525/Hacker-News-build/actions/runs/46000657973/job/140511143263) |

### 阶段 4

SQLite 热度的牛顿迭代加到 40 步，和内存里的 `hotScore` 比过很大的年龄。评论第 11 到 16 层用橙色数字区分，缩进上限仍是 120 像素。README 正文写了可选邮箱验证和 downvote。端到端新增 downvote、验证重发和第 11 层标记。`votes.spec.ts` 仍要求分数变化 1 再回到原值。

本地复跑见 [LEFTOVER_HARDENING_V2.md](LEFTOVER_HARDENING_V2.md)。push 运行 [46003036264](https://github.com/bob1525/Hacker-News-build/actions/runs/46003036264) 和 pull_request 运行 [46003044331](https://github.com/bob1525/Hacker-News-build/actions/runs/46003044331) 结论都是 success：

| job | push | pull_request |
| --- | --- | --- |
| `test` | success [140519245411](https://github.com/bob1525/Hacker-News-build/actions/runs/46003036264/job/140519245411) | success [140519272295](https://github.com/bob1525/Hacker-News-build/actions/runs/46003044331/job/140519272295) |
| `postgres` | success [140519245323](https://github.com/bob1525/Hacker-News-build/actions/runs/46003036264/job/140519245323) | success [140519271919](https://github.com/bob1525/Hacker-News-build/actions/runs/46003044331/job/140519271919) |
| `redis` | success [140519245332](https://github.com/bob1525/Hacker-News-build/actions/runs/46003036264/job/140519245332) | success [140519272483](https://github.com/bob1525/Hacker-News-build/actions/runs/46003044331/job/140519272483) |

### 阶段 5

本文件，加上 README 里第九轮五份文档的索引。没有新增测试。全量套件在阶段 4 提交上复跑过，见下一节。`7af6b37` 只改文档，它的三个 job 记在「如何验证」下面。

## 如何验证

```bash
npx vitest run
npx playwright test
env -u AUTH_SECRET npm run typecheck
```

CI 看 `test`、`postgres`、`redis` 三个 job。阶段 1 到 4 的运行都已成功，链接在上面各阶段里。含全部代码的头是阶段 4 的 `0d1b5b5669de2aff98ace7b50fa58ed0f4979e89`。

审计提交 `7af6b374fa4bbd69a06f24e6845ee5d0c74eb548` 只改了 README 索引和本文件。它的 push 运行 [46003601292](https://github.com/bob1525/Hacker-News-build/actions/runs/46003601292) 和 pull_request 运行 [46003610002](https://github.com/bob1525/Hacker-News-build/actions/runs/46003610002) 结论都是 success：

| job | push | pull_request |
| --- | --- | --- |
| `test` | success [140521122815](https://github.com/bob1525/Hacker-News-build/actions/runs/46003601292/job/140521122815) | success [140521151763](https://github.com/bob1525/Hacker-News-build/actions/runs/46003610002/job/140521151763) |
| `postgres` | success [140521122841](https://github.com/bob1525/Hacker-News-build/actions/runs/46003601292/job/140521122841) | success [140521152221](https://github.com/bob1525/Hacker-News-build/actions/runs/46003610002/job/140521152221) |
| `redis` | success [140521122411](https://github.com/bob1525/Hacker-News-build/actions/runs/46003601292/job/140521122411) | success [140521152162](https://github.com/bob1525/Hacker-News-build/actions/runs/46003610002/job/140521152162) |

## 结果证据

2026-11-27 12:57 UTC，提交 `0d1b5b5669de2aff98ace7b50fa58ed0f4979e89`：

```text
npx vitest run
Test Files  34 passed | 1 skipped (35)
Tests       186 passed | 1 skipped (187)
Start at    12:57:20
Duration    6.31s

npx playwright test
26 passed (35.5s)

env -u AUTH_SECRET npm run typecheck
Generating route types...
✓ Route types generated successfully
```

`next typegen` 没有 `AUTH_SECRET` 仍能通过。`next dev` 和 `next start` 在密钥缺失、占位或过短时仍以 1 退出，原有测试还在。

## 剩余限制

- 历史 `AUTH_SECRET` 仍在旧提交的树里。本轮没有重写历史。
- 默认业务库仍是 SQLite。默认限流仍是进程内存。生产可以改用 PostgreSQL、`RATE_LIMIT_BACKEND=redis`、`RANKING_BACKEND=sql`，这些不是仓库默认值。
- 邮箱验证默认关闭。`MAILER` 默认 `console`，信打在服务器日志里，不会送到真实邮箱。`MAILER=smtp` 可以换真实发信，CI 不依赖它。发信失败时账号留下并保持未验证，可以重发。
- 密码重置不撤销已经发出的 JWT。拿到重置链接之前签下的 cookie，在过期前仍然有效。
- 反对票可以把显示点数打成负数。热榜把 0 分以下当成 0 分。业力每一侧先压到 0，不会出现负业力。
- 评论第 11 到 16 层有橙色数字，缩进增量是 0。每一层原有的左边框和内边距还在，所以它们会比上一层再靠右大约 9 像素。数据上限仍是 16。
- 搜索折叠是 NFC 加 `toLowerCase`。`ß` 和 `SS` 仍然不相等。已经在库里、折叠列还是空的帖子要跑 `backfillSearchFolds`。搜索窗口仍只给排到当前页为止的行打分。
- `next typegen` 不检查 `AUTH_SECRET`。`next dev` 和 `next start` 会检查。
- 未登录折叠在这个浏览器的 `localStorage`。清站点数据或换浏览器会丢。
- Prisma 的 SQLite `DateTime` 写不进大约公元 886 年以前，热度 SQL 因此到不了 `1e8` 小时以上的真实 `createdAt`。更大的年龄用同一段牛顿迭代在查询里比较，40 步在 `x = 1e12` 以内与 `x ** 1.8` 的相对误差小于 `1e-9`。

不开始第十轮。
