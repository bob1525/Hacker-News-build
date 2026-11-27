# 第十一轮阶段 4：生产邮件日志、深分页和本轮端到端

## 做了什么

`MAIL_LOG_PATH` 在 `NODE_ENV=production` 下仍可指向一个文件，但只追加收件人、主题和 `[body omitted]`。正文里的令牌和链接不会进这个文件。非生产环境仍追加全文，默认不设置这个路径。`MAILER=console` 在非 test 时仍把全文打到进程标准输出，这是原来的本地默认。

搜索窗口加了深分页一致性测试：内存打分和 SQL 装载都按页走完，和整表 `pageSearchResults` 的顺序一致，跨页不重不漏。这两条测试通过，没有改打分公式，SQL 也没有第二份相关度。

端到端新增两条：一个浏览器退出其他设备后自己仍登录，另一个浏览器的旧 cookie 失效；更换邮箱时旧地址收到不含令牌、不含 `/change-email` 的通知，生产邮件文件里也没有令牌。截图 `docs/screenshots/sign-out-others.png` 是 demo 点过按钮之后的主页，人还登录着，页面上有成功提示。

## 怎么验证

```bash
npx vitest run tests/unit/mail-log.test.ts tests/unit/search-window.test.ts
npm test
npm run test:e2e
npx eslint lib/mailer.ts tests/unit/mail-log.test.ts tests/unit/search-window.test.ts tests/e2e/mail-log.ts tests/e2e/account-recovery.spec.ts tests/e2e/round11.spec.ts playwright.config.ts
node scripts/capture-screenshots.mjs
```

端到端服务器是 `next start`，并显式 `NODE_ENV=production`。令牌从 `/tmp/hn-e2e-server.log` 读取，且只认本次动作之后新写的一段。截图服务器用 `file:/tmp/hn-screenshots.db`，看完即停。

## 证据

2026-11-27 17:53 UTC，邮件日志和搜索窗口：

```text
npx vitest run tests/unit/mail-log.test.ts tests/unit/search-window.test.ts
Test Files  2 passed (2)
Tests       8 passed (8)
Start at    17:53:15
Duration    1.13s
```

2026-11-27 17:55 UTC，全量单元测试：

```text
npm test
Test Files  40 passed | 1 skipped (41)
Tests       211 passed | 1 skipped (212)
Start at    17:55:29
Duration    8.51s
```

跳过的仍是没有 `REDIS_INTEGRATION=1` 的 live Redis。

同一轮 Playwright：

```text
npm run test:e2e
31 passed (38.9s)
```

其中原有 29 条仍通过。新增 3 个单元测试和 2 个端到端：

1. 生产环境的 `MAIL_LOG_PATH` 含收件人和主题，不含 `token=`、密钥和 `/reset-password`。进程内记录仍有全文。
2. 内存窗口把 12 条 `deeppage` 按每页 2 条走完，拼接结果等于整表排序。
3. SQL 窗口对同样的 12 条（含不同票数和时间）走完，每页 id 与整表排序相同，没有重复。
4. 两个浏览器登录同一用户，一边退出其他设备，这一边刷新后仍是该用户，另一边首页没有登录态，个人页也没有这个按钮。
5. 申请更换后，标准输出里给旧地址的通知不含 `token=` 和 `/change-email`，确认信仍发到新地址。生产邮件文件只有摘要。确认后旧地址再收到一封不含令牌的变更通知，当前浏览器仍登录。

`npx eslint` 通过。截图见 `docs/screenshots/sign-out-others.png`。没有新的数据库迁移。

## 发现的问题

- 深分页和整表排序一致，这次没有需要修的窗口漏洞。
- 生产文件日志不写令牌，但 `MAILER=console` 且不是 test 时，全文仍出现在进程标准输出。端到端靠这个读令牌。生产若要避免令牌进日志，应改用 `MAILER=smtp`。
