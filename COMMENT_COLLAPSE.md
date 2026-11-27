# 第七轮阶段 3：评论折叠持久化

## 做了什么

已登录用户的折叠状态写进 `CommentCollapse`。主键是 `(userId, commentId)`。同一条评论再折叠一次不会多出一行。展开时删掉这一行。删除评论会级联删掉折叠行。评论最大层数仍是 8。

帖子页按当前用户和当前帖子读取折叠的评论 id，交给 `CommentThread` 作为初始状态。点击折叠或展开时，页面先更新显示，再调用 `setCommentCollapsed` 写入数据库。写入失败则回到点击前的状态。关闭浏览器或换设备后，下一次打开同一账号仍读数据库，不读 `sessionStorage`。

未登录用户继续使用 `sessionStorage`，键名仍是 `hn-collapsed-comments`。刷新和同一标签页里的跳转会保留折叠。换浏览器、换设备或清掉会话存储后不会保留。已登录用户忽略这份会话存储，避免旧的本机会话盖过账号里的记录。

## 数据模型

| 字段 | 含义 |
| --- | --- |
| `userId` | 折叠这条评论的用户 |
| `commentId` | 被折叠的评论 |
| `createdAt` | 写入时间 |

SQLite 迁移是 `prisma/migrations/20261127100000_comment_collapse/migration.sql`。PostgreSQL 追加 `prisma/migrations-postgres/0002_comment_collapse.sql`。空库脚本按文件名顺序执行 `0001_init.sql` 再执行 `0002_comment_collapse.sql`。

## 如何验证

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code --script
npx vitest run tests/unit/comment-collapse.test.ts tests/unit/collapsed-comments.test.ts
npx tsc --noEmit
npx eslint lib/comment-collapse.ts lib/actions/comment-collapse.ts components/comment-thread.tsx 'app/item/[id]/page.tsx' tests/unit/comment-collapse.test.ts
```

PostgreSQL 语句对照 `prisma migrate diff --from-empty --to-schema-datamodel --script` 里的 `CommentCollapse` 片段。本机没有 PostgreSQL，空库执行仍由 CI 的 postgres job 完成。

## 结果证据

```text
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code
-- This is an empty migration.
diff-exit:0

npx vitest run tests/unit/comment-collapse.test.ts tests/unit/collapsed-comments.test.ts
Test Files  2 passed (2)
Tests       6 passed (6)
Start at    09:59:08
Duration    1.11s

npx tsc --noEmit
通过

npx eslint lib/comment-collapse.ts lib/actions/comment-collapse.ts components/comment-thread.tsx app/item/[id]/page.tsx tests/unit/comment-collapse.test.ts
通过
```

原有 2 个会话解析测试仍通过。本阶段新增 4 个：

1. 折叠写入后按帖子读回同一条评论 id。重复折叠仍只有一行。展开后列表为空。
2. 两个用户各自折叠自己的评论，互不影响。按另一篇帖子过滤时不返回别人的评论。
3. 评论不存在时不写行。评论删除后，折叠行被级联删除。
4. 有用户 id 时存储位置是 `database`，没有用户 id 时是 `session`。

## 发现的问题

- 未登录折叠仍然只在当前浏览器会话里。这是本阶段保留的行为。
- 已登录的点击先改界面再写库。写库失败会退回，但两次快速点击可能交错。下一次整页加载以数据库为准。
- 空库上的 `0002_comment_collapse.sql` 还没有在本机 PostgreSQL 执行。语句与 Prisma 生成的片段一致，漂移检查要等下一轮 CI 的 postgres job。
