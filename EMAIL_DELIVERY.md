# 第九轮阶段 1：邮件投递

## 做了什么

发信仍然走可替换的 `Mailer`。默认 `MAILER=console`，测试能读到已发送的信，非测试进程会打印。没有付费邮件服务，CI 也不连接真实 SMTP。

`MAILER=smtp` 使用标准配置：`SMTP_HOST`、`SMTP_PORT`（默认 587）、`SMTP_SECURE`（465 端口默认打开隐式 TLS）、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`。用户名和密码必须成对出现。配置不完整会在创建邮件器时拒绝。真正发信用 nodemailer，测试注入传输对象，不打开网络连接。传输失败变成 `MailDeliveryError`，错误文本不包含邮件正文，因此不会带出验证令牌。

注册策略改成一条明确的规则：账号先写入，再发验证信。发信成功则登录并进入原来的下一页。发信失败不回滚账号，`emailVerifiedAt` 保持为空，未使用的令牌留在库里，用户被登录并送到 `/verify?delivery=failed`。页面说明可以重发。重发会删掉未使用的旧令牌并签发新链接。数据库错误不会被当成发信失败。`REQUIRE_EMAIL_VERIFICATION` 仍然默认关闭。

## 如何验证

开工前在头提交 `cf9088c194a2437a750ede60f098c555b87aadc0` 上跑完整套件。然后：

```bash
npx vitest run tests/unit/email-delivery.test.ts tests/unit/email-verification.test.ts
npx eslint lib/mailer.ts lib/account-registration.ts lib/email-verification-store.ts lib/actions/auth.ts app/verify/page.tsx tests/unit/email-delivery.test.ts
npx tsc --noEmit
```

## 结果证据

开工前，2026-11-27 12:31 UTC：

```text
npx vitest run
Test Files  31 passed | 1 skipped (32)
Tests       171 passed | 1 skipped (172)
Start at    12:31:57
Duration    5.47s

npm run test:e2e
23 passed (31.8s)
```

跳过的是没有 `REDIS_INTEGRATION=1` 的真实 Redis 测试。数字与预期一致，所以继续改代码。

本阶段，2026-11-27 12:35 UTC：

```text
npx vitest run tests/unit/email-delivery.test.ts tests/unit/email-verification.test.ts
Test Files  2 passed (2)
Tests       11 passed (11)
Start at    12:35:00
Duration    1.13s

npx eslint lib/mailer.ts lib/account-registration.ts lib/email-verification-store.ts lib/actions/auth.ts app/verify/page.tsx tests/unit/email-delivery.test.ts
通过

npx tsc --noEmit
通过
```

原有 7 个邮箱验证测试仍通过。本阶段新增 4 个：

1. SMTP 配置：默认端口 587、465 端口默认隐式 TLS、账号密码必须成对、缺少 `SMTP_HOST` 会拒绝。空的 `MAILER` 仍是控制台。
2. 注入的 SMTP 传输能送出收件人、标题和正文，不写入控制台记录。传输抛错时变成 `MailDeliveryError`，错误文本不含明文令牌。
3. 发信成功：账号已创建且未验证，库里只有令牌哈希，信里有验证链接，下一页仍是原来的地址。
4. 发信失败：账号留下且未验证，未使用令牌还在，下一页是 `/verify?delivery=failed`。重发后新链接可以通过验证。

## 发现的问题

- 默认仍是控制台邮件器。不配置 `MAILER=smtp` 时，信不会进真实邮箱。
- CI 不连接 SMTP 服务器。生产要自己填写 `SMTP_*`，本阶段没有对真实服务器做一次发送。
- `REQUIRE_EMAIL_VERIFICATION` 仍默认关闭。
- 还没有密码重置。那是下一阶段的事。
