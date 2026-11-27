# 第十二轮阶段 2：补全常见全折叠

## 做了什么

仍只在 `foldSearchText` 一处折叠。在已有的 `ß`/`ς`、合字、µ、长 s、开尔文和埃之后，补上 `toLowerCase` 不会展开的常见全折叠：`ΐ` → ι + 分音符 + 锐音符，`ΰ` → υ + 分音符 + 锐音符，以及 `ŉ`、`ǰ`、`ẖ`、`ẗ`、`ẘ`、`ẙ`、`ẚ`。展开之后不再做 NFC，避免 `ΐ` 被组合回去。

短词规则写在 `tokenize`：先折叠，再按字母、数字、下划线和组合音标切词；长度小于 `SEARCH_TOKEN_MIN_LENGTH`（2）的词丢掉。单独的 µ 折成 μ 之后只有 1 个字符，相关性是 0。`ΐ` 展开成 3 个码位，会留下来。`10µm` 仍然能被 `μm` 搜到。

`countStaleSearchFolds` 统计库里的折叠和当前 `foldSearchText` 不一致的帖子。`npm run search:backfill` 调用 `scripts/backfill-search-folds.ts`，先报过期数，再跑 `backfillSearchFolds`，再报一次。第二次应是 `stale 0, updated 0, stale 0`。

`ß`/`ς` 和第十一轮折叠测试文件没有改断言。

## 怎么验证

```bash
npx vitest run tests/unit/search-fold-v3.test.ts tests/unit/search-fold-v2.test.ts tests/unit/search-casefold.test.ts tests/unit/search.test.ts tests/unit/search-unicode.test.ts
npm test
npm run lint
unset AUTH_SECRET; npm run typecheck
```

## 证据

2026-11-27 18:17 UTC：

```text
npm test
Test Files  42 passed | 1 skipped (43)
Tests       221 passed | 1 skipped (222)
Start at    18:17:04
Duration    9.89s

npm run lint
eslint . 通过

unset AUTH_SECRET; npm run typecheck
next typegen && tsc --noEmit 通过
```

新增 3 个单元测试（`tests/unit/search-fold-v3.test.ts`）：

1. `ΐ`、`ΰ`、`ŉ`、`ǰ` 和带附加符号的拉丁字母在 `foldSearchText` 里展开，并且和分解后的写法相同；`ß` 仍是 `ss`，`ς` 仍是 `σ`。
2. 单独的 µ 折成 μ 后被丢掉，相关性是 0；`10µm` 仍切成 `10μm`；`ΐ` 作为 3 个码位被保留；单个 `a` 仍被丢掉。
3. 过期折叠先被 `countStaleSearchFolds` 数到，回填改 1 行，再跑是 0；`npm run search:backfill` 打印 `search folds: stale 0, updated 0, stale 0`。

端到端仍是上一阶段的 31 个，本阶段没有改页面。

## 发现的问题

- 未登录时的评论折叠仍只在本机 `localStorage`，换浏览器会丢。
- `NODE_ENV=production` 时，`MAILER=console` 打到标准输出的邮件仍包含正文。
- 个人页的设备列表还没有端到端测试和截图。
- 亚美尼亚连字和希腊语带 prosgegrammeni 的字母没有放进这次折叠。
