# GitHub Actions

第三轮阶段 4 的自检。仓库以前没有 workflow，PR 上的 check runs 是 0。这一阶段加上 `.github/workflows/ci.yml`，让 push 和 pull request 都跑检查。

## 做了什么

新增一个 job `test`，跑在 `ubuntu-latest`，Node.js 22，超时 25 分钟。同一 ref 上新的运行会取消还没结束的上一次。

## 触发条件

```yaml
on:
  push:
  pull_request:
```

推到任何分支，以及打开或更新 pull request，都会启动。PR 页面的 Checks 区可以看到这次运行。

## 步骤

1. `actions/checkout@v4` 取出代码。
2. `actions/setup-node@v4` 安装 Node.js 22，并按 `package-lock.json` 缓存 npm。
3. `npm ci` 安装依赖。`postinstall` 会执行 `prisma generate`。
4. `npm run lint`
5. `npm run typecheck`
6. `npm test` 跑 Vitest。并发投票测试自己在 `/tmp` 建库，不依赖仓库里的 `.env`。
7. 若 runner 上没有 Google Chrome，则安装 `google-chrome-stable`。Playwright 配置使用 `channel: "chrome"`，要的是系统里的 Chrome，不是内置 Chromium。
8. `npx playwright install-deps chrome` 安装浏览器系统库。
9. `npm run test:e2e`。Playwright 会自行迁移并灌入 `prisma/e2e.db`，再 `next build` 和 `next start`。job 里另设了合规的 `AUTH_SECRET`，避免启动校验因为缺少密钥而退出。端到端配置自己也会写入一个长度足够的测试密钥。

## workflow 文件

完整内容在 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)。关键片段：

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run test:e2e
        env:
          CI: true
          AUTH_SECRET: ci-auth-secret-not-for-production-use-32
```

Chrome 安装和 `playwright install-deps` 在单元测试和端到端测试之间，完整命令以仓库里的 yml 为准。

## 如何在 GitHub 上查看

- PR：打开 https://github.com/bob1525/Hacker-News-build/pull/1 ，切到 Checks。
- 全部运行：https://github.com/bob1525/Hacker-News-build/actions/workflows/ci.yml
- 命令行：`gh run list --repo bob1525/Hacker-News-build --branch cursor/hacker-news-community-1102`

## 当前限制

- 端到端测试依赖系统 Google Chrome。配置没有改成 CI 专用的 Chromium，以免和本地用的浏览器通道分成两套。
- 速率限制仍然是进程内内存，CI 只证明单进程行为。
- 没有部署步骤，也没有把规模基准 `scripts/scale-bench.ts` 放进 CI。那是本地测量命令。

## 发现的问题

提交工作流之前，这个 PR 没有 check runs。工作流文件是新加的，第一次 push 才会让 GitHub 创建运行。

第一次运行没有失败，不需要改测试或工作流。日志里有两条不导致失败的提示：`actions/checkout@v4` 和 `actions/setup-node@v4` 仍声明 Node.js 20，runner 实际用 Node.js 24 执行 action；`ubuntu-latest` 计划迁到 Ubuntu 26。检查结论仍是 success。

## 如何验证

推送后看上面的 Actions 链接。lint、typecheck、单元测试、端到端测试都要成功，这一阶段才算通过。失败就改到通过为止。

## 当前运行结果

提交 `27034861da28cc22865b6f0d1071d6d43bbdf743` 同时触发了 push 和 pull_request。两条都是 success，job 名都是 `test`。

| 事件 | Run | Job | 结论 | 耗时 |
| --- | --- | --- | --- | --- |
| push | [42833139524](https://github.com/bob1525/Hacker-News-build/actions/runs/42833139524) | [129888178636](https://github.com/bob1525/Hacker-News-build/actions/runs/42833139524/job/129888178636) | success | 5 分 3 秒 |
| pull_request | [42833146338](https://github.com/bob1525/Hacker-News-build/actions/runs/42833146338) | [129888201096](https://github.com/bob1525/Hacker-News-build/actions/runs/42833146338/job/129888201096) | success | 4 分 58 秒 |

push 那次的日志：

- Lint、Typecheck、Unit tests、Install Google Chrome、Install Playwright system libraries、End-to-end tests 全部 success。
- Vitest：19 个文件通过，111 个测试通过，耗时 3.61 秒。
- Playwright：23 passed（1.4 分钟）。

PR #1 的 Checks 里这两条 `test` 都已结束并通过。这次只改文档的提交会再触发同一套 workflow，上面两行是第一次完整运行的结果。

## 最终状态

`.github/workflows/ci.yml` 已在分支上，并且在 PR 上真实跑通。lint、typecheck、111 个单元测试和 23 个端到端测试在 GitHub Actions 里都通过。
