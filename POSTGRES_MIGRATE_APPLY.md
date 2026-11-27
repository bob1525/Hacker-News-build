# 第七轮阶段 1：在空的 PostgreSQL 上执行迁移 SQL

## 做了什么

CI 的 `postgres` job 不再用 `prisma db push` 当作迁移证据。它安装 `psql`，在空 schema 上执行 `prisma/migrations-postgres/*.sql`，再用 `prisma migrate diff --from-url --to-schema-datamodel --exit-code` 对照当前数据模型。漂移检查退出码不是 0 时，job 失败并打印差异。通过之后插入再删除 `ci-probe`，然后跑原来的单元测试。

`scripts/apply-postgres-migration.sh` 的步骤：

1. 拒绝非 PostgreSQL 的 `DATABASE_URL`。
2. 读取 `POSTGRES_SCHEMA`，否则用 URL 里的 `schema`，默认 `public`。
3. `DROP SCHEMA ... CASCADE` 后 `CREATE SCHEMA`，再 `SET search_path`，因此执行前这个 schema 是空的。
4. 按文件名顺序用 `psql -v ON_ERROR_STOP=1` 执行 `prisma/migrations-postgres/*.sql`。目前是 `0001_init.sql` 和阶段 3 追加的 `0002_comment_collapse.sql`。没有读取 `prisma/migrations` 里的 SQLite SQL。
5. `--generate` 时才生成 PostgreSQL Prisma Client。仓库里的 `prisma/schema.prisma` 仍是 `sqlite`。
6. 漂移检查。退出码 0 表示没有差异，2 表示有差异。
7. 在该 schema 写入并删除一行 `User`，确认表可写。

会连库的单元测试（并发投票、热度排序）在 PostgreSQL 上改为调用这个脚本，各自建 `concurrency` 和 `ranking_sql` schema。它们不再 `db push`。SQLite 路径仍是 `file:/tmp/hn-concurrency.db` 和 `file:/tmp/hn-ranking-sql.db`。原来的 `test` job 没有改，仍跑 SQLite、lint、typecheck 和 Playwright。

## 开工前基线

2026-11-27 09:50 UTC，头提交 `67576525d698f476658db6e330d2297ea329ff09`：

```text
npx vitest run
Test Files  24 passed (24)
Tests       139 passed (139)
Start at    09:50:56
Duration    2.85s

npm run test:e2e
23 passed (40.9s)
```

## 如何验证

```bash
bash -n scripts/apply-postgres-migration.sh
DATABASE_URL=file:./dev.db bash scripts/apply-postgres-migration.sh
npx vitest run
```

推送后看同一次 workflow 的 `test` 和 `postgres`。`postgres` 日志应出现 `Applying PostgreSQL migration SQL to empty schema public`、`PostgreSQL migration drift check passed for schema public`，以及单元测试里 `ranking_sql` 和 `concurrency` 的同样句子。不应再出现 `prisma db push` 作为这个 job 的建表步骤。

本机没有 `psql`，也没有 PostgreSQL 服务，所以空库执行和漂移检查以 GitHub Actions 为准。

## 结果证据

本机：

```text
DATABASE_URL=file:./dev.db bash scripts/apply-postgres-migration.sh
Refusing to apply because DATABASE_URL is not a PostgreSQL URL
exit 1

npx vitest run
Test Files  24 passed (24)
Tests       139 passed (139)
Start at    09:53:27
Duration    2.53s
```

139 与开工前相同。本阶段没有新增测试，也没有删除或放宽原有断言。

推送运行 [45977501868](https://github.com/bob1525/Hacker-News-build/actions/runs/45977501868) 结论 success：

| job | 结果 | 时间 |
| --- | --- | --- |
| `postgres` [140432813200](https://github.com/bob1525/Hacker-News-build/actions/runs/45977501868/job/140432813200) | success | 2026-11-27 09:53:48Z 到 09:55:35Z，约 1 分 47 秒 |
| `test` [140432813418](https://github.com/bob1525/Hacker-News-build/actions/runs/45977501868/job/140432813418) | success | 2026-11-27 09:53:47Z 到 09:55:54Z，约 2 分 7 秒 |

`postgres` 日志：

```text
Applying PostgreSQL migration SQL to empty schema public
CREATE TABLE
PostgreSQL migration drift check passed for schema public
PostgreSQL migration SQL applied on empty schema public
Applying PostgreSQL migration SQL to empty schema ranking_sql
PostgreSQL migration drift check passed for schema ranking_sql
✓ tests/unit/ranking-sql.test.ts (8 tests)
Applying PostgreSQL migration SQL to empty schema concurrency
PostgreSQL migration drift check passed for schema concurrency
Test Files  24 passed (24)
Tests       139 passed (139)
```

漂移检查退出码为 0，没有可接受差异需要单独说明。`test` job 仍是 SQLite：139 个单元测试，端到端 `23 passed (49.9s)`。

## 发现的问题

- `prisma db execute` 把整段脚本交给查询引擎。多语句迁移在 prepared statement 里经常被拒绝，所以执行改用 `psql -f`。漂移检查仍用 Prisma。
- `?schema=` 是 Prisma 的参数，libpq 不认识。`psql` 使用去掉 query 的连接串，schema 由 `SET search_path` 指定。
- 本机没有 PostgreSQL，空库执行只在 CI 上做过。那次漂移检查没有差异。
- 端到端和默认开发库仍是 SQLite。`scripts/push-postgres-schema.sh` 还在，但 `postgres` job 不再调用它。
