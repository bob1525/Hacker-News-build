# 第十一轮阶段 2：退出其他设备

## 做了什么

自己的主页加了「Sign out other devices」。它把当前用户的 `sessionVersion` 加 1，再按新版本给当前浏览器重签 cookie。其他浏览器上按旧版本签发的 cookie 不再通过 `sessionVersionMatches`。

确认更换邮箱成功时，同一笔事务里也把 `sessionVersion` 加 1。如果点开确认链接的浏览器已经登录的是同一个用户，确认动作会按新版本重签它的 cookie。没登录，或者登录的是别人，不给那个浏览器签发新 cookie。

密码重置仍按原来的方式在重置事务里把 `sessionVersion` 加 1，不在这里重签，原有测试没有改断言。

## 怎么验证

```bash
npx vitest run tests/unit/session-management.test.ts tests/unit/session-revoke.test.ts tests/unit/email-change.test.ts tests/unit/password-reset.test.ts
npx eslint lib/session-management.ts lib/actions/session.ts lib/actions/email-change.ts lib/email-change-store.ts components/sign-out-others-form.tsx 'app/user/[username]/page.tsx' tests/unit/session-management.test.ts tests/unit/email-change.test.ts
unset AUTH_SECRET; npm run typecheck
```

## 证据

2026-11-27 17:48 UTC：

```text
npx vitest run tests/unit/session-management.test.ts tests/unit/session-revoke.test.ts tests/unit/email-change.test.ts tests/unit/password-reset.test.ts
Test Files  4 passed (4)
Tests       20 passed (20)
Start at    17:48:39
Duration    2.44s

npx eslint …通过
unset AUTH_SECRET; npm run typecheck
next typegen && tsc --noEmit 通过
```

新增 4 个单元测试：

1. 退出其他设备后版本从 0 变成 1，旧 cookie 不匹配，按新版本重签的 cookie 匹配。
2. 不存在的用户不会被改版本。
3. 只有当前浏览器已经是同一个用户时才重签。
4. 邮箱确认成功后版本变成 1，确认前签发的 cookie 不再匹配；未登录的浏览器不会被当成当前用户。

邮箱更换测试里，确认成功后的 `sessionVersion` 断言从 0 改成 1，并要求返回 `userId` 和新版本。这是本阶段要求的行为，不是把断言放宽。密码重置的 5 个测试和上一轮会话撤销的 4 个测试仍按原断言通过。没有新的数据库迁移。

## 发现的问题

- 重签发生在版本加 1 之后。如果写 cookie 失败，这次登录也会失效，需要重新登录。
- 端到端和截图留到阶段 4。
