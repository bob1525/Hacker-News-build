# 第九轮阶段 4：热度精度、深层评论、说明和端到端

## 做了什么

SQLite 热度里的牛顿迭代从 20 步加到 40 步。`(ageHours + 2) ^ 1.8` 仍是 `x^9` 的五次方根，和内存公式是同一个式子，没有在 SQL 里再写一份相关度或另一套热度。`pageHotPostIds`、`sqliteHotExponent` 和 `sqliteHotOrder` 共用这一段 CTE。20 步在 `x` 远大于 100000 之后会漂：大约在 `1e8` 处相对误差 `5e-9`，在 `1e9` 处大约 `6e-3`，会把一组很接近的帖子排反。40 步把相对误差压到 `1e-12` 附近，至少到 `x = 1e12`。

评论第 11 到 16 层不再靠把缩进加到 120 像素以外来区分。`commentIndentPx` 仍是总缩进，第 10 层和第 16 层都是 120。嵌套行用 `commentIndentStepPx` 只加上这一层该有的差值，所以各层 margin 加起来等于这个总缩进，第 11 层起增量为 0。作者名前面加一个橙色数字（11 到 16 各不相同）。

README 正文（功能列表和评论一节，不只是文末索引）写明：邮箱验证默认关闭，`MAILER` 默认 `console`，发信失败账号仍留下且未验证，可以重发；downvote 后页面分数可以为负，热度把低于 0 的分数按 0，karma 按帖子和评论两侧各自低于 0 时按 0，downvote 至少需要 1 点 karma。

端到端没有改原来的投票断言。`votes.spec.ts` 仍要求分数变化正好为 1，再点一次回到原分，自己的帖子没有投票按钮。新增 downvote 切换、验证页重发，以及第 11 层橙色数字。

没有改这些已经测过的规则：页面分数可以为负，热度把低于 0 的分数按 0，karma 两侧各自按 0 封底。默认数据库仍是 SQLite，默认限流仍是内存，`REQUIRE_EMAIL_VERIFICATION` 仍关闭，`MAILER` 仍是 `console`。

## 如何验证

```bash
npx vitest run
npx eslint lib/domain/ranking-sql.ts lib/domain/comments.ts components/comment-thread.tsx tests/unit/ranking-sql.test.ts tests/unit/comment-depth.test.ts tests/e2e/downvotes.spec.ts tests/e2e/verification.spec.ts tests/e2e/comment-depth.spec.ts tests/e2e/helpers.ts
env -u AUTH_SECRET npm run typecheck
npx playwright test
```

Playwright 用本机 Chrome 把第 11 层评论真正发出去，再读橙色数字和 `margin-left`。原来的 23 条端到端断言没有改写。

## 结果证据

2026-11-27 12:57 UTC：

```text
npx vitest run
Test Files  34 passed | 1 skipped (35)
Tests       186 passed | 1 skipped (187)
Start at    12:57:20
Duration    6.31s

npx eslint …通过
env -u AUTH_SECRET npm run typecheck
Generating route types...
✓ Route types generated successfully
通过（步长函数写完后又跑了一次，仍通过）

npx playwright test
26 passed (35.5s)
```

跳过的仍是未设置 `REDIS_INTEGRATION=1` 的 live Redis。本阶段在原有测试之外新增 6 个：

1. 年龄约 114 年、570 年和 1140 年的帖子，SQL 热度顺序与内存 `sortByHot` 相同。这是 Prisma 还能写入的最老一档。
2. `x` 取 2、100000、`1e8`、`1e9`、`1e12` 时，同一段牛顿 SQL 的结果与 `x ** 1.8` 的相对误差小于 `1e-9`。再用这套 SQL 排一组年龄到 `1e12` 的行，顺序与 `hotScore` 一致，并且是 `mid`、`close-old`、`close-new`、`ancient`。20 步会把 `close-old` 和 `close-new` 排反。
3. 第 10 层没有层数标记，缩进仍是 120。第 11 到 16 层标记分别是 `11` 到 `16`，缩进仍是 120，增量是 0。从第 0 层加到第 16 层的增量之和是 120。
4. 端到端：`patio11` 对最新帖 downvote，分数减少 1，再点一次回到原分。
5. 端到端：新注册用户保持登录，打开 `/verify` 看到验证说明，重发后看到 `Verification email sent.`
6. 端到端：连续回复到第 11 层，该层橙色数字是 `11`，自身 `margin-left` 是 `0px`；第 10 层没有这个数字，`margin-left` 是 `12px`。

`votes.spec.ts` 的两条断言原样通过：分数变化的绝对值是 1，再点一次回到原分；自己的帖子上按钮数是 0。

## 发现的问题

- Prisma 的 SQLite `DateTime` 写不进大约公元 886 年以前的时间，对应年龄大约是 `1e7` 小时。比这更老的热度只能用同一段牛顿 SQL 在内存里造行来比，真实的 `createdAt` 列到不了 `1e8` 以上。
- 第 11 到 16 层的缩进增量是 0，但每一层仍有原有的左边框和 `pl-2`，所以它们还会比上一层再靠右大约 9 像素。分开它们的是橙色数字，不是把 120 像素的上限再加大。
- 页面分数可以为负、热度对负分按 0、karma 两侧按 0 封底，这三条都没改。
