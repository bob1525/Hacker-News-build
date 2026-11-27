# 第十二轮阶段 3：登录后合并访客折叠

## 做了什么

未登录时折叠评论仍写在本机 `localStorage`（`hn-collapsed-comments`）。登录之后，`GuestCollapseSync` 把这份列表交给 `mergeGuestCollapses`。账号侧继续用原来的 `CommentCollapse` 表，没有另开一套存储。

合并规则：

- 幂等。同一条评论再合并一次，仍然只有一行。
- 一次最多处理 `GUEST_COLLAPSE_MERGE_LIMIT`（100）个不重复 id。超出的留在本机，下次再合并。
- 只写入数据库里真实存在的评论。不存在的 id 被丢掉，不会插入。
- 空字符串、超长字符串和非字符串会被忽略。

合并成功后，已经写入和确认不存在的 id 会从本机列表拿掉。有新行写入时刷新页面，让服务端读到的折叠和账号一致。未登录的折叠按钮行为没有改。

## 怎么验证

```bash
npx vitest run tests/unit/collapse-sync.test.ts tests/unit/comment-collapse.test.ts tests/unit/collapsed-comments.test.ts
npm test
npm run lint
unset AUTH_SECRET; npm run typecheck
npm run test:e2e
```

## 证据

2026-11-27 18:18 UTC：

```text
npm test
Test Files  43 passed | 1 skipped (44)
Tests       224 passed | 1 skipped (225)
Start at    18:18:49
Duration    10.17s

npm run lint
eslint . 通过

unset AUTH_SECRET; npm run typecheck
next typegen && tsc --noEmit 通过

npm run test:e2e
31 passed (45.9s)
```

新增 3 个单元测试（`tests/unit/collapse-sync.test.ts`）：

1. 已合并和确认不存在的 id 从本机剩余列表去掉，超过上限的留下。
2. 只写入存在的评论；缺的 id 不插行；同一条再合并一次，行数仍是 1。
3. 上限常量是 100。用上限 2 调用时只写入前两条，剩下的下一次才写入，三次合并后一共 3 行。

端到端仍是 31 个。未登录折叠在刷新和来回导航后仍然保持的那条测试通过。本阶段没有新增端到端测试。

## 发现的问题

- `NODE_ENV=production` 时，`MAILER=console` 打到标准输出的邮件仍包含正文。端到端目前从这份标准输出里取令牌。
- 个人页的设备列表、本阶段的登录后合并，都还没有端到端测试和截图。
- 亚美尼亚连字和希腊语带 prosgegrammeni 的字母没有放进搜索折叠。
