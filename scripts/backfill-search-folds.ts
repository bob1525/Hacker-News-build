import { PrismaClient } from "@prisma/client";
import { backfillSearchFolds, countStaleSearchFolds } from "../lib/search-fold-db";

const db = new PrismaClient();

async function main(): Promise<void> {
  const before = await countStaleSearchFolds(db);
  const updated = await backfillSearchFolds(db);
  const after = await countStaleSearchFolds(db);
  console.log(`search folds: stale ${before}, updated ${updated}, stale ${after}`);
  if (after !== 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "search fold backfill failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
