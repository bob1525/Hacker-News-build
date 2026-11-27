# 第八轮阶段 3：评论深度

## 做了什么

评论硬上限从 8 层改成 16 层。根评论算第 1 层。父评论已经在第 16 层时，回复被拒绝，错误仍是 `Replies only nest 16 levels deep.`。第 15 层还可以回复，新评论落在第 16 层。上限没有去掉。

选择 16 是因为任务把 16 当作合理默认：比原来深一倍，仍然有限，避免一条链把页面和查询拖住。父链遇到环，或深度超过上限加 2 时停止，避免死循环。

界面上第 16 层不再显示回复入口。折叠按钮还在。缩进仍是每层 12 像素。前 6 层和原来一样（第 6 层 72 像素）。再往下继续加，到 120 像素停止，所以第 10 层到第 16 层宽度相同，窄屏幕上正文还在。折叠和回复不依赖这段缩进。

`createComment` 用 `ancestorDepth` 和 `canReplyAtDepth`。仓库里没有断言「最大层数是 8」的测试，所以没有把某个 `8` 改写成更弱的条件。README 里描述当前行为的那一句从 8 层改成 16 层。以前各轮审计文档仍写当时的 8 层。四层线程的旧测试没有改。

## 如何验证

```bash
npx tsc --noEmit
npx vitest run
npm run test:e2e
npx eslint lib/domain/comments.ts lib/actions/comments.ts components/comment-thread.tsx tests/unit/comment-depth.test.ts
```

## 结果证据

```text
npx vitest run
Test Files  30 passed | 1 skipped (31)
Tests       165 passed | 1 skipped (166)
Start at    11:17:42
Duration    5.38s

npm run test:e2e
23 passed (32.3s)
```

阶段 2 结束时是 162 个通过。本阶段新增 3 个，合计 165。`tests/unit/comments.test.ts` 的四层线程和 `tests/unit/comment-rank.test.ts` 仍通过。`npx tsc --noEmit` 和上面的 eslint 通过。端到端里四层种子线程、发表回复、折叠、评论投票都通过。

新增的 3 个测试：

1. 第 15 层可以回复，第 16 层不行。错误文案写的是 16。环状父链会停住。
2. 第 6 层缩进仍是 72 像素。第 16 层停在 120 像素，和第 10 层相同。16 个节点的树深度是 16。
3. 数据库里一条 16 层链读回来深度是 16，叶子不能再回复。

## 发现的问题

- 第 10 层以后缩进不再变宽。数据上限仍是 16，回复入口在第 16 层关掉。
- 没有把旧审计文档里的「8 层」改掉。那些句子记录的是当时的行为。
