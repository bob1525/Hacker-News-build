# README 同步

第三轮阶段 2 的自检。对照当前代码改写 `README.md`，去掉第一轮留下的过时描述，并把第二轮功能写进去。阶段 1 已经加上的环境变量说明保留。

## 做了什么

重写功能、测试、自检文档和目录四段。截图段仍是现有 7 张图；第二轮界面截图在阶段 3 补，不在这里提前引用不存在的文件。

## 修改前后关键段落

评论排序。修改前：

```markdown
- 评论支持多层回复（最多 8 层），可折叠，按时间从旧到新排列。
```

修改后：

```markdown
- 排序规则：先按票数降序，票数相同再按时间升序（更早的在前）。票数和时间都相同则按 id 字典序。没有票的线程因此仍是从旧到新。
```

“从旧到新”只作为票数相同时的次序，不再是评论的主排序。帖子热度并列仍然是较新的在前，和 `compareByHot` 一致，README 里把这件事限定在帖子上。

Karma。修改前只说“别人给你的帖子和评论点的赞”。修改后写明评论 upvote、取消投票会减回 karma，软删除不撤销已有票。

个人主页。修改前是简介、karma、帖子和评论。修改后增加收藏列表、followers、following，以及 `/following` 只看关注的人的帖子。

目录。修改前：

```markdown
- `app/` 页面：首页、new、ask、show、comments、search、submit、登录注册、帖子、用户、guidelines
- `lib/actions/` 注册登录、发帖、评论、投票
```

修改后点名 `app/(feed)/following`、`app/user/[username]/`、`lib/actions/social.ts`，以及 `lib/domain` 里的 `ranking.ts`、`comments.ts`、`comment-moderation.ts`、`social.ts`、`rate-limit.ts`、`duplicate.ts`。

新增、修改前不存在的段落：

- 评论 15 分钟编辑窗口和软删除后显示「已删除」。
- 收藏、取消收藏，主页按收藏时间列出最多 50 条。
- 关注、不能关注自己、followers / following 计数、`/following`。
- 速率限制表：发帖 8 / 10 分钟，评论 20 / 10 分钟，投票 60 / 1 分钟。
- 重复内容：小写并把标点换成空格，bigram Dice ≥ 0.9 或规范化后完全相同则拒绝。发帖窗口 60 分钟，评论窗口 10 分钟。
- 六份自检文档链接：`RANKING_VERIFICATION.md`、`COMMENT_SYSTEM.md`、`USER_INTERACTIONS.md`、`SAFETY_AND_LIMITS.md`、`SCALE_TEST.md`、`FINAL_AUDIT.md`。同节附上阶段 1 的 `SECURITY_CLEANUP.md`。
- 规模测试命令 `npx tsx scripts/scale-bench.ts`。

## 第二轮功能是否都写进 README

| 功能 | README 位置 |
| --- | --- |
| 评论先按票数降序，再按时间升序 | 评论 |
| 评论 upvote / 取消，以及 karma 如何计入评论票 | 评论 |
| 15 分钟编辑窗口、软删除显示「已删除」 | 评论 |
| 会话内折叠 | 评论 |
| 收藏和主页收藏列表 | 收藏和关注 |
| 关注、followers / following、`/following` | 收藏和关注 |
| 发帖 8/10min、评论 20/10min、投票 60/1min | 速率限制和重复内容 |
| 规范化 + Dice 0.9 | 速率限制和重复内容 |
| 六份自检文档 | 自检文档 |
| `npx tsx scripts/scale-bench.ts` | 测试 |

在 README 里搜索旧句“按时间从旧到新排列”，没有匹配。

## 如何验证

对照 `lib/domain/comments.ts` 的 `byPointsThenOldest`、`lib/config.ts` 的编辑窗口和速率常量、`lib/domain/duplicate.ts` 的 `DUPLICATE_SIMILARITY`、`lib/domain/comment-moderation.ts` 的「已删除」，以及 `app/(feed)/following/page.tsx`、`lib/actions/social.ts`。文档改动不改变运行时行为，测试套件用来确认没有误改代码。

## 发现的问题

- 第一轮 README 把评论排序写成始终按时间从旧到新。第二轮已经改成票数优先，文档没跟上。
- 收藏、关注、速率限制、重复检测和规模命令都只写在各自的自检文档里，README 完全没有。
- 热度“分数相同则较新的在前”容易被读成评论规则。现在这句话明确只形容帖子。

## 最终状态

`README.md` 与当前实现一致，旧的评论主排序说明已删除。测试结果见下方。

## 测试结果

文档改动前后各跑了一遍：

- `npm run lint` 通过
- `npm run typecheck` 通过
- Vitest：19 个文件、111 个测试通过
- Playwright：23 个测试通过

没有新增或删除测试。原有断言保持原样。
