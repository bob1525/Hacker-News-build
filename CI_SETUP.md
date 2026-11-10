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

## 如何验证

推送后看上面的 Actions 链接。lint、typecheck、单元测试、端到端测试都要成功，这一阶段才算通过。失败就改到通过为止。

## 当前运行结果

这一节在第一次运行结束前先留空，运行完成后补上 run id、结论和链接。

## 最终状态

workflow 已放进分支。运行结论见「当前运行结果」。
