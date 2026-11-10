# PostgreSQL CI

第五轮阶段 3 的自检。在原有 SQLite job 旁边增加一个 PostgreSQL job。默认测试路径没有改。现有 SQLite 迁移不能在 PostgreSQL 上重放，所以 CI 用 `prisma db push` 作为临时方案。

第六轮阶段 2 起，这个 job 会生成 PostgreSQL 客户端并让单元测试连到 PostgreSQL。下面记录的是第五轮当时的做法。现行步骤见 `POSTGRES_TESTS.md`。

## 具体做了什么

- `.github/workflows/ci.yml` 保留原来的 `test` job：lint、typecheck、`npm test`、Playwright，数据库仍是 SQLite。
- 新增 job `postgres`。它启动 `postgres:16`，用健康检查等待就绪，把 `DATABASE_URL` 指到这个服务，然后运行 `scripts/push-postgres-schema.sh` 和 `npm test`。
- 脚本复制 `prisma/schema.prisma`，只把 datasource 的 provider 从 `sqlite` 改成 `postgresql`，再 `prisma db push --skip-generate`。不改仓库里的 schema，也不生成新的客户端。
- push 成功后向 `"User"` 插入一行 `ci-probe` 再删掉，确认表可写。
- `npm test` 在这个 job 里把 `DATABASE_URL` 改回 `file:./prisma/ci-unit.db`。单元测试的 Prisma Client 仍按 SQLite 生成，并发投票测试自己使用 `file:/tmp/hn-concurrency.db`。

## 如何验证

```bash
bash -n scripts/push-postgres-schema.sh
rg -n "services:|postgres:16|push-postgres-schema" .github/workflows/ci.yml
```

推送之后看 GitHub Actions 里同一次 workflow 的 `test` 和 `postgres` 两个 job。本机没有 Docker，也没有 `psql`，所以没有在本地再起一个 PostgreSQL。

## workflow 里的关键配置

`postgres` job 的服务：

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: hn
      POSTGRES_PASSWORD: hn
      POSTGRES_DB: hackernews
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U hn -d hackernews"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
env:
  DATABASE_URL: postgresql://hn:hn@localhost:5432/hackernews?schema=public
```

应用 schema 的步骤是 `bash scripts/push-postgres-schema.sh`。单元测试步骤单独覆盖 `DATABASE_URL=file:./prisma/ci-unit.db`。

## 迁移处理方式

`prisma/migrations/migration_lock.toml` 的 provider 是 `sqlite`。迁移 SQL 使用 `DATETIME` 和 SQLite 的建表语句。`prisma migrate deploy` 不能把这套 SQL 拿到 PostgreSQL 上执行。

当前模型没有 enum、Boolean、Json 或 Decimal。`String`、`DateTime`、可空 `String` 和复合主键可以由 Prisma 按 PostgreSQL 重新生成：`DateTime` 会变成 `timestamp(3)`，文本列仍是 text。这次 CI 不生成那份 SQL，只让 `db push` 按 schema 建表。

以后若要正式迁移，在一份只连接空 PostgreSQL 的环境里把 provider 改成 `postgresql`，用 `prisma migrate diff --from-empty --to-schema-datamodel` 生成新的 SQL，并单独放一套迁移目录。不要把现有 SQLite 目录重放过去。步骤的其余部分见 [DB_MIGRATION.md](DB_MIGRATION.md)。

`db push --accept-data-loss` 只应该打在 CI 的空库或可丢弃的库上。它不是生产迁移命令。

## 结果证据

`bash -n scripts/push-postgres-schema.sh` 通过。把 `DATABASE_URL` 设成 `file:./dev.db` 再跑脚本，脚本拒绝执行并退出码 1，输出 `Refusing to push because DATABASE_URL is not a PostgreSQL URL`。

GitHub Actions 运行 [42850349762](https://github.com/bob1525/Hacker-News-build/actions/runs/42850349762) 结论 success，提交 `64ad88dfc31dfb09efbef45d594fc37a3ad94587`：

| job | 结果 | 时间 |
| --- | --- | --- |
| `postgres` [129949132694](https://github.com/bob1525/Hacker-News-build/actions/runs/42850349762/job/129949132694) | success | 2026-11-10 16:01:16Z 到 16:02:38Z，约 1 分 22 秒 |
| `test` [129949133118](https://github.com/bob1525/Hacker-News-build/actions/runs/42850349762/job/129949133118) | success | 同一次运行，约 2 分 12 秒 |

`postgres` job 的日志有 `PostgreSQL schema push and probe write succeeded`，随后单元测试是 21 个文件、124 个测试通过。`test` job 同样是 124 个单元测试通过，端到端 `23 passed`。本机没有 Docker 或 `psql`，没有另做一份本地 PostgreSQL。

日志里的 Node.js 20 弃用提示和 Ubuntu 26 迁移提示没有让 job 失败。

## CI 运行

上面这次 push 运行就是本阶段的证据。两个 job 都是 success。

## 当前限制与后续改进

- 单元测试没有改用 PostgreSQL 客户端。同一份生成的 Client 不能既连 SQLite 又连 PostgreSQL。这个 job 证明 schema 能在 PostgreSQL 上建出来并能写入，然后原样跑 SQLite 单元测试。
- 没有跑 Playwright。端到端仍在 `test` job 里用 SQLite。
- 速率限制的 Redis 或 SQLite 文件不在这个 job 里。业务库和限额存储仍是两件事。
- 正式迁移应该换成 `migrate deploy` 可以跟踪的 PostgreSQL SQL，而不是每次 `db push`。

## 发现的问题与处理方式

- 直接 `migrate deploy` 会在 PostgreSQL 上执行 SQLite 语法。脚本因此拒绝非 `postgresql://` URL，并且只改临时副本里的 provider。
- 本机没有 Docker 或 `psql`，本地等效命令无法在这里执行。以 GitHub Actions 的 `postgres` job 作为证据。
