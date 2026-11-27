# 第九轮阶段 2：密码重置

## 做了什么

未登录用户可以在 `/forgot-password` 填写邮箱。地址存在时签发 1 小时内有效的重置链接，数据库只保存 SHA-256，不保存原文。地址不存在时不发信，页面仍显示同一句「如果账号存在，重置链接已发出」，避免靠提示判断邮箱是否注册。新链接会删掉同一用户尚未使用的旧链接。

`/reset-password?token=...` 写入新的 scrypt 口令，并把这条令牌标成已用。成功后旧口令不再通过 `verifyPassword`。过期、已用或被新链接替换的令牌不会改口令。同一用户其余未使用的重置令牌也会作废。

限流范围是 `reset`，按规范化后的邮箱计数，10 分钟 3 次，不占用发帖额度。邮件走阶段 1 的可替换 `Mailer`。发信失败时口令不变，错误文本不含令牌。重置存储和动作里没有 `console.log` 明文令牌。控制台邮件器在非测试进程仍会打印整封信，这是本地收信方式；`MAILER=smtp` 不打印正文。不打开 `REQUIRE_EMAIL_VERIFICATION`。

SQLite 迁移是 `prisma/migrations/20261127140000_password_reset/migration.sql`。PostgreSQL 追加 `prisma/migrations-postgres/0005_password_reset.sql`。语句与把 provider 改成 postgresql 之后的 `prisma migrate diff` 一致。

## 如何验证

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code --script
npx vitest run tests/unit/password-reset.test.ts tests/unit/password-session.test.ts tests/unit/email-verification.test.ts tests/unit/email-delivery.test.ts
npx eslint lib/domain/password-reset.ts lib/password-reset-store.ts lib/actions/password-reset.ts lib/limits.ts lib/config.ts components/password-reset-form.tsx "app/(account)/forgot-password/page.tsx" "app/(account)/reset-password/page.tsx" "app/(account)/login/page.tsx" tests/unit/password-reset.test.ts
npx tsc --noEmit
```

## 结果证据

2026-11-27 12:37 UTC：

```text
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code
-- This is an empty migration.
sqlite-diff:0

npx vitest run tests/unit/password-reset.test.ts tests/unit/password-session.test.ts tests/unit/email-verification.test.ts tests/unit/email-delivery.test.ts
Test Files  4 passed (4)
Tests       20 passed (20)
Start at    12:37:22
Duration    1.55s

npx eslint …通过
npx tsc --noEmit
通过
```

原有 4 个口令和会话测试、7 个邮箱验证测试、4 个邮件投递测试仍通过。本阶段新增 5 个：

1. 原文和哈希不同，哈希是 64 位十六进制。链接去掉末尾斜杠。有效期是 1 小时。到期判定是 `expired`。
2. 发信后库里只有哈希。新链接使旧链接失效。重置后旧口令失败、新口令成功。再用同一次链接被拒绝。创建时 `emailVerifiedAt` 仍为空。
3. 过期链接不改口令。
4. 未知邮箱不发信。同一邮箱第 4 次被拒绝。发帖额度还在。
5. SMTP 传输失败时口令不变，返回文本不含明文令牌，控制台记录为空。

## 发现的问题

- 会话是无状态 JWT。改口令不会使已经发出的 cookie 立即失效，但旧口令不能再登录。
- 控制台邮件器在非测试进程仍打印整封信，否则本地看不到链接。SMTP 路径不打印正文。
- 本机没有 PostgreSQL。`0005_password_reset.sql` 留在 CI 的空库任务里执行。
- `REQUIRE_EMAIL_VERIFICATION` 仍默认关闭。
