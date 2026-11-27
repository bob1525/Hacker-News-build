# 第八轮阶段 1：邮箱验证

## 做了什么

注册后会生成 24 小时内有效的验证链接。数据库只保存令牌的 SHA-256，不保存原文。打开 `/verify?token=...` 后把 `User.emailVerifiedAt` 写上，并把这条令牌标成已用。再打开同一次链接会显示已经验证。过期或被新链接替换的令牌不会通过。

发信是可替换的 `Mailer`。默认 `MAILER=console`：测试里能读到已发送的信，非测试进程会把收件人、标题和正文打到日志。没有付费邮件服务。重发走现有的限流存储，范围是 `verify`，每个用户 10 分钟 3 次，不占用发帖额度。

`REQUIRE_EMAIL_VERIFICATION` 未设置时，未验证用户仍可以发帖、评论和投票。设成 `1`、`true` 或 `yes` 后，这三件事会要求 `emailVerifiedAt`。收藏和关注不在这道门里。种子用户写入时标成已验证，演示账号在打开开关后仍能用。

SQLite 迁移是 `prisma/migrations/20261127120000_email_verification/migration.sql`。PostgreSQL 追加 `prisma/migrations-postgres/0003_email_verification.sql`。空库脚本按文件名在 `0002` 之后执行它。

## 如何验证

开工前先跑完整套件。然后：

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code --script
npx vitest run tests/unit/email-verification.test.ts tests/unit/rate-limit.test.ts
npx tsc --noEmit
npx eslint lib/domain/email-verification.ts lib/email-verification-store.ts lib/mailer.ts lib/actions/email-verification.ts app/verify/page.tsx components/resend-verification.tsx tests/unit/email-verification.test.ts
```

PostgreSQL 语句来自 `prisma migrate diff --from-schema-datamodel --to-schema-datamodel --script`。本机没有 PostgreSQL，空库执行留在 CI 的 `postgres` job。

## 结果证据

开工前，头提交 `7d7d8f3f70cf8e88156c575a630a760921e99452`，2026-11-27 11:07 UTC：

```text
npx vitest run
Test Files  27 passed | 1 skipped (28)
Tests       148 passed | 1 skipped (149)
Start at    11:07:04
Duration    4.35s

npm run test:e2e
23 passed (30.7s)
```

跳过的是没有 `REDIS_INTEGRATION=1` 的真实 Redis 测试。

本阶段：

```text
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code
-- This is an empty migration.
diff-exit:0

npx vitest run tests/unit/email-verification.test.ts tests/unit/rate-limit.test.ts
Test Files  2 passed (2)
Tests       12 passed (12)
Start at    11:09:47
Duration    1.09s

npx tsc --noEmit
通过

npx eslint lib/domain/email-verification.ts lib/email-verification-store.ts lib/mailer.ts lib/actions/email-verification.ts app/verify/page.tsx components/resend-verification.tsx tests/unit/email-verification.test.ts lib/actions/auth.ts
通过
```

原有 5 个速率限制测试仍通过。本阶段新增 7 个：

1. 原文和哈希不同，哈希是 64 位十六进制。
2. 开关只在 `1`、`true`、`yes` 时要求验证；未验证用户在开关关闭时可以写，打开后被拒绝，已验证用户可以通过。
3. 到期和已使用的令牌分别是 `expired` 和 `used`。
4. 验证链接去掉末尾斜杠。未知 `MAILER` 会拒绝。
5. 重发 3 次后被拒绝，同一次计数不消耗发帖额度。
6. 控制台邮件含有链接。库里只有哈希。验证后 `emailVerifiedAt` 被写入，第二次打开算已经验证。
7. 过期链接被拒绝。签发新链接后旧链接失效，新链接可以通过。

## 发现的问题

- 默认不强制验证，否则现有注册、发帖、评论和投票测试会被拦住。生产要自己打开 `REQUIRE_EMAIL_VERIFICATION`。
- 控制台邮件器只记录和打印，不会把信送到真实邮箱。
- 发信失败不会回滚已经创建的账号，用户仍然会登录。
- `0003_email_verification.sql` 还没有在本机空 PostgreSQL 上执行。语句与 Prisma 增量差异一致，漂移检查要等 CI。
