export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
};

export type Mailer = {
  send(mail: OutboundMail): Promise<void>;
};

const recorded: OutboundMail[] = [];

/** The default mailer. It keeps the message for tests and prints it outside test runs. */
export function createMailer(env: { MAILER?: string; NODE_ENV?: string } = process.env): Mailer {
  const backend = (env.MAILER ?? "console").trim().toLowerCase();
  if (backend !== "" && backend !== "console") {
    throw new Error(`Unknown MAILER "${backend}". Use console.`);
  }
  return {
    async send(mail) {
      recorded.push(mail);
      if (env.NODE_ENV !== "test") {
        console.info(`[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
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
