import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clearRecordedMail, createMailer, recordedMail } from "@/lib/mailer";

describe("console mail log", () => {
  it("appends a message only when MAIL_LOG_PATH is set", async () => {
    clearRecordedMail();
    const dir = mkdtempSync(join(tmpdir(), "hn-mail-"));
    const file = join(dir, "mail.log");
    const logged = createMailer({ MAILER: "console", NODE_ENV: "test", MAIL_LOG_PATH: file });
    await logged.send({ to: "a@example.com", subject: "Reset your password", text: "token=abc" });
    expect(readFileSync(file, "utf8")).toContain("token=abc");
    expect(readFileSync(file, "utf8")).toContain("Reset your password");

    const quiet = createMailer({ MAILER: "console", NODE_ENV: "test" });
    await quiet.send({ to: "b@example.com", subject: "Hi", text: "no file" });
    expect(recordedMail().map((mail) => mail.to)).toEqual(["a@example.com", "b@example.com"]);
    rmSync(dir, { recursive: true, force: true });
  });
});
