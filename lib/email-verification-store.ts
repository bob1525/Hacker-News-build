import type { PrismaClient } from "@prisma/client";
import {
  hashVerificationToken,
  newVerificationSecret,
  tokenAcceptance,
  verificationExpiry,
  verificationLink,
} from "@/lib/domain/email-verification";
import { MailDeliveryError, type Mailer } from "@/lib/mailer";

export type VerificationUser = { id: string; email: string; username: string };

export async function issueEmailVerification(
  db: PrismaClient,
  mailer: Mailer,
  user: VerificationUser,
  now = new Date(),
  baseUrl = "http://localhost:3000",
): Promise<{ raw: string }> {
  const secret = newVerificationSecret();
  await db.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await db.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: secret.tokenHash,
      expiresAt: verificationExpiry(now),
      createdAt: now,
    },
  });
  const link = verificationLink(baseUrl, secret.raw);
  try {
    await mailer.send({
      to: user.email,
      subject: "Verify your email",
      text: `Hi ${user.username}, open this link within 24 hours to verify your email:\n${link}\n`,
    });
  } catch (error) {
    if (error instanceof MailDeliveryError) throw error;
    throw new MailDeliveryError();
  }
  return { raw: secret.raw };
}

export async function consumeEmailVerification(
  db: PrismaClient,
  raw: string,
  now = new Date(),
): Promise<{ ok: true; already: boolean } | { ok: false; error: string }> {
  const tokenHash = hashVerificationToken(raw.trim());
  const row = await db.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, emailVerifiedAt: true } } },
  });
  if (!row) return { ok: false, error: "That verification link is not valid." };

  const acceptance = tokenAcceptance({ expiresAt: row.expiresAt, usedAt: row.usedAt, now });
  if (acceptance === "expired") return { ok: false, error: "That verification link has expired." };
  if (acceptance === "used") {
    if (row.user.emailVerifiedAt) return { ok: true, already: true };
    return { ok: false, error: "That verification link was already used." };
  }

  const claimed = await db.emailVerificationToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) {
    const again = await db.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { emailVerifiedAt: true } } },
    });
    if (again?.user.emailVerifiedAt) return { ok: true, already: true };
    return { ok: false, error: "That verification link is not valid." };
  }

  await db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: now } });
  return { ok: true, already: false };
}
