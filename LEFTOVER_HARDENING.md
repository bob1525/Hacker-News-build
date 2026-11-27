# 第八轮阶段 4：剩下的技术限制

## 做了什么

搜索不再把全部命中行读进进程再打分。SQL 只按标题和正文的特征分组计数：是不是整句标题、标题或正文里有没有整句、每个词出现在哪一侧。这些特征没有分数。分数仍然只来自 `searchRelevance`。同一分数的组放在一起，用原来的热度 SQL 只取当前页还缺的那些行，再交给 `searchRelevance` 排序。更高分组已经填满本页时，后面的正文命中不会被打分。第 N 页最多打分 `N * pageSize` 行，因为要知道这一页之前有哪些结果。

未登录用户的折叠从 `sessionStorage` 改到 `localStorage`，键名仍是 `hn-collapsed-comments`。关掉标签页再打开还在，仍然只在这一个浏览器里。已登录用户继续写 `CommentCollapse`，不读这份本地存储。`collapseStorage(null)` 从 `"session"` 改成 `"local"`，对应的断言一起改了。

`npx next dev` 会先在父进程加载 `next.config.ts`。只有参数里是 `dev` 或 `start` 时才调用 `enforceAuthSecretOrExit`。密钥不合格就在 fork 工作进程之前 `process.exit(1)`。`npm run dev` 原来的 `scripts/next-dev-exit.cjs` 还在。`next typegen`（`npm run typecheck`）不退出，否则 CI 在没有 `AUTH_SECRET` 的类型检查步骤会失败。

默认数据库仍是 SQLite，默认限流仍是内存。没有改历史提交。

## 如何验证

```bash
npx tsc --noEmit
npx eslint lib/domain/search-window.ts lib/domain/search-sql.ts lib/search-window-db.ts lib/domain/ranking-sql.ts lib/queries.ts components/comment-thread.tsx next.config.ts tests/unit/search-window.test.ts tests/unit/next-dev-exit.test.ts
npx vitest run
npm run test:e2e
```

## 结果证据

```text
npx vitest run
Test Files  31 passed | 1 skipped (32)
Tests       169 passed | 1 skipped (170)
Start at    11:27:14
Duration    5.19s

npm run test:e2e
23 passed (30.7s)
```

阶段 3 结束时是 165 个通过。本阶段新增 4 个，合计 169。原有搜索、热度、折叠和 `npm run dev` 退出码测试仍通过。`npx tsc --noEmit` 和上面的 eslint 通过。

新增的 4 个测试：

1. 标题命中已经填满第一页时，只给这 2 行打分，不给正文命中打分。第二页接上，没有重复。
2. 候选帖的特征组和 `searchRelevance` 的分数一致。
3. SQL 窗口和内存里的全量排序一致。两词查询只给标题整句那一行打分。
4. 不加载 `scripts/next-dev-exit.cjs` 时，`node ./node_modules/next/dist/bin/next dev`（`npx next dev` 的入口）在密钥过短时退出码是 1。

`tests/unit/comment-collapse.test.ts` 里未登录分支的期望值从 `"session"` 改成 `"local"`。已登录仍是 `"database"`。

## 发现的问题

- 数据库仍会对命中行做一次分组扫描。进程里不再为了打分装下全部命中。很深的页仍要取到那一页为止的行。
- 分组特征用 SQL 的 `lower` / `instr`，打分用 JavaScript 的 `toLowerCase`。非 ASCII 大小写仍可能不一致。测试覆盖的是 ASCII 和已有搜索用例。
- 未登录折叠存在这个浏览器的 `localStorage`。清站点数据或换浏览器会丢。它不是账号数据。
- 历史提交里的 `AUTH_SECRET` 没有清除。
