# Hacker News

一个可运行的 Hacker News 风格社区精简版：发帖、投票、热度排序、多层评论、搜索和个人主页。

## 技术栈

- Next.js 15（App Router）+ React 19 + TypeScript
- Prisma 6 + SQLite
- Tailwind CSS 4
- 会话：HttpOnly cookie 中的 JWT（`jose`），密码使用 scrypt
- 测试：Vitest（单元）+ Playwright（端到端，使用本机 Chrome）

## 功能

- 注册、登录、退出。不能投票给自己的帖子或评论，可以取消已投的票。
- 发布帖子：标题，外加 URL、正文，或两者都有。标题以 `Show HN:` 开头会出现在 Show 页；不填 URL 的文字帖出现在 Ask 页。
- 首页按热度排序，New 页按时间排序，每页 30 条，底部有 More。
- 热度使用经典公式 `(points - 1) / (ageHours + 2) ^ 1.8`。分数相同则较新的在前。
- 评论支持多层回复（最多 8 层），可折叠，按时间从旧到新排列。
- 搜索标题和正文，忽略大小写；多个词需要同时命中。标题匹配优先于正文匹配。
- 个人主页展示简介、karma、帖子和评论。Karma 是别人给你的帖子和评论点的赞，自己给自己投票不计入。
- 空状态、加载骨架和表单错误提示。

## 本地启动

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

`npm run db:seed` 会清空并重建 SQLite 数据。数据库文件在 `prisma/dev.db`（路径相对于 Prisma schema）。

### 环境变量

`.env` 不进入 Git。第一次在本地跑之前，从示例文件生成它，并换成自己的密钥：

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

把打印出来的字符串填进 `.env` 的 `AUTH_SECRET`。应用在启动时检查这个值：缺失、仍是 `CHANGE_ME_TO_A_LONG_RANDOM_STRING` 这类占位符，或短于 32 个字符时，进程会把原因打到 stderr 并退出，不会再用内置的弱默认值签名。生产环境必须使用单独生成的随机值。

单元测试和端到端测试会自己设置合规的 `AUTH_SECRET`，不读取这份本地文件。`npm run db:seed` 只依赖 `DATABASE_URL`。

### 演示账号

所有种子账号的密码都是 `news12345`。

可以试 `demo`、`pg`、`dang`、`karpathy`、`nash`、`tptacek`。`lurker` 是一个还没有发过帖的账号，用来看空状态。

## 测试

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

- `npm test` 覆盖热度排序、评论树、karma、搜索相关性、校验、密码和会话。
- `npm run test:e2e` 会迁移并灌入独立的 `prisma/e2e.db`，然后构建生产版本并在 3100 端口跑关键流程：注册登录、发帖、投票、评论和嵌套回复、搜索、热度/最新排序、Ask/Show 过滤、个人主页。需要已安装 Google Chrome。

## 截图

服务跑起来之后，可以用 `node scripts/capture-screenshots.mjs` 重新生成这些图。

首页（热度排序）：

![首页](docs/screenshots/home.png)

帖子详情和四层嵌套评论：

![帖子详情](docs/screenshots/item-comments.png)

用户主页：

![用户主页](docs/screenshots/user-profile.png)

搜索：

![搜索](docs/screenshots/search.png)

登录：

![登录](docs/screenshots/login.png)

发帖：

![发帖](docs/screenshots/submit.png)

窄屏首页：

![窄屏首页](docs/screenshots/home-mobile.png)

## 目录

- `app/` 页面：首页、new、ask、show、comments、search、submit、登录注册、帖子、用户、guidelines
- `components/` 列表、投票、评论树、表单
- `lib/domain/` 排序、评论树、搜索、karma 等纯函数
- `lib/actions/` 注册登录、发帖、评论、投票
- `prisma/` schema、迁移和种子数据
- `tests/unit`、`tests/e2e`
