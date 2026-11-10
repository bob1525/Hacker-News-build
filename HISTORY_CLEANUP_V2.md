# 历史密钥清理准备（第五轮）

第五轮阶段 1 的自检。目标是把泄露范围、可直接复制的清理命令、清理后的验证，以及换密钥的要求写完整。没有执行 `git filter-repo`、BFG 或 force push。

## 具体做了什么

- 用 `git log --all --full-history --diff-filter=A -- .env` 确认 `.env` 只被添加过一次。
- 列出所有树里仍含 `.env` 的提交，并只根据长度和占位符特征判断 `AUTH_SECRET` 是弱值。没有把密钥原文写入本文或命令输出。
- 写下 `git filter-repo` 和 BFG 两套可复制命令，包括备份、清理后验证和 force push 的注意点。
- 在 README 顶部增加「安全警告」。`.env.example` 的 `AUTH_SECRET` 改为 `PLACEHOLDER_REPLACE_WITH_A_NEW_SECRET`，并写上 `openssl rand -base64 32`。
- 用现有的 `authSecretProblem` 复核：短于 32 字符会被拒绝，新占位符也会被拒绝。

## 泄露提交列表与证据

添加 `.env` 的提交只有一个。命令：

```bash
git log --all --full-history --diff-filter=A --format='%H %cI %s' -- .env
```

结果：

```text
7e36ef6cdae9b0add2eee057615d6c938bf68839 2026-11-10T06:59:49+00:00 Add a Hacker News-style community with votes, nested comments, and tests.
```

该提交的 blob 是 `6efb81098f3c4e59d8ed22e7c9db0364aefc1812`。删除发生在 `7cbf47e5ac0f444d3fa2b17618857d3fd2a1c19c`（2026-11-10 14:09:17 UTC，说明是 “Round 3 Phase 1: stop tracking .env and reject weak AUTH_SECRET.”）。它的父提交是 `362c02d429f1b2170e3587e3b1192a10b4d34f44`。`git ls-files` 现在匹配不到路径以 `.env` 结尾的文件。

下面 6 个提交的树里仍然有 `.env`。对每个提交只打印长度和是否像占位符，不打印值：

| 提交 | 时间 (UTC) | AUTH_SECRET |
| --- | --- | --- |
| `7e36ef6cdae9b0add2eee057615d6c938bf68839` | 2026-11-10 06:59:49 | 31 字符，不是占位符，短于 32，判定为弱值 |
| `b6b11ca876538dec7055ea0aca033c02d452b7c8` | 2026-11-10 13:21:38 | 同上 |
| `3d2ef497b0eb3730c5e525a44dc859296ebf0fbf` | 2026-11-10 13:27:21 | 同上 |
| `fc69bc4d8547c807a3ff5bbc65abae86a416dffb` | 2026-11-10 13:33:08 | 同上 |
| `0aaef3629a764d1e37ca4d5f8eac77ff2f8a9137` | 2026-11-10 13:36:00 | 同上 |
| `362c02d429f1b2170e3587e3b1192a10b4d34f44` | 2026-11-10 13:40:07 | 同上 |

弱值的理由：长度 31，小于 `lib/auth-secret.ts` 的 `MIN_AUTH_SECRET_LENGTH`（32）；内容不含 `change_me`、`change-me`、`replace-with`、`placeholder`、`your-secret`。启动检查会拒绝它，但读得到这些提交的人仍然看得到原文。

## 如何验证

```bash
git log --all --full-history --diff-filter=A --format='%H %cI %s' -- .env
git ls-files | grep -E '\.env$' || echo NO_TRACKED_DOTENV
npx tsx -e 'import { authSecretProblem } from "./lib/auth-secret.ts"; const samples = [["len31","x".repeat(31)],["len32","x".repeat(32)],["example","PLACEHOLDER_REPLACE_WITH_A_NEW_SECRET"]]; for (const [name, value] of samples) console.log(name, authSecretProblem(value) ? "REJECTED" : "ACCEPTED");'
npx vitest run tests/unit/auth-secret.test.ts
```

## 结果证据

添加记录只有 `7e36ef6cdae9b0add2eee057615d6c938bf68839`。当前索引输出 `NO_TRACKED_DOTENV`。

密钥检查输出：

```text
len31 REJECTED
len32 ACCEPTED
example REJECTED
```

`tests/unit/auth-secret.test.ts`：9 个测试通过。短于 32 字符、`CHANGE_ME_TO_A_LONG_RANDOM_STRING` 和 `replace-with-a-long-random-string` 的原有断言都还在。新占位符含有 `placeholder`，走同一条拒绝逻辑。

