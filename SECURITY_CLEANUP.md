# 敏感配置清理

第三轮阶段 1 的自检。目标是让 `.env` 离开 Git 索引，并在应用启动时拒绝缺失、占位符或过短的 `AUTH_SECRET`。

## 做了什么

- 确认 `.env` 从首次功能提交 `7e36ef6` 起就被跟踪。
- 在 `.gitignore` 中忽略 `.env`（以及 `.env.development`、`.env.production`），并用 `!.env.example` 保证示例文件仍可提交。
- `git rm --cached .env` 只从索引移除，工作区副本还在，方便本机继续跑。
- `.env.example` 的 `AUTH_SECRET` 改为 `CHANGE_ME_TO_A_LONG_RANDOM_STRING`，并写明生产环境必须更换、如何生成随机值。
- 删掉 `lib/session-token.ts` 里静默使用的内置弱密钥。签名前必须通过 `lib/auth-secret.ts` 的检查。
- `instrumentation.ts` 在 Next.js 启动时调用同一检查。Node 运行时打印原因后 `process.exit(1)`。
- README 增加本地生成 `.env` 的步骤。单元测试和端到端测试各自设置合规密钥，seed 只依赖 `DATABASE_URL`。

## git ls-files 对比

清理前：

```text
.env
.env.example
```

清理后：

```text
.env.example
```

`git check-ignore -v .env` 命中 `.gitignore` 第 35 行的 `.env`。`git status` 不再把工作区 `.env` 显示为未跟踪或已修改文件。

## .gitignore 改动

原先只忽略 `.env.local` 和 `.env.*.local`，所以根目录 `.env` 可以进仓库。

现在这一段是：

```gitignore
# Local secrets. Commit .env.example only.
# .env used to be tracked; keep it ignored so AUTH_SECRET stays off the remote.
.env
.env.local
.env.*.local
.env.development
.env.production
!.env.example
```

## 启动校验

拒绝规则：

- 缺失或只有空白。
- 含有 `change_me`、`change-me`、`replace-with`、`placeholder`、`your-secret`（不区分大小写）。因此示例占位符和旧的 `.env.example` 值都会被拒绝，即使长度已经超过 32。
- 去掉首尾空白后短于 32 个字符。先前提交进仓库的值是 31 个字符，按这条也会被拒绝。

`tests/unit/auth-secret.test.ts` 覆盖缺失、占位符、旧的内置回退串、31 字符、恰好 32 字符、测试与端到端使用的密钥、`assertAuthSecret` 抛错、`enforceAuthSecretOrExit` 以状态码 1 退出，以及未设置密钥时 `signSession` 拒绝签名。

另外直接调用 `register()`：

- `AUTH_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_STRING`：打印占位符错误，进程退出码 1。
- 未设置 `AUTH_SECRET`：打印缺失错误，进程退出码 1。
- 合规密钥：打印 `STARTED`，退出码 0。

`AUTH_SECRET` 设为占位符时，`npx next dev` 编译 instrumentation 后打印同一条错误，开发服务器进程随之停止，没有继续监听。Next.js 的 dev CLI 在子进程退出后自己执行 `process.exit(0)`，所以外壳命令的退出码是 0。服务没有留在运行中。

同一占位符下，`npx next build` 成功之后再 `npx next start`：打印错误，命令退出码是 1。换成合规密钥后 `next start` 显示 Ready，`GET /` 返回 200。

## 如何验证

```bash
git ls-files | grep -E '\.env'
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

## 发现的问题

- `.gitignore` 的注释写成 “can opt-in for committing if needed”，和只忽略 `.env.local` 一起，让真正的 `.env` 被提交。
- 会话签名在环境变量缺失时会落到硬编码字符串，启动失败被掩盖成“能登录，但是密钥是公开的”。
- 旧示例值 `replace-with-a-long-random-string` 长于 32，只检查长度挡不住。占位符匹配是单独一条。
- `next dev` 的父进程在子进程退出后固定以 0 退出。错误已经打出，服务器也停了，但不要用 dev 命令的退出码做生产门禁。`next start` 的退出码是 1，可以做门禁。

## 最终状态

`.env` 不在 Git 索引里。示例文件使用明显占位符。应用不再静默使用弱密钥。lint 通过，typecheck 通过，Vitest 19 个文件、111 个测试通过（本阶段新增 9 个），Playwright 23 个测试通过。

## 剩余风险

历史提交 `7e36ef6` 仍然包含当时的 `.env`。这次没有改写历史，已经克隆过仓库的人本地仍能看到旧值。如果有部署用过那个值，需要另行轮换；Git 历史里的副本不会因为停止跟踪而消失。速率限制、重复检测和规模方面的限制没有在本阶段改动，仍以 `SAFETY_AND_LIMITS.md`、`SCALE_TEST.md` 和 `FINAL_AUDIT.md` 为准。
