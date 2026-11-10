# 第六轮阶段 2：在 PostgreSQL 上运行单元测试

## 做了什么

`postgres` 这个 GitHub Actions job 不再在建表之后把 `DATABASE_URL` 改回 SQLite。它先用临时 schema 生成 PostgreSQL Prisma Client，再把同一份 `npm test` 连到 `postgres:16`。

- `scripts/with-postgres-schema.sh` 把 `prisma/schema.prisma` 复制到 `node_modules/.cache`，只把 provider 改成 `postgresql`，并指定客户端输出目录。仓库里的 schema 保持 `sqlite`。临时文件放在项目内，是因为 Prisma 会从 schema 所在目录向上找 `package.json`；放在 `/tmp` 时它会把项目根推断成 `/` 并尝试在那里安装依赖。
- `scripts/push-postgres-schema.sh` 依次执行 `prisma generate`、`prisma db push`，然后插入并删除 `ci-probe`。生成的客户端留在 job 里，供后面的单元测试使用。
- `.github/workflows/ci.yml` 的 `postgres` job 去掉了 `DATABASE_URL: file:./prisma/ci-unit.db`。单元测试使用 job 上的 `postgresql://hn:hn@localhost:5432/hackernews?schema=public`。原来的 `test` job 仍生成 SQLite 客户端，并继续跑 lint、typecheck、单元测试和 Playwright。
- `tests/helpers/database.ts`：`DATABASE_URL` 是 PostgreSQL 时，并发投票和热度排序各自使用一个 schema（`concurrency`、`ranking_sql`），先 `DROP SCHEMA` 再 `db push`。否则仍使用 `file:/tmp/hn-concurrency.db` 和 `file:/tmp/hn-ranking-sql.db`。
- `vitest.config.ts` 在 PostgreSQL 上关闭 `fileParallelism`，避免两个测试文件同时改同一个服务器。
- `lib/domain/ranking-sql.ts` 在 PostgreSQL 上改用带引号的表名、`$1` 占位符、`strpos`、`power(x, 1.8)`，并用 `timestamp(3)` 计算小时年龄。SQLite 仍走原来的 Newton 迭代，因为 Prisma 自带的 SQLite 没有 `power()`。
- `lib/sql-dialect.ts` 让搜索 SQL 在两种数据库上使用各自的函数和占位符。SQLite 的句子与改动前一致。

## 如何验证

本机没有 Docker，也没有 `psql`，所以 PostgreSQL 上的实际执行以 GitHub Actions 的 `postgres` job 为准。本机验证的是 SQLite 路径没有被改坏，以及 PostgreSQL schema 能生成客户端。

```bash
bash -n scripts/with-postgres-schema.sh
bash -n scripts/push-postgres-schema.sh
DATABASE_URL=file:./dev.db bash scripts/push-postgres-schema.sh
DATABASE_URL=postgresql://hn:hn@127.0.0.1:5432/hackernews bash scripts/with-postgres-schema.sh prisma validate
DATABASE_URL=postgresql://hn:hn@127.0.0.1:5432/hackernews bash scripts/with-postgres-schema.sh prisma generate
npx prisma generate
npx tsc --noEmit
npx vitest run
```

`npx prisma generate` 用来把本机客户端恢复成 SQLite。推送后查看同一次 workflow 里的 `test` 和 `postgres`。`postgres` 的 Unit tests 步骤不应再出现 `file:./prisma/ci-unit.db`，日志里应有 PostgreSQL 的 schema push，以及并发、热度测试对自己 schema 的 `db push`。

## 结果证据

本机：

```text
DATABASE_URL=file:./dev.db bash scripts/push-postgres-schema.sh
Refusing to push because DATABASE_URL is not a PostgreSQL URL
exit 1

prisma validate（临时 postgresql schema）
The schema at node_modules/.cache/hn-postgres-schema.*.prisma is valid

prisma generate（同一份临时 schema）
Generated Prisma Client (v6.19.3) to ./node_modules/.prisma/client
datasource provider = "postgresql"

npx prisma generate
datasource provider = "sqlite"

npx tsc --noEmit
通过

npx vitest run
Test Files  24 passed (24)
Tests       137 passed (137)
Start at    16:38:57
Duration    2.49s
```

137 = 第六轮开始时的 130 + 阶段 1 的 4 + 本阶段新增的 3。新增的 3 个在 `tests/unit/sql-dialect.test.ts`，锁定 SQLite 搜索句子、PostgreSQL 占位符，以及从 `DATABASE_URL` 判断方言。原有的 6 个热度测试和 2 个并发投票测试都还在，断言没有放宽。

第一次推送的运行 [42856781817](https://github.com/bob1525/Hacker-News-build/actions/runs/42856781817) 中，`postgres` job [129971869880](https://github.com/bob1525/Hacker-News-build/actions/runs/42856781817/job/129971869880) 成功，约 1 分 25 秒。日志有 `PostgreSQL schema push and probe write succeeded`，随后：

```text
Datasource "db": PostgreSQL database "hackernews", schema "public" at "localhost:5432"
Datasource "db": PostgreSQL database "hackernews", schema "ranking_sql" at "localhost:5432"
✓ tests/unit/ranking-sql.test.ts (6 tests)
Datasource "db": PostgreSQL database "hackernews", schema "concurrency" at "localhost:5432"
✓ tests/unit/concurrency.test.ts (2 tests)
Test Files  24 passed (24)
Tests       137 passed (137)
Start at    16:40:59
Duration    10.01s
```

同一次运行的 `test` job [129971869399](https://github.com/bob1525/Hacker-News-build/actions/runs/42856781817/job/129971869399) 在 typecheck 失败，单元测试和端到端没有跑到。`sqlDialect` 和测试辅助函数把参数标成 `NodeJS.ProcessEnv`，对象字面量 `{ DATABASE_URL: "..." }` 在 `next typegen` 之后对不上。本机当时只跑了 `tsc --noEmit`，没有先跑 `next typegen`。参数改成可选的 `{ DATABASE_URL?: string }`，缺省时再读 `process.env.DATABASE_URL`。本机 `npm run typecheck` 随后通过。修正后的全绿运行补在下一节。

## 发现的问题

- 临时 schema 最初写在 `/tmp`。`prisma generate` 找不到 `package.json`，报 `inferred project root /`，并执行失败的 `npm i prisma@6.19.3`。改到 `node_modules/.cache` 后，validate 和 generate 都成功。
- 本机没有 PostgreSQL 服务，热度 SQL 和并发投票还没有在本机对真实服务器执行。SQLite 上的同一批测试已通过。两种方言的差异（引号、占位符、`instr`/`strpos`、整数毫秒和 `timestamp(3)`、`power()`）写进了查询分支，由 CI 执行。
- 搜索的原始 SQL 已按方言切换，但现有搜索测试不连数据库，所以 PostgreSQL 上的搜索执行仍没有集成测试覆盖。热度和并发是会连库的单元测试。
- 端到端仍在 `test` job 里使用 SQLite。这个 job 不跑 Playwright。
- 已提交的迁移仍是 SQLite，不能 `migrate deploy` 到 PostgreSQL。这个 job 继续用 `db push`。正式迁移 SQL 是阶段 3。
- 在本机运行 `scripts/push-postgres-schema.sh` 会把 Prisma Client 换成 PostgreSQL。用完需要再执行 `npx prisma generate` 恢复 SQLite 客户端。
