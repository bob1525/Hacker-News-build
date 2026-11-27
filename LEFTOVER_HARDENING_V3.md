# 第十轮阶段 4：深层评论边距、截图和账号流程

## 做了什么

第 11 到 16 层的缩进步长已经是 0，但每一层嵌套仍带着左边框和 `pl-2`，大约再往右 9 像素。`commentThreadGutter` 只在缩进还在变宽时保留这条边。到顶之后边框和内边距都去掉，橙色层数标记和 16 层上限保留。120 像素的缩进上限没有改。

`scripts/capture-screenshots.mjs` 补了反对票、邮箱验证、忘记密码、重置密码、更换邮箱和第 11 层评论的图。README 指向 `docs/screenshots/` 里更新后的文件。

端到端覆盖了无效的重置和换邮箱链接、一封邮件里的重置链接（新密码能登录，旧密码不能）、以及确认前旧邮箱保持不变。控制台邮件器只在设置了 `MAIL_LOG_PATH` 时把信追加到文件。默认不设置，`MAILER` 仍是 `console`。端到端进程才设置这个路径，用来读出测试信里的令牌。

## 如何验证

```bash
npx vitest run tests/unit/comment-depth.test.ts tests/unit/mail-log.test.ts tests/unit/ranking.test.ts
npx eslint lib/domain/comments.ts lib/mailer.ts components/comment-thread.tsx tests/unit/comment-depth.test.ts tests/unit/mail-log.test.ts tests/e2e/account-recovery.spec.ts tests/e2e/comment-depth.spec.ts
npx playwright test
DATABASE_URL="file:/tmp/hn-screenshots.db" npx prisma migrate deploy
DATABASE_URL="file:/tmp/hn-screenshots.db" npx tsx prisma/seed.ts
DATABASE_URL="file:/tmp/hn-screenshots.db" AUTH_SECRET="screenshot-secret-key-not-for-production" npx next start --hostname 127.0.0.1 --port 3000
node scripts/capture-screenshots.mjs
```

## 结果证据

2026-11-27 13:18 UTC：

```text
npx vitest run tests/unit/comment-depth.test.ts tests/unit/mail-log.test.ts tests/unit/ranking.test.ts
Test Files  3 passed (3)
Tests       12 passed (12)
Start at    13:18:24
Duration    1.09s

npx eslint …通过
```

评论深度现在是 5 个测试，其中新增「缩进停住后去掉嵌套边框」。第 1 层和第 10 层仍有边，第 11 到 16 层没有，标记仍是 11 到 16，第 16 层缩进仍是 120。排名测试 6 个仍通过。邮件日志测试确认只有设置了 `MAIL_LOG_PATH` 才写文件。

第一次端到端在重置后的退出还没完成时就打开登录页，会话还在，页面被重定向走，等用户名输入框超时。测试改成先等到页头出现 login 再打开登录页，没有改断言。

2026-11-27 13:20 UTC 重跑：

```text
npx playwright test
Running 29 tests using 1 worker
29 passed (40.6s)
```

原有 26 个都在这 29 个里面，包括评论深度、反对票、投票和验证。新增 3 个：无效链接、密码重置、邮箱更换。评论深度那条原测试额外确认第 11 层 `data-comment-gutter` 是 false，第 10 层是 true，原有的 0px 和 12px 断言还在。

截图脚本写出 `downvote.png`、`verify.png`、`forgot-password.png`、`reset-password.png`、`email-change.png`、`comment-depth.png`，并刷新了原来的首页、登录、发帖、搜索、主页和窄屏图。反对票图上分数是 -1，橙色向下箭头亮着。深层评论图上有橙色的 11，再往下没有继续往右挪。

## 发现的问题

- 第 1 到 10 层仍有左边框和内边距。那是线程线，不是到顶之后的多余位移。
- `MAIL_LOG_PATH` 会把整封信写进文件，里面有令牌。默认关闭。生产不要设置它。`next start` 在测试环境之外仍会把控制台邮件打到标准输出。
- 深层评论的截图滚到第 11 层，画面里看不到根评论。
- 截图用的是 `/tmp/hn-screenshots.db`，不进仓库。
