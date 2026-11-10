# 历史密钥清理

第四轮阶段 1 的自检。目标是记录 `.env` 仍留在 Git 历史里的事实，要求所有环境换用全新密钥，并给出可操作的历史清理步骤。本任务没有重写历史，也没有 force push。

## 做了什么

- 用 `git log --all --full-history -- .env` 定位引入和删除 `.env` 的提交。
- 在 README 和 `.env.example` 写明：必须新生成至少 32 字符的随机 `AUTH_SECRET`，历史里出现过的旧值严禁再用。
- 下面给出 `git filter-repo` 和 BFG 的清理步骤，供仓库所有者以后执行。

## 验证方法

```bash
git log --all --full-history --format='%H %s' -- .env
git cat-file -e 362c02d429f1b2170e3587e3b1192a10b4d34f44:.env
git cat-file -e 7cbf47e5ac0f444d3fa2b17618857d3fd2a1c19c:.env
git rev-list --oneline 7e36ef6cdae9b0add2eee057615d6c938bf68839^..362c02d429f1b2170e3587e3b1192a10b4d34f44
git ls-files | grep -E '\.env$' || echo 'NO_TRACKED_DOTENV'
```

没有打印密钥原文。只核对文件是否存在，以及 `AUTH_SECRET` 的长度。

## 结果证据

`git log --all --full-history -- .env` 只有两次触及这个路径：

| 提交 | 情况 |
| --- | --- |
| `7e36ef6cdae9b0add2eee057615d6c938bf68839` | 引入 `.env`。提交说明是 “Add a Hacker News-style community with votes, nested comments, and tests.” 时间 2026-11-10 06:59:49 UTC。blob `6efb81098f3c4e59d8ed22e7c9db0364aefc1812`，模式 `100644`。内容含 `DATABASE_URL` 和 `AUTH_SECRET`。密钥长 31 个字符，不是占位符。 |
| `7cbf47e5ac0f444d3fa2b17618857d3fd2a1c19c` | 从索引删除 `.env`。父提交是 `362c02d429f1b2170e3587e3b1192a10b4d34f44`。 |

`git cat-file -e 362c02d:.env` 成功，说明删除前的最新功能提交里文件还在。`git cat-file -e 7cbf47e:.env` 失败，说明从这一提交起当前分支不再跟踪它。`git ls-files | grep -E '\.env$'` 现在没有输出，索引里只剩 `.env.example`。

从引入到删除之前，下面 6 个提交的树里都有 `.env`：

- `7e36ef6cdae9b0add2eee057615d6c938bf68839`
- `b6b11ca876538dec7055ea0aca033c02d452b7c8`
- `3d2ef497b0eb3730c5e525a44dc859296ebf0fbf`
- `fc69bc4d8547c807a3ff5bbc65abae86a416dffb`
- `0aaef3629a764d1e37ca4d5f8eac77ff2f8a9137`
- `362c02d429f1b2170e3587e3b1192a10b4d34f44`

区间命令 `git rev-list --oneline 7e36ef6^..362c02d` 的输出正好是这 6 个。

当前工作区的 `.env` 不在 Git 里。第三轮已经把它换成另一把本地随机值，但任何克隆过 `7e36ef6` 到 `362c02d` 的人都能从历史读到旧值。那把旧密钥必须当作已经泄露。

## 新密钥的生成与配置

每次安装、以及每一个生产环境，都要单独生成，不能抄历史、不能抄别人的 `.env`、不能用 `.env.example` 里的占位符。

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

把输出填进 `AUTH_SECRET`。`randomBytes(32)` 的 base64url 长度是 43，满足“至少 32 字符”。也可以用 `openssl rand -base64 32`。启动时缺失、含有 `CHANGE_ME` / `replace-with` 等占位片段、或短于 32 字符都会被拒绝。生产环境再生成一把，不要复用开发机上的值。

## 清理历史的步骤

下面的命令会改写已发布的提交。本任务故意没有执行。要做的人必须是仓库管理员，并且先通知协作者。

### git filter-repo

在一份新的镜像克隆里操作，不要在正在用的工作副本里直接滤历史。

```bash
pip install git-filter-repo
git clone --mirror https://github.com/bob1525/Hacker-News-build.git hn-mirror.git
cd hn-mirror.git
git filter-repo --path .env --invert-paths
```

`--invert-paths` 会从所有提交里删掉 `.env` 这个路径。检查结果：

```bash
git log --all --full-history -- .env
git rev-list --all | while read sha; do git cat-file -e "$sha:.env" 2>/dev/null && echo "still present $sha"; done
```

两条都应该没有输出。确认之后再推送：

```bash
git push --force --all origin
git push --force --tags origin
```

`filter-repo` 默认会去掉 `origin`。推送前需要重新添加：

```bash
git remote add origin https://github.com/bob1525/Hacker-News-build.git
```

### BFG

```bash
git clone --mirror https://github.com/bob1525/Hacker-News-build.git hn-bfg.git
cd hn-bfg.git
java -jar bfg.jar --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all origin
git push --force --tags origin
```

BFG 只处理大小超过默认阈值的文件时会漏掉小文件。`.env` 很小，所以这里使用 `--delete-files .env`，它按文件名删除，不看大小。清理后用上面的 `git log -- .env` 再确认一次。

### 清理后的影响

- 所有包含旧 `.env` 的提交都会换成新 SHA。`7e36ef6` 到 `362c02d` 以及它们的后代（包括当前 PR 分支）都会变。
- 必须 force push。普通 push 会被拒绝。
- 已有克隆不能 pull 合并。协作者要重新克隆，或者把自己的未推送提交 rebase 到新历史上。旧的本地分支和 PR 引用会指向不存在的提交。
- GitHub 上的 PR #1 会断开或显示一整串新提交。评审评论还在，但行内评论可能对不上。
- 已经 fork 或备份的仓库仍保存旧密钥。GitHub 的缓存、Issues 和 CI 日志里如果出现过原文，filter-repo 也清不掉。需要的话再请 GitHub Support 做服务端清除。
- 密钥轮换不依赖历史是否改写。即使历史清掉了，旧值也已经暴露过，不能再拿来签名。

## 发现的问题

- 第三轮只停止了后续跟踪，没有改写 `7e36ef6` 到 `362c02d`。那 6 个提交现在仍然能检出 `.env`。
- 旧密钥长 31 字符。按现在的启动校验，它已经短于 32，不能再当作合法 `AUTH_SECRET`。这不能代替轮换：任何人都能在历史里看到它。
- 在当前 PR 上执行 filter-repo 会改掉已推送的提交，所以这次只写步骤，不执行。

## 风险说明

旧密钥应视为泄露。任何用它签过会话的部署都要换成新密钥，旧 cookie 会因此失效。历史清理是减少继续扩散，不是把已经克隆出去的副本收回来。force push 会重写 PR 分支，协作者必须重新克隆。在仓库所有者明确决定之前，不要对 `origin` 做 force push。
