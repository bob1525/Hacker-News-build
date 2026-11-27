import type { PrismaClient } from "@prisma/client";
import {
  hashPasswordResetToken,
  newPasswordResetSecret,
  passwordResetExpiry,
  passwordResetLink,
  tokenAcceptance,
} from "@/lib/domain/password-reset";
import { guardRateLimit } from "@/lib/limits";
import { MailDeliveryError, type Mailer } from "@/lib/mailer";
import { hashPassword } from "@/lib/password";

export async function requestPasswordReset(
  db: PrismaClient,
  mailer: Mailer,
  email: string,
  now = new Date(),
  baseUrl = "http://localhost:3000",
): Promise<{ ok: true; sent: boolean } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  const limited = await guardRateLimit("reset", normalized, now.getTime());
  if (!limited.ok) return { ok: false, error: limited.error };

  const user = await db.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, username: true },
  });
  if (!user) return { ok: true, sent: false };

  const secret = newPasswordResetSecret();
  await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: secret.tokenHash,
      expiresAt: passwordResetExpiry(now),
      createdAt: now,
    },
  });
  const link = passwordResetLink(baseUrl, secret.raw);
  try {
    await mailer.send({
      to: user.email,
      subject: "Reset your password",
      text: `Hi ${user.username}, open this link within 1 hour to choose a new password:\n${link}\n`,
    });
  } catch (error) {
    if (error instanceof MailDeliveryError) {
      return { ok: false, error: "Could not send the reset email. Please try again." };
    }
    throw error;
  }
  return { ok: true, sent: true };
}

export async function resetPassword(
  db: PrismaClient,
  raw: string,
  newPassword: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tokenHash = hashPasswordResetToken(raw.trim());
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row) return { ok: false, error: "That reset link is not valid." };
  const acceptance = tokenAcceptance({ expiresAt: row.expiresAt, usedAt: row.usedAt, now });
  if (acceptance === "expired") return { ok: false, error: "That reset link has expired." };
  if (acceptance === "used") return { ok: false, error: "That reset link was already used." };

  const passwordHash = await hashPassword(newPassword);
  const claimed = await db.$transaction(async (tx) => {
    const updated = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (updated.count !== 1) return false;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: now },
    });
    return true;
  });
  if (!claimed) return { ok: false, error: "That reset link is not valid." };
  return { ok: true };
}
