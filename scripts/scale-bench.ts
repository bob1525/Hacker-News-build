import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";

const databasePath = "/tmp/hn-scale.db";
const databaseUrl = `file:${databasePath}`;
const POSTS = 220;
const COMMENTS = 1100;
const USERS = 25;

async function timed<T>(label: string, run: () => Promise<T>): Promise<number> {
  const start = performance.now();
  await run();
  const elapsed = performance.now() - start;
  console.log(`${label} ${elapsed.toFixed(1)}ms`);
  return elapsed;
}

async function main() {
  rmSync(databasePath, { force: true });
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  const users = await Promise.all(
    Array.from({ length: USERS }, (_, index) =>
      db.user.create({
        data: {
          username: `scale${String(index).padStart(2, "0")}`,
          email: `scale${index}@example.com`,
          passwordHash: "x",
          about: index === 0 ? "Scale profile user." : "",
        },
      }),
    ),
  );

  const posts = await db.post.createManyAndReturn({
    data: Array.from({ length: POSTS }, (_, index) => ({
      title:
        index % 15 === 0
          ? `Scale finder note ${index} about scalefinder indexes`
          : `Scale story ${index} on widgets and queues`,
      text: index % 15 === 0 ? "scalefinder appears in the body too." : "A short scale-test story.",
      url: index % 4 === 0 ? null : `https://example.com/scale/${index}`,
      authorId: users[index % USERS]!.id,
      createdAt: new Date(Date.now() - index * 60_000),
    })),
  });

  await db.comment.createMany({
    data: Array.from({ length: COMMENTS }, (_, index) => ({
      text: `Scale comment ${index} on story ${index % POSTS}.`,
      postId: posts[index % POSTS]!.id,
      authorId: users[index % USERS]!.id,
      createdAt: new Date(Date.now() - index * 1_000),
    })),
  });

  const [postCount, commentCount] = await Promise.all([db.post.count(), db.comment.count()]);
  console.log(`seeded posts=${postCount} comments=${commentCount} users=${USERS}`);
  if (postCount < 200 || commentCount < 1000) {
    throw new Error("Scale seed is below the required volume.");
  }

  const profileId = users[0]!.id;
  await timed("feed", () =>
    db.post.findMany({
      include: {
        author: { select: { id: true, username: true } },
        _count: { select: { votes: true, comments: true } },
      },
    }),
  );
  await timed("search", () =>
    db.$queryRawUnsafe<Array<{ id: string }>>(
      "SELECT id FROM Post WHERE instr(lower(title), ?) > 0 OR instr(lower(ifnull(text, '')), ?) > 0",
      "scalefinder",
      "scalefinder",
    ),
  );
  await timed("profile", async () => {
    await db.user.findUnique({ where: { id: profileId } });
    await db.post.findMany({ where: { authorId: profileId }, take: 50, orderBy: { createdAt: "desc" } });
    await db.comment.findMany({ where: { authorId: profileId }, take: 50, orderBy: { createdAt: "desc" } });
  });

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
