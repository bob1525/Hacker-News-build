# 第六轮阶段 3：PostgreSQL 迁移准备

## 做了什么

用 `prisma migrate diff --from-empty --to-schema-datamodel --script` 从当前数据模型生成一份 PostgreSQL SQL。生成时先把 schema 复制到临时文件，只把 provider 改成 `postgresql`。没有读取、也没有重放 `prisma/migrations` 里的 SQLite 迁移。

产物是 `prisma/migrations-postgres/0001_init.sql`。这个目录不是 Prisma 的默认迁移目录，所以现有的 `prisma migrate deploy` 不会把它和 SQLite 历史混在一起。`prisma/schema.prisma` 的 provider 仍然是 `sqlite`，默认测试和 `test` job 不变。

重新生成：

```bash
bash scripts/generate-postgres-migration.sh
```

脚本不连接数据库。`DATABASE_URL` 若不是 PostgreSQL 地址，会临时换成一条只用于解析 schema 的地址，不改 `.env`。

## 生成的迁移说明

SQL 创建 `public` 以及这些表：`User`、`Post`、`Comment`、`Favorite`、`Follow`、`PostVote`、`CommentVote`。

- 时间列是 `TIMESTAMP(3)`，默认 `CURRENT_TIMESTAMP`。SQLite 迁移里的 `DATETIME` 没有出现。
- 主键、唯一索引、普通索引和外键与 `prisma/schema.prisma` 一致。外键是 `ON DELETE CASCADE ON UPDATE CASCADE`。
- 文本列是 `TEXT`。可空的是 `Post.url`、`Comment.parentId`、`Comment.editedAt`、`Comment.deletedAt`。
- 没有 enum、Boolean、Json 或 Decimal，因为模型里没有这些类型。

## 如何切换默认数据库到 PostgreSQL

在空库上执行。不要对已经有 SQLite 数据的文件做这件事，也不要 `prisma migrate deploy` 现有的 `prisma/migrations`。

1. 准备空库：

```sql
CREATE USER hn WITH PASSWORD 'hn';
CREATE DATABASE hackernews OWNER hn;
```

2. 在空库上执行生成的 SQL。`prisma db execute` 需要一份 provider 为 `postgresql` 的 schema，所以用现成的临时 schema 脚本：

```bash
export DATABASE_URL="postgresql://hn:hn@localhost:5432/hackernews?schema=public"
bash scripts/with-postgres-schema.sh prisma db execute --file prisma/migrations-postgres/0001_init.sql
```

3. 把 `prisma/schema.prisma` 的 datasource 改成：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

4. 生成客户端，确认没有漂移，再灌演示数据：

```bash
npx prisma generate
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
npm run db:seed
```

`--exit-code` 在两边一致时返回 0。若返回 2，说明库和 schema 不一致，先看 diff，不要继续写业务数据。

5. 把 `.env` 的 `DATABASE_URL` 保持为上面的 PostgreSQL 地址。`.env.example` 里对应行仍然注释着，仓库默认还是 `file:./dev.db`。

6. 若要让 Prisma Migrate 以后跟踪 PostgreSQL，在一份新的迁移目录里只放入这份 SQL，并写 `migration_lock.toml` 的 provider 为 `postgresql`。不要把 `prisma/migrations` 指到旧的 SQLite 目录。本仓库还没有做这一步，避免 `npm run db:migrate` 在 SQLite 上失效。

已有 SQLite 数据不要用 `sqlite3 .dump` 的 SQL 导入。按表导出 CSV 再导入。`npm run db:seed` 会清空它连上的库，只对空的演示库执行。

切回 SQLite：把 provider 改回 `sqlite`，`DATABASE_URL` 改回 `file:./dev.db`，再 `npx prisma generate`。

## 如何验证

```bash
bash -n scripts/generate-postgres-migration.sh
bash scripts/generate-postgres-migration.sh
rg -n "DATETIME|TIMESTAMP\\(3\\)|CREATE TABLE" prisma/migrations-postgres/0001_init.sql
rg -n 'provider = "sqlite"' prisma/schema.prisma
```

本机没有 PostgreSQL 服务器，所以没有执行这份 SQL。阶段 2 的 CI 已经用同一份数据模型在 `postgres:16` 上 `db push` 并跑过 137 个单元测试，见 `POSTGRES_TESTS.md`。那次建表走的是 `db push`，不是这份 SQL 文件。

## 结果证据

```text
bash scripts/generate-postgres-migration.sh
Wrote prisma/migrations-postgres/0001_init.sql

wc -l prisma/migrations-postgres/0001_init.sql
151

rg DATETIME prisma/migrations-postgres/0001_init.sql
无匹配

prisma/schema.prisma
provider = "sqlite"
```

表是 `User`、`Post`、`Comment`、`Favorite`、`Follow`、`PostVote`、`CommentVote`。时间列都是 `TIMESTAMP(3)`。

## 发现的问题

- 第四轮文档里的 `migrate diff` 直接指向 `prisma/schema.prisma`。provider 还是 `sqlite` 时，那条命令生成的是 SQLite SQL。这次改为先换临时 schema 的 provider。`DB_MIGRATION.md` 的第 4 步已改成指向本文。
- 生成的 SQL 不在 `prisma/migrations` 里。放进去会让默认的 SQLite `migrate deploy` 读到 PostgreSQL 语句。因此切换默认库时要同时改 provider，并单独建立 PostgreSQL 的迁移目录。
- 本机无法执行 SQL。文件内容和 `migrate diff` 的输出一致，但还没有在空库上跑过 `db execute`。CI 证明的是 `db push` 能建出同一模型。
