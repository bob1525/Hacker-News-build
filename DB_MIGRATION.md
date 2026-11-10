# 数据库迁移准备

第四轮阶段 3 的自检。业务库仍然是 SQLite。这篇说明当前限制，以及以后改到 PostgreSQL 时要做的事。现在不要改 `prisma/schema.prisma` 的 provider。

## 做了什么

- 写明 SQLite 对这个应用的限制。
- 给出把 Prisma 切到 PostgreSQL 的步骤、连接串和数据类型注意点。
- 在 `.env.example` 里加了一行注释掉的 PostgreSQL 连接串。生效的仍是 `file:./dev.db`。
- 确认测试继续在 SQLite 上跑。没有执行数据库切换。

## 当前限制

`datasource db` 的 provider 是 `sqlite`，URL 来自 `DATABASE_URL`。

- 同一时刻只有一个写者。投票已经在进程内排队，避开单个 Node 进程里的并行写超时。两个进程同时写仍可能 `database is locked`。
- 不能靠一份 SQLite 文件支撑多台应用实例。文件锁和单写者都在。
- 没有独立的数据库服务器。备份就是拷文件，连接不能跨主机共享。
- 外键是否强制取决于连接上的 PRAGMA。PostgreSQL 会一直强制外键。
- 热度排序不在 SQL 里做。`getFeed` 先 `findMany` 出全部候选，再在内存里算 `(points - 1) / (ageHours + 2) ^ 1.8`。见 [RANKING_SCALABILITY.md](RANKING_SCALABILITY.md)。
- 速率限制的 SQLite 后端是另一个文件，不是这张业务库，也解决不了多实例。

这些限制在 220 篇帖子的测量里没有变成页面超时。见 [SCALE_TEST.md](SCALE_TEST.md)。它们是部署形态的限制，不是当前演示数据的故障。

## PostgreSQL 切换步骤

1. 准备空库和账号，例如：

```sql
CREATE USER hn WITH PASSWORD 'hn';
CREATE DATABASE hackernews OWNER hn;
```

2. 把 `.env` 的连接串换成 PostgreSQL。示例（密码换成真实值）：

```bash
DATABASE_URL="postgresql://hn:hn@localhost:5432/hackernews?schema=public"
```

`.env.example` 里有同样的注释行。只改这一行不够，schema 的 provider 还是 `sqlite` 时 Prisma 会拒绝这条 URL。

3. 修改 `prisma/schema.prisma`：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

4. 不要把现有的 SQLite 迁移 SQL 原样拿到 PostgreSQL 上执行。`prisma/migrations` 里的 SQL 是按 SQLite 生成的。在一台只连着新库的环境里重新生成：

```bash
mkdir -p prisma/migrations/postgresql
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/postgresql/0001_init.sql
```

审过这份 SQL 之后，再把它做成 Prisma 能跟踪的迁移。已经有 SQLite 迁移历史的仓库，不能指望 `prisma migrate deploy` 在 PostgreSQL 上重放旧目录。演示数据用 `npm run db:seed` 重新灌。若要把已有 SQLite 里的用户和帖子搬过去，按表导出 CSV 再导入，不要用 `sqlite3 .dump` 的 SQL。

5. 生成客户端并建表：

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`db:seed` 会清空它连上的那个库。只对空的演示库执行。

## 环境变量示例

本地和 CI 继续用 SQLite：

```bash
DATABASE_URL="file:./dev.db"
```

PostgreSQL：

```bash
DATABASE_URL="postgresql://hn:hn@localhost:5432/hackernews?schema=public"
```

`AUTH_SECRET` 的要求不因数据库改变。仍要一把新的、至少 32 字符的随机值，见 [HISTORY_CLEANUP.md](HISTORY_CLEANUP.md)。

## 数据类型和迁移注意点

当前模型没有 enum、Json、Decimal 或 Boolean 字段，切换时没有这类映射。

- `String` 仍是文本。`@id @default(cuid())` 在 PostgreSQL 上继续由 Prisma 生成，不需要数据库端的 uuid 扩展。
- `DateTime` 会变成 `timestamp(3)`。比较时用同一时区。应用里的热度计算用毫秒时间戳，不依赖数据库的本地时区。
- `String?` 的 `Post.url` 仍是可空列。
- 复合主键 `Favorite`、`Follow`、`PostVote`、`CommentVote` 在两边都是主键。PostgreSQL 会拒绝重复票；SQLite 在 Prisma 迁移里也同样建了主键。
- `onDelete: Cascade` 在 PostgreSQL 上是真正的外键动作。删用户会删帖子、评论和投票。种子脚本现在的删除顺序仍然安全。
- 搜索在应用里把文本转成小写再匹配，不依赖 `ILIKE`。不用为搜索先改 SQL。
- 连接池：PostgreSQL 建议在 URL 上控制连接数。serverless 多实例时不要每台都开很大的池。

## 验证建议

仓库里的测试继续指向 SQLite，不要为了读这篇文档去改 CI。

```bash
DATABASE_URL="file:./dev.db" npm test
DATABASE_URL="file:./dev.db" npm run test:e2e
```

`npm run test:e2e` 自己会把 `DATABASE_URL` 指到 `prisma/e2e.db`。provider 保持 `sqlite` 时这两条就是当前的验证。

以后真的切到 PostgreSQL，再额外做这三步：

1. `npx prisma migrate deploy` 对空的 PostgreSQL 成功，并且 `npx prisma migrate status` 没有待执行迁移。
2. `npm run db:seed` 之后能打开首页，看到种子帖。
3. 用同一套 Vitest 和 Playwright 跑一遍。那之前要把测试用的 `DATABASE_URL` 和 Prisma provider 一起改掉，并准备一个可丢弃的测试库。在那之前，SQLite 结果仍然是合并门槛。

## 验证方法

```bash
rg -n 'provider' prisma/schema.prisma
rg -n 'postgresql://' .env.example
```

确认 provider 仍是 `sqlite`，连接串示例在 `.env.example` 里且被注释。

## 结果证据

- `prisma/schema.prisma` 的 datasource provider 仍是 `sqlite`。
- `.env.example` 生效的 `DATABASE_URL` 仍是 `file:./dev.db`。PostgreSQL 那行以 `#` 开头。
- 本阶段没有改运行时代码，也没有新增迁移。阶段 2 结束时的套件是：eslint 通过，typecheck 通过，Vitest 20 个文件、117 个测试通过，Playwright 23 passed。

## 发现的问题

- 现有 `prisma/migrations` 不能直接当成 PostgreSQL 迁移重放。文档把“重新生成 SQL”写成必做步骤，避免 `migrate deploy` 在新库上报 SQLite 语法错误。
- 只改 `.env` 里的 URL 会在 provider 还是 sqlite 时启动失败。示例连接串因此放在注释里，并写明要同时改 schema。
