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

  it("omits the body from MAIL_LOG_PATH in production", async () => {
    clearRecordedMail();
    const dir = mkdtempSync(join(tmpdir(), "hn-mail-prod-"));
    const file = join(dir, "mail.log");
    const secret = "production-mail-token-secret";
    const logged = createMailer({ MAILER: "console", NODE_ENV: "production", MAIL_LOG_PATH: file });
    await logged.send({
      to: "a@example.com",
      subject: "Reset your password",
      text: `Open http://localhost:3000/reset-password?token=${secret}\n`,
    });
    const body = readFileSync(file, "utf8");
    expect(body).toContain("a@example.com");
    expect(body).toContain("Reset your password");
    expect(body).toContain("[body omitted]");
    expect(body).not.toContain("token=");
    expect(body).not.toContain(secret);
    expect(body).not.toContain("/reset-password");
    expect(recordedMail().at(-1)?.text).toContain(secret);
    rmSync(dir, { recursive: true, force: true });
  });
});
