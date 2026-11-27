# 第十轮阶段 3：登录后更换邮箱

## 做了什么

已登录用户可以在自己的主页提交一个新邮箱。服务端只保存令牌的 SHA-256 和新地址，链接一小时内有效。确认信通过现有的可替换 `Mailer` 发到新地址。点开 `/change-email` 并提交之后，账号邮箱才改成新地址。在那之前，库里的旧邮箱保持不变。

发信失败时返回「Could not send the confirmation email. Please try again.」，不改邮箱，错误文本不含令牌。同一用户可以再要一封新链接。新地址若已被占用，申请时直接拒绝；若在确认前被别人占用，事务回滚，旧邮箱和未使用的令牌都留下。

限流范围是 `emailChange`，按用户 id 计数，10 分钟 3 次。重复提交当前邮箱不占这个额度。确认成功会把 `emailVerifiedAt` 写成确认时间，因为新邮箱是点链接证明过的。这不打开 `REQUIRE_EMAIL_VERIFICATION`，也不增加 `sessionVersion`。默认 `MAILER` 仍是 `console`，默认数据库仍是 SQLite。

SQLite 迁移是 `prisma/migrations/20261127170000_email_change/migration.sql`。PostgreSQL 追加 `prisma/migrations-postgres/0008_email_change.sql`。种子在清空用户前会删掉更换邮箱和重置密码的令牌。

## 如何验证

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code --script
env -u AUTH_SECRET npm run typecheck
npx vitest run tests/unit/email-change.test.ts tests/unit/email-verification.test.ts tests/unit/email-delivery.test.ts tests/unit/password-reset.test.ts tests/unit/password-session.test.ts
npx eslint lib/email-change-store.ts lib/domain/email-change.ts lib/actions/email-change.ts lib/limits.ts components/email-change-form.tsx tests/unit/email-change.test.ts
```

## 结果证据

2026-11-27 13:15 UTC：

```text
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code
-- This is an empty migration.
sqlite-diff:0

env -u AUTH_SECRET npm run typecheck
Generating route types...
✓ Route types generated successfully

npx vitest run tests/unit/email-change.test.ts tests/unit/email-verification.test.ts tests/unit/email-delivery.test.ts tests/unit/password-reset.test.ts tests/unit/password-session.test.ts
Test Files  5 passed (5)
Tests       25 passed (25)
Start at    13:15:51
Duration    2.33s

npx eslint …通过
```

新增 5 个测试：

1. 令牌只存哈希，链接是 `/change-email?token=`，有效期一小时。
2. 确认前邮箱仍是旧地址，`emailVerifiedAt` 为空，`sessionVersion` 仍是 0。确认后变成新地址，再点同一链接会说已经用过。
3. 发信失败时邮箱不变，错误里没有令牌。随后重发并确认，邮箱才变成新地址。
4. 过期链接不改邮箱。确认前地址被别人占用时回滚，旧邮箱不变，令牌仍未使用。
5. 当前邮箱会被拒绝。10 分钟内第 4 次申请被限流，邮箱仍是原来的。

原有验证、发信失败、密码重置和会话测试仍通过。

## 发现的问题

- 旧邮箱不会收到「有人正在更换地址」的通知。确认只证明新邮箱能收信。
- 发信失败时哈希会留到下一次申请删掉未使用的令牌。明文只出现在那次没送出去的信里，库里没有。
- 打开确认链接不要求浏览器里仍然登录。链接本身就是凭证。
- 本机没有 PostgreSQL。`0008_email_change.sql` 留在 CI 的空库任务里执行。
