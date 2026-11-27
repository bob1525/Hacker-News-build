# 第十一轮阶段 1：更换邮箱时通知旧地址

## 做了什么

申请更换邮箱时，确认信仍然只发给新地址。确认信送出之后，再给旧地址发一封「Email change requested」。用户点开链接、邮箱改成新地址之后，再给旧地址发一封「Your email was changed」。两封通知都不含令牌，也不含 `/change-email` 链接。邮件仍走现有的可替换 `Mailer`。

通知发不出去时主流程继续：申请仍然返回已发送，确认仍然改掉邮箱。确认信本身发不出去时，删掉这一次刚写入的令牌哈希，不再留到下一次申请。旧邮箱在确认前保持不变。不打开 `REQUIRE_EMAIL_VERIFICATION`，默认 `MAILER` 仍是 `console`。

## 怎么验证

开工前在头提交 `d3387ef272ae6d690da4426b296ee81711a053d0` 上复跑了全量套件。

```bash
npm test
npm run test:e2e
npx vitest run tests/unit/email-change.test.ts tests/unit/email-verification.test.ts tests/unit/email-delivery.test.ts tests/unit/password-reset.test.ts
npx eslint lib/email-change-store.ts lib/actions/email-change.ts tests/unit/email-change.test.ts
```

## 证据

2026-11-27 17:45 UTC，改代码之前：

```text
npm test
Test Files  38 passed | 1 skipped (39)
Tests       200 passed | 1 skipped (201)
Start at    17:45:01
Duration    8.00s

npm run test:e2e
29 passed (40.5s)
```

跳过的仍是没有 `REDIS_INTEGRATION=1` 的 live Redis。数字与约定一致。

2026-11-27 17:47 UTC：

```text
npx vitest run tests/unit/email-change.test.ts tests/unit/email-verification.test.ts tests/unit/email-delivery.test.ts tests/unit/password-reset.test.ts
Test Files  4 passed (4)
Tests       23 passed (23)
Start at    17:47:08
Duration    2.43s

npx eslint …通过
```

邮箱更换测试从 5 个变成 7 个。原有确认流程仍要求旧邮箱在点开链接之前不变，并加上两封通知不含 `token=` 和 `/change-email`。新增 2 个：

1. 确认信发不出去时，这次的令牌哈希被删掉，邮箱不变。
2. 申请通知发不出去时，确认信和令牌仍留下。确认后的通知发不出去时，邮箱已经改成新地址。

原有验证、发信失败和密码重置测试仍通过。

## 发现的问题

- 通知失败被吞掉之后，调用方看不出旧地址没收到信。主流程按要求继续。
- 确认信失败时不会再给旧地址发通知，因为这次申请已经作废。
- 更换邮箱仍然不增加 `sessionVersion`。那是下一阶段的事。
