import { readFileSync, writeFileSync } from "node:fs";
import { expect } from "@playwright/test";

export const mailLogPath = "/tmp/hn-e2e-mail.log";
export const serverLogPath = "/tmp/hn-e2e-server.log";
export const mailboxPath = "/tmp/hn-e2e-mailbox.log";

export function clearMailLog() {
  writeFileSync(mailLogPath, "");
}

function fileMark(path: string): number {
  try {
    return readFileSync(path, "utf8").length;
  } catch {
    return 0;
  }
}

export function serverLogMark(): number {
  return fileMark(serverLogPath);
}

export function mailboxMark(): number {
  return fileMark(mailboxPath);
}

/** Undo quoted-printable so a wrapped `token=` can be read from the inbox. */
export function decodeQuotedPrintable(value: string): string {
  return value.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

/** Production stdout and MAIL_LOG_PATH omit bodies. The SMTP catcher is the inbox, not a log. */
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
        block = text.slice(lineStart, lineStart + 500);
        return block.includes(subject) ? block.length : 0;
      } catch {
        return 0;
      }
    })
    .toBeGreaterThan(20);
  return block;
}

export async function latestMailboxBlock(subject: string, after: number): Promise<string> {
  let block = "";
  await expect
    .poll(() => {
      try {
        const text = decodeQuotedPrintable(readFileSync(mailboxPath, "utf8").slice(after));
        const marker = `Subject: ${subject}`;
        const index = text.lastIndexOf(marker);
        if (index < 0) return 0;
        block = text.slice(index, index + 4000);
        return block.includes(subject) ? block.length : 0;
      } catch {
        return 0;
      }
    })
    .toBeGreaterThan(20);
  return block;
}

export async function latestToken(subject: string, after: number): Promise<string> {
  const block = await latestMailboxBlock(subject, after);
  const match = block.match(/token=([^\s]+)/);
  const token = match?.[1] ? decodeURIComponent(match[1]) : "";
  expect(token.length).toBeGreaterThan(20);
  return token;
}
