# 第三轮审计

这一轮补审查里指出的缺口：停止跟踪 `.env`、把 README 同步到当前实现、补第二轮功能截图、加上 GitHub Actions，并把 PR 里的自检文档改成可点击的绝对地址。没有删除或放宽原有测试。

## 五个阶段

| 阶段 | 自检文档 | 提交 | 结论 |
| --- | --- | --- | --- |
| 1 敏感配置 | [SECURITY_CLEANUP.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/SECURITY_CLEANUP.md) | `7cbf47e5ac0f444d3fa2b17618857d3fd2a1c19c` | `.env` 移出 Git 索引。缺失、占位符或短于 32 字符的 `AUTH_SECRET` 会在启动时报错并退出。 |
| 2 README | [README_UPDATE.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/README_UPDATE.md) | `cff104e2e2320bc23485eaa10f8e8b471274831c` | 评论改为先按票数降序、再按时间升序。收藏、关注、速率限制、重复检测和六份自检文档都写进 README。 |
| 3 截图 | [SCREENSHOTS_UPDATE.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/SCREENSHOTS_UPDATE.md) | `1fc409159ceca8202e0b74c2f7ba5feab833300b` | 新增 5 张第二轮功能截图，并在 README 对应说明旁引用。 |
| 4 CI | [CI_SETUP.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/CI_SETUP.md) | `27034861da28cc22865b6f0d1071d6d43bbdf743` 添加 workflow，`353db33e3e0f2c6e9e4095377c7db29cb936ca96` 写入运行结果 | push 与 pull_request 的 `test` 检查都是 success。 |
| 5 收尾 | 本文件 | 包含本文件的那次提交 | PR 描述改为绝对链接，并附上第三轮摘要。 |

## 自检文档

- https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/SECURITY_CLEANUP.md
- https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/README_UPDATE.md
- https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/SCREENSHOTS_UPDATE.md
- https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/CI_SETUP.md
- https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/THIRD_ROUND_AUDIT.md
- https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/RANKING_VERIFICATION.md
- https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/COMMENT_SYSTEM.md
- https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/USER_INTERACTIONS.md
- https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/SAFETY_AND_LIMITS.md
- https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/SCALE_TEST.md
- https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/FINAL_AUDIT.md

## 主要文件

- `.gitignore`、`.env.example`：忽略 `.env`，示例密钥改为占位符。`.env` 已从索引删除。
- `lib/auth-secret.ts`、`instrumentation.ts`、`lib/session-token.ts`：启动时拒绝弱密钥，不再使用内置回退值。
- `tests/unit/auth-secret.test.ts`：本轮唯一新增的测试文件，9 个测试。
- `README.md`：与当前评论排序、互动、限制和目录对齐。
- `scripts/capture-screenshots.mjs` 和 `docs/screenshots/` 下 5 张新图。
- `.github/workflows/ci.yml`：push 和 pull_request 时跑 lint、typecheck、单元测试和端到端测试。

## 测试证据

第三轮开始前：`npm run lint` 通过，`npm run typecheck` 通过，Vitest 18 个文件、102 个测试通过，Playwright 23 个测试通过。

阶段 5 再次执行：

- `npm test`：Test Files 19 passed，Tests 111 passed。其中 `tests/unit/auth-secret.test.ts` 是本轮新增的 9 个，原来的 102 个仍在。
- `npm run test:e2e`：23 passed（33.3 秒）。

GitHub Actions 在 `27034861da28cc22865b6f0d1071d6d43bbdf743` 上的 push 运行 [42833139524](https://github.com/bob1525/Hacker-News-build/actions/runs/42833139524) 同样是 19 个文件、111 个单元测试通过，Playwright 23 passed。pull_request 运行 [42833146338](https://github.com/bob1525/Hacker-News-build/actions/runs/42833146338) 结论也是 success。

`git ls-files | grep -E '\.env$'` 没有输出。索引里只保留 `.env.example`。

## 未解决的已知限制

这些限制来自 [SCALE_TEST.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/SCALE_TEST.md) 和 [FINAL_AUDIT.md](https://github.com/bob1525/Hacker-News-build/blob/cursor/hacker-news-community-1102/FINAL_AUDIT.md)，本轮没有改掉：

- 速率限制存在单个 Node 进程的内存里。重启清空，多实例不共享。
- 重复检测是规范化后的全文相等，或 bigram Dice ≥ 0.9，只看时间窗内同一用户的内容。
- 评论编辑窗口是 15 分钟。软删除后数据库仍留着原文，页面不再把它发回去。
- 折叠状态只在当前浏览器会话的 `sessionStorage`。
- 热度排序先取出候选再在内存分页。220 篇帖子时首页查询约 4 ms，页面中位数约 13.3 ms。几万篇需要下推到数据库。
- SQLite 同时只能有一个写者。投票在进程内排队。多进程同时写仍可能遇到 database is locked。
- 没有邮箱验证，没有反对票，评论最多嵌套 8 层。

本轮新留下的限制：

- 历史提交 `7e36ef6` 里仍然有当时的 `.env`。这次没有改写历史。
- `next dev` 的父进程在子进程因密钥退出后会自己以状态码 0 结束。`next start` 的退出码是 1。
- 截图脚本在 `next dev` 下连续跳转时，开发服务器曾对 `/user/pg` 返回 500（`Unexpected end of JSON input`）。同一流程在 `next start` 和 CI 的端到端测试里通过。没有为此改应用代码。
- CI 日志有两条不失败的提示：checkout 和 setup-node 的 Node 20 声明，以及 `ubuntu-latest` 将迁到 Ubuntu 26。规模基准没有放进 CI。

## 总体结论

第三轮五个阶段都完成了。`.env` 不再被跟踪，README 与实现一致，第二轮功能有截图，GitHub Actions 已在 PR 上跑通，自检文档可以用绝对地址打开。原有 102 个单元测试和 23 个端到端测试仍然全部通过，另外新增 9 个密钥校验测试。