第五轮开始前的完整套件：`npm run lint` 通过，`npm run typecheck` 通过，Vitest 20 个文件、117 个测试通过，Playwright 23 passed。本阶段没有改测试，也没有改启动校验的代码。

## 完整清理命令

在维护者决定承受 force push 之前，不要运行下面的改写命令。先备份。

### 备份当前分支

```bash
git rev-parse HEAD
git branch backup/hacker-news-community-1102-before-filter HEAD
git bundle create ../hacker-news-before-filter.bundle --all
```

`backup/...` 分支和 bundle 留在执行清理的那台机器上。不要把含有 `.env` 的备份推回同一个远程，否则密钥还在。

### git filter-repo

在一份新的镜像克隆上做，避免改坏正在使用的工作区。

```bash
git clone --mirror git@github.com:bob1525/Hacker-News-build.git hn-mirror.git
cd hn-mirror.git
pip install git-filter-repo
git filter-repo --path .env --invert-paths
```

`git filter-repo` 会删掉 `origin`。确认历史里已经没有 `.env` 之后，再加回远程并 force push：

```bash
git log --all -- .env
git rev-list --all | while read -r sha; do
  git cat-file -e "$sha:.env" 2>/dev/null && echo "STILL_PRESENT $sha"
done
git remote add origin git@github.com:bob1525/Hacker-News-build.git
git push --force --all origin
git push --force --tags origin
```

`git log --all -- .env` 应没有任何提交。循环不应打印 `STILL_PRESENT`。

### BFG Repo-Cleaner

BFG 按文件名删除。`.env` 很小，不要用大小阈值。

```bash
git clone --mirror git@github.com:bob1525/Hacker-News-build.git hn-bfg.git
cd hn-bfg.git
java -jar bfg.jar --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git log --all -- .env
git remote add origin git@github.com:bob1525/Hacker-News-build.git
git push --force --all origin
git push --force --tags origin
```

`bfg.jar` 用 [BFG 发布页](https://rtyley.github.io/bfg-repo-cleaner/) 的当前版本。清理后的验证命令与 filter-repo 相同。

### force push 之后

- 所有提交 SHA 会变。现有 pull request 会断开，评论挂在旧 SHA 上。
- 协作者必须删除本地克隆，重新 `git clone`。旧本地仓库不能再推送；强行推送会把 `.env` 加回去。
- GitHub 的缓存、fork、CI 日志和其他人已经拉取的副本里仍可能有旧密钥。重写历史不能代替轮换。
- 轮换是强制的：用 `openssl rand -base64 32` 或 `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` 生成至少 32 字符的新值，写入本机 `.env`，生产环境再单独生成一把。

## 密钥更换的强制要求

1. 新密钥至少 32 个字符，并且是新的随机值。
2. 禁止使用历史提交里的 31 字符旧值。
3. 禁止使用 `.env.example` 里的 `PLACEHOLDER_REPLACE_WITH_A_NEW_SECRET`。
4. 生成命令：

```bash
openssl rand -base64 32
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`lib/auth-secret.ts` 在缺失、空白、含 `change_me` / `change-me` / `replace-with` / `placeholder` / `your-secret`，或长度小于 32 时拒绝启动。`instrumentation.ts` 在 Node 运行时调用 `enforceAuthSecretOrExit`，失败则 `process.exit(1)`。

## 风险声明

本阶段没有执行 filter-repo、BFG 或 force push。原因：重写会改掉 `cursor/hacker-news-community-1102` 上已有 pull request 的全部提交，协作者的本地克隆也会失效。文档里的命令是给仓库维护者在单独决定改写历史时用的。在那之前，旧密钥仍然留在上面列出的 6 个提交里，所以更换密钥是现在就必须做的事，不能等历史被清掉。

## 发现的问题与处理方式

- 只看 `--diff-filter=A` 会漏掉“文件还在后续提交里”这件事。本文同时列出了 6 个仍含该文件的树。
- 新占位符若写成不含 `placeholder`、`change_me`、`replace-with` 的长字符串，启动检查会把它当成合法密钥。因此示例值使用 `PLACEHOLDER_REPLACE_WITH_A_NEW_SECRET`，并用上面的命令确认它被拒绝。
- `next dev` 在密钥不合格时，工作进程退出后父进程仍可能以状态码 0 结束。`next start` 会以 1 结束。这是第三轮已经记录的行为，本阶段没有改它。
