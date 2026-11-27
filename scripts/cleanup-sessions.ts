import { PrismaClient } from "@prisma/client";
import { deleteStaleSessions } from "../lib/session-devices";

const db = new PrismaClient();

async function main(): Promise<void> {
  const now = new Date();
  const removed = await deleteStaleSessions(db, now);
  const again = await deleteStaleSessions(db, now);
  console.log(`sessions: removed ${removed}, removed ${again}`);
  if (again !== 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "session cleanup failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
