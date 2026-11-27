# 第十轮阶段 1：重置密码后作废旧会话

## 做了什么

密码重置成功时把该用户的 `sessionVersion` 加 1，并同时换掉密码哈希。会话 JWT 带上整数声明 `sv`。`getCurrentUser` 读到 cookie 之后，只在 `sv` 等于库里的 `sessionVersion` 时把用户当作已登录。旧令牌的 `sv` 对不上，这次重置之前签下的 cookie 不再有效。新的登录用当前版本重新签名，可以进来。

没有 `sv` 的旧令牌按版本 0 处理，和字段默认值一样，所以还没重置过密码的会话仍然有效。令牌和明文密码都不写进日志。

SQLite 迁移是 `prisma/migrations/20261127160000_session_version/migration.sql`，语句与 `prisma migrate diff --from-migrations --to-schema-datamodel` 一致。PostgreSQL 追加 `prisma/migrations-postgres/0007_session_version.sql`，语句与 provider 改成 postgresql 后的 `prisma migrate diff` 一致。默认数据库仍是 SQLite。

## 如何验证

开工前在头提交 `84a8246fb166548cf53c156209d7ac6d194bee90` 上跑了全量套件。

```bash
npx vitest run
npx playwright test
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code --script
npx vitest run tests/unit/session-revoke.test.ts tests/unit/password-reset.test.ts tests/unit/password-session.test.ts tests/unit/email-verification.test.ts tests/unit/auth-secret.test.ts
npx eslint lib/auth.ts lib/session-token.ts lib/session.ts lib/password-reset-store.ts tests/unit/session-revoke.test.ts
```

## 结果证据

2026-11-27 13:09 UTC，改代码之前：

```text
npx vitest run
Test Files  34 passed | 1 skipped (35)
Tests       186 passed | 1 skipped (187)
Start at    13:09:39
Duration    6.66s

npx playwright test
26 passed (34.5s)
```

跳过的仍是没有 `REDIS_INTEGRATION=1` 的 live Redis。数字与约定一致。

2026-11-27 13:11 UTC：

```text
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code
-- This is an empty migration.
sqlite-diff:0

npx vitest run tests/unit/session-revoke.test.ts tests/unit/password-reset.test.ts tests/unit/password-session.test.ts tests/unit/email-verification.test.ts tests/unit/auth-secret.test.ts
Test Files  5 passed (5)
Tests       30 passed (30)
Start at    13:11:51
Duration    1.62s

npx eslint …通过
```

原有密码重置、会话往返、邮箱验证和密钥测试仍通过。本阶段新增 4 个：

1. 版本 0 的令牌在用户版本变成 1 之后对不上。
2. 版本 2 的令牌只匹配版本 2，不匹配 3。损坏的令牌读出来是 null。
3. 重置成功后旧令牌的 `sv` 仍指向重置前的版本，和库里的新版本不一致。
4. 用重置后的 `sessionVersion` 新签的令牌可以匹配，新密码能通过校验，旧密码不能。

## 发现的问题

- 作废靠版本号，不靠一张会话表。同一个版本里签出的多张 cookie 会一起失效，不能只踢掉其中一张。
- 版本号存在用户行上。重置和签发如果卡在同一秒，也不会因为时间戳相等而放行旧令牌，因为比的是整数而不是 `iat`。
- 本机没有 PostgreSQL。`0007_session_version.sql` 留在 CI 的空库任务里执行。
