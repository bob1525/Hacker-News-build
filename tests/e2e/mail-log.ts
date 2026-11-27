import { readFileSync, writeFileSync } from "node:fs";
import { expect } from "@playwright/test";

export const mailLogPath = "/tmp/hn-e2e-mail.log";
export const serverLogPath = "/tmp/hn-e2e-server.log";

export function clearMailLog() {
  writeFileSync(mailLogPath, "");
}

export function serverLogMark(): number {
  try {
    return readFileSync(serverLogPath, "utf8").length;
  } catch {
    return 0;
  }
}

/** The e2e server runs `next start`, so NODE_ENV is production and the file log omits bodies. Tokens stay on stdout. */
export async function latestServerBlock(subject: string, after: number): Promise<string> {
  let block = "";
  await expect
    .poll(() => {
      try {
        const text = readFileSync(serverLogPath, "utf8");
        const marker = `subject=${subject}`;
        const index = text.lastIndexOf(marker);
        if (index < after) return 0;
        const lineStart = text.lastIndexOf("\n", index) + 1;
        block = text.slice(lineStart, lineStart + 2000);
        return block.includes(subject) ? block.length : 0;
      } catch {
        return 0;
      }
    })
    .toBeGreaterThan(20);
  return block;
}

export async function latestToken(subject: string, after: number): Promise<string> {
  const block = await latestServerBlock(subject, after);
  const match = block.match(/token=([^\s]+)/);
  const token = match?.[1] ? decodeURIComponent(match[1]) : "";
  expect(token.length).toBeGreaterThan(20);
  return token;
}
