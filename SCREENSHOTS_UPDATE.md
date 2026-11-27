# 截图补全

第三轮阶段 3 的自检。`scripts/capture-screenshots.mjs` 在原有 7 张图之后，继续用登录后的 demo 账号拍第二轮功能。

## 做了什么

脚本仍用本机 Chrome 打开 `SCREENSHOT_BASE_URL`（默认 `http://127.0.0.1:3000`）。登录 demo 后新增这些步骤：

1. 打开首页第一篇帖子，点 favorite，再打开 `/user/demo`，拍收藏列表。
2. 打开 `/user/pg`，点 follow，等到 followers 不再是 0，拍粉丝数和关注数。
3. 打开 `/following`，确认列表里有 pg 的帖子。
4. 打开「Ask HN: How do you take notes while reading papers?」，给 dang 那条带 “Indentation is a feature…” 的评论投票，拍已投票的箭头。
5. 在同一帖下发一条评论再删除，拍「已删除」。

收藏和关注放在发评论之前，避免 demo 主页的收藏图里混进刚删掉的评论。

`README.md` 在评论、收藏和关注的说明旁边引用了这 5 张图。截图一节也列出了文件名。

## 新增截图

| 文件 | 功能 |
| --- | --- |
| `docs/screenshots/comment-vote.png` | 评论上的投票箭头。已投票时是橙色，旁边是更新后的点数。 |
| `docs/screenshots/comment-deleted.png` | 软删除后的评论，正文是「已删除」，没有投票按钮。 |
| `docs/screenshots/profile-favorites.png` | demo 的个人主页，favorites 下列出刚收藏的首页热帖，按钮是 unfavorite。 |
| `docs/screenshots/profile-following-count.png` | pg 的个人主页。demo 关注之后 followers 为 1，following 为 0，按钮是 unfollow。 |
| `docs/screenshots/following-page.png` | `/following` 只列出 pg 的帖子，页头说明按首页热度排序。 |

另外重跑脚本时，`user-profile.png`、`item-comments.png`、`search.png`、`submit.png`、`home-mobile.png` 也按当前界面重新生成。`user-profile.png` 现在能看到 followers、following 和 follow 按钮。

## 脚本改动

- 评论投票用元素截图，先等到按钮的可访问名称变成 `Unvote`。
- 删除后等到刚写的正文从页面消失，再截 `[data-deleted='true']` 且含有「已删除」的评论。这样不会把上一次运行留下的旧删除评论当成这一次。
- 收藏和关注都先等按钮出现，再根据文字决定要点哪一下，避免客户端跳转还没完成时把次数数成 0。
- 粉丝数用 `data-testid="follower-count"`，截图前等到它不再是 `0`。按钮文字会先变成 unfollow，计数要等刷新回来。

## 如何验证

先准备数据和生产进程（开发服务器在这段脚本的连续跳转里不稳定，见下方问题）：

```bash
npm run db:seed
npx next build
npx next start --hostname 127.0.0.1 --port 3000
node scripts/capture-screenshots.mjs
```

然后看 `docs/screenshots/` 里的 5 个新文件，并打开 README 里对应的图片链接。

## 发现的问题

- 第一次跑时，点进帖子后立刻数 favorite 按钮，客户端导航还没画出来，脚本跳过点击，随后等不到 unfavorite。改成先 `waitFor` 那个按钮。
- 有一版粉丝数截图里按钮已经是 unfollow，followers 仍是 0。关注请求已经写入，`/following` 也能看到 pg，只是截图早于 `router.refresh()`。脚本改为等到计数离开 0。
- `next dev` 在脚本连续打开搜索和个人主页时，日志里出现 `SyntaxError: Unexpected end of JSON input`，`/user/pg` 返回 500。同一套页面用 `next build` 之后的 `next start` 全部 200，脚本一次跑完。端到端测试也走生产构建。这次截图因此改在 `next start` 上生成。应用代码没有为这个开发态错误做额外修改。

## 最终状态

5 张新图都在 `docs/screenshots/`，并和脚本、README 一起提交。`git ls-files docs/screenshots` 包含：

- `docs/screenshots/comment-vote.png`
- `docs/screenshots/comment-deleted.png`
- `docs/screenshots/profile-favorites.png`
- `docs/screenshots/profile-following-count.png`
- `docs/screenshots/following-page.png`

## 测试结果

- `npm run lint` 通过
- `npm run typecheck` 通过
- Vitest：19 个文件、111 个测试通过
- Playwright：23 个测试通过

没有改测试，也没有改页面逻辑。
