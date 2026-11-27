# 第十二轮阶段 4：生产日志不写令牌，并补上这轮的端到端

## 做了什么

`NODE_ENV=production` 时，`mailStdoutLine` 和 `MAIL_LOG_PATH` 一样只留下收件人和主题。非生产环境的标准输出仍写全文。`MAILER` 默认还是 `console`。SMTP 发送成功后也走同一条记录函数，所以生产环境里这条路同样不把正文打出来。`MailDeliveryError` 的固定文案里本来就没有正文。仓库里其它 `console.*` 没有再打印令牌。

端到端仍用 `next start`（生产模式）。应用不再把信的正文写进标准输出或 `MAIL_LOG_PATH`。测试要打开的链接改从本机 SMTP 收件箱读取，收件箱是 `scripts/smtp-catcher.mjs`，只在端到端脚本里启动，应用代码里没有一个能在生产环境把令牌写回日志的开关。确认信的正文检查留在收件箱上：通知信没有 `token=` 和 `/change-email`，确认信有 `token=`。标准输出和 `MAIL_LOG_PATH` 的断言改成这两处都不能出现 `token=`。

新增两条端到端：单独退出一台设备后当前浏览器还在登录，另一台浏览器下次打开就是未登录；访客折叠一条评论再注册登录，这条评论仍然折叠。截图是 `docs/screenshots/devices.png` 和 `docs/screenshots/collapse-sync.png`。原来的 31 条端到端都还在。

## 怎么验证

```bash
npx vitest run tests/unit/mail-log.test.ts tests/unit/email-delivery.test.ts
npm test
npm run lint
unset AUTH_SECRET; npm run typecheck
npm run test:e2e
```

## 证据

2026-11-27 18:34 UTC：

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
```

生产文件日志那条测试的标准输出现在是：

```text
[mail] to=a@example.com subject=Reset your password
```

里面没有 `token=`。

端到端，同一轮最终代码：

```text
npm run test:e2e
33 passed (46.7s)
```

这次 `next start` 的 `/tmp/hn-e2e-server.log` 里没有 `token=`。`/tmp/hn-e2e-mail.log` 里是 `[body omitted]`。确认链接是从 `/tmp/hn-e2e-mailbox.log` 读出来的。

新增 3 个单元测试（`tests/unit/mail-log.test.ts`）：

1. 生产环境的 console 标准输出只有收件人和主题，没有令牌。
2. `NODE_ENV=development` 的标准输出仍包含令牌。
3. 生产环境的 SMTP 发送成功后，标准输出同样没有令牌。

新增 2 条端到端（`tests/e2e/round12.spec.ts`）。合计 33 条，原来的 31 条都通过。

## 发现的问题

- 亚美尼亚连字和希腊语带 prosgegrammeni 的字母还没有放进 `foldSearchText`。
- 设备列表的「上次出现」只在打开会话时写入，之后超过一分钟才会更新。个人页在动作返回后刷新，偶发时按钮会多停一会儿；这次最终的 33 条端到端是一次通过的。
