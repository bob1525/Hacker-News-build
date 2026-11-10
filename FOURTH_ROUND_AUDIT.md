# 第四轮审计

本轮在现有分支 `cursor/hacker-news-community-1102` 上处理第三轮报告第四节留下的三件事：历史密钥、速率限制持久化、以及生产环境要先写清的数据库和排序限制。没有新开仓库，没有重写 git 历史，没有删除或放宽已有测试。

## 开始前的测试

阶段 1.1 之前，在第四轮任何改动之前，完整套件已经通过：

- `npm run lint` 通过
- `npm run typecheck` 通过
- Vitest 19 个文件、111 个测试通过
- Playwright 23 passed

下面各阶段没有改这 111 个单元测试和 23 个端到端测试的断言。阶段 5 再跑一遍时，它们仍在通过的 117 和 23 里面。

## 阶段完成情况

| 阶段 | 自检文档 | 提交 |
| --- | --- | --- |
| 1 历史密钥 | [HISTORY_CLEANUP.md](HISTORY_CLEANUP.md) | `273e4da741c74039b3bb1af63e68d87ffffad4bc` |
| 2 速率限制存储 | [RATE_LIMIT_PERSISTENCE.md](RATE_LIMIT_PERSISTENCE.md) | `d4cec2f4d6e4ad09134030ef5a4e79f1f764b83e` |
| 3 数据库迁移 | [DB_MIGRATION.md](DB_MIGRATION.md) | `a6c8325de02d3b538b6c56fd85810d36f3cf1238` |
| 4 热度排序规模 | [RANKING_SCALABILITY.md](RANKING_SCALABILITY.md) | `aef8a6230dc9b9d2a4d3ed17f19e90b7f0f195e0` |

### 阶段 1

`git log --all --full-history -- .env` 只看到 `7e36ef6` 加入和 `7cbf47e` 删除。`.env` 出现在 6 个提交的树里，从 `7e36ef6cdae9b0add2eee057615d6c938bf68839` 到 `362c02d429f1b2170e3587e3b1192a10b4d34f44`。当前索引里没有 `.env`。README 和 `.env.example` 要求新的、至少 32 字符的随机 `AUTH_SECRET`，并写明旧密钥已在历史中暴露，不能再用。清理步骤覆盖 `git filter-repo` 和 BFG，包括 force push 之后协作者必须重新克隆。本轮没有执行重写。

### 阶段 2

`RateLimitStore` 有 `check`、`record`、`clear`。默认 `MemoryRateLimitStore`，`consumeRateLimit` 的调用方式不变。`RATE_LIMIT_BACKEND=sqlite` 使用单独的 SQLite 文件，默认 `prisma/rate-limits.db`，不进 Prisma 业务库。新增 `tests/unit/rate-limit-store.test.ts` 的 6 个测试。原 `tests/unit/rate-limit.test.ts` 的 5 个测试未改且通过。

### 阶段 3

`DB_MIGRATION.md` 写了单写者、文件锁和不适合多实例。PostgreSQL 步骤包括改 provider、注释中的连接串、不要重放 SQLite 迁移、以及用 `prisma migrate diff` 生成新 SQL。`.env.example` 生效的仍是 `file:./dev.db`。测试继续在 SQLite 上跑。

### 阶段 4

引用 [SCALE_TEST.md](SCALE_TEST.md) 的 220 篇实测：帖子查询 4.0 ms，搜索 1.5 ms，用户页查询 2.2 ms，页面中位数 13.3 ms、10.4 ms、13.5 ms。更大的数字标明为线性外推。SQL 草案按同一热度公式 `ORDER BY`，并用 `LIMIT` / `OFFSET` 对应现有分页。没有改 `getFeed`。

## 主要文件

新增：

- `HISTORY_CLEANUP.md`
- `RATE_LIMIT_PERSISTENCE.md`
- `DB_MIGRATION.md`
- `RANKING_SCALABILITY.md`
- `FOURTH_ROUND_AUDIT.md`
- `lib/domain/sqlite-rate-limit-store.ts`
- `node-sqlite.d.ts`
- `tests/unit/rate-limit-store.test.ts`

修改：

- `README.md`
- `.env.example`
- `lib/domain/rate-limit.ts`
- `lib/limits.ts`
- `tsconfig.json`

## 测试证据

阶段 5 在写入本文档之前执行：

```text
npm run lint        通过
npm run typecheck   通过
vitest              Test Files  20 passed (20)
                    Tests       117 passed (117)
playwright          23 passed
```

原有 111 个单元测试都在这 117 里。本轮新增 6 个，全部在 `tests/unit/rate-limit-store.test.ts`。端到端仍是 23 passed，没有新增也没有删除。`node:sqlite` 在导入时打印 ExperimentalWarning，测试没有因此失败。

## GitHub Actions

本段在推送阶段 5 之后，根据这次提交触发的 `test` 检查补写。补写前不要把这里当成已经通过。

## 仍未解决

- 评论折叠存在浏览器的 `sessionStorage`，换浏览器或清站点数据会丢。
- 没有邮箱验证，注册只检查用户名和密码。
- 没有反对票。
- 评论嵌套在第 8 层截止。
- 速率限制默认仍是进程内存。只有设置 `RATE_LIMIT_BACKEND=sqlite` 才写入文件，而且那个文件仍是单写者，多实例不会共享同一计数。
- 业务库仍是 SQLite。多实例和 PostgreSQL 只写在 [DB_MIGRATION.md](DB_MIGRATION.md)，没有切换。
- 热度排序仍在内存中。SQL 方案只写在 [RANKING_SCALABILITY.md](RANKING_SCALABILITY.md)。
- 旧 `AUTH_SECRET` 还在上述 6 个历史提交里。启动检查会拒绝那把 31 字符的密钥，但读得到旧提交的人仍能看到它。本轮按要求没有重写历史。
- `next dev` 在密钥不合格时，工作进程退出后父进程仍可能以 0 结束。`next start` 会以 1 结束。
