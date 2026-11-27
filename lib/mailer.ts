import { appendFileSync } from "node:fs";
import nodemailer from "nodemailer";

export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
};

export type Mailer = {
  send(mail: OutboundMail): Promise<void>;
};

/** Thrown when a message cannot be handed to the mail transport. The message never includes the body. */
export class MailDeliveryError extends Error {
  constructor() {
    super("Verification email could not be sent.");
    this.name = "MailDeliveryError";
  }
}

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  user: string | null;
  pass: string | null;
};

export type SmtpMessage = OutboundMail & { from: string };

export type SmtpTransport = {
  send(message: SmtpMessage): Promise<void>;
};

export type MailerEnv = {
  MAILER?: string;
  NODE_ENV?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
  /** When set, console mail is also appended here. Unset by default. */
  MAIL_LOG_PATH?: string;
};

const recorded: OutboundMail[] = [];

export function readSmtpConfig(env: MailerEnv): { ok: true; config: SmtpConfig } | { ok: false; error: string } {
  const host = (env.SMTP_HOST ?? "").trim();
  if (!host) return { ok: false, error: "SMTP_HOST is required when MAILER=smtp." };
  const from = (env.SMTP_FROM ?? "").trim();
  if (!from.includes("@")) return { ok: false, error: "SMTP_FROM is required when MAILER=smtp." };
  const portText = (env.SMTP_PORT ?? "").trim();
  const port = portText === "" ? 587 : Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: "SMTP_PORT must be a port number." };
  }
  const secureText = (env.SMTP_SECURE ?? "").trim().toLowerCase();
  const secure =
    secureText === "" ? port === 465 : secureText === "1" || secureText === "true" || secureText === "yes";
  const user = (env.SMTP_USER ?? "").trim();
  const pass = env.SMTP_PASS ?? "";
  if ((user === "") !== (pass === "")) {
    return { ok: false, error: "SMTP_USER and SMTP_PASS must be set together." };
  }
  return { ok: true, config: { host, port, secure, from, user: user || null, pass: user ? pass : null } };
}

/** Options passed to nodemailer. Building them does not open a connection. */
export function smtpConnectionOptions(config: SmtpConfig): {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
} {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass ?? "" } : undefined,
  };
}

export function createNodemailerTransport(config: SmtpConfig): SmtpTransport {
  const transporter = nodemailer.createTransport(smtpConnectionOptions(config));
  return {
    async send(message) {
      await transporter.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    },
  };
}

/** Production file logs keep the recipient and subject and drop the body, which can hold a token. */
export function mailLogEntry(mail: OutboundMail, env: MailerEnv): string | null {
  const logPath = env.MAIL_LOG_PATH?.trim();
  if (!logPath) return null;
  if (env.NODE_ENV === "production") {
    return `${mail.to}\n${mail.subject}\n[body omitted]\n---\n`;
  }
  return `${mail.to}\n${mail.subject}\n${mail.text}\n---\n`;
}

function consoleMailer(env: MailerEnv): Mailer {
  return {
    async send(mail) {
      recorded.push(mail);
      const logPath = env.MAIL_LOG_PATH?.trim();
      const entry = mailLogEntry(mail, env);
      if (logPath && entry) appendFileSync(logPath, entry);
      if (env.NODE_ENV !== "test") {
        console.info(`[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
      }
    },
  };
}

/**
 * `MAILER=console` (the default) records the message for tests and prints it outside tests.
 * `MAILER=smtp` uses SMTP_HOST, SMTP_PORT (587), SMTP_SECURE, SMTP_USER, SMTP_PASS, and SMTP_FROM.
 * Tests pass `transport` so CI never opens a network connection.
 */
export function createMailer(env: MailerEnv = process.env, options: { transport?: SmtpTransport } = {}): Mailer {
  const backend = (env.MAILER ?? "console").trim().toLowerCase();
  if (backend === "" || backend === "console") return consoleMailer(env);
  if (backend !== "smtp") {
    throw new Error(`Unknown MAILER "${backend}". Use console or smtp.`);
  }
  const parsed = readSmtpConfig(env);
  if (!parsed.ok) throw new Error(parsed.error);
  const config = parsed.config;
  const transport = options.transport ?? createNodemailerTransport(config);
  return {
    async send(mail) {
      try {
        await transport.send({ from: config.from, to: mail.to, subject: mail.subject, text: mail.text });
      } catch (error) {
        if (error instanceof MailDeliveryError) throw error;
        throw new MailDeliveryError();
      }
    },
  };
}

export function recordedMail(): readonly OutboundMail[] {
  return recorded;
}

export function clearRecordedMail(): void {
  recorded.length = 0;
}
