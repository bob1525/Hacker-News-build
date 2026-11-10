import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD } from "../lib/config";
import { pickVoters } from "../lib/domain/voters";
import { hashPassword } from "../lib/password";
import {
  READER_COUNT,
  allSeedUsernames,
  assertSeedIntegrity,
  assertSeedRanking,
  commentCount,
  namedUsers,
  posts,
  readerUsername,
} from "./seed-data";

const prisma = new PrismaClient();

async function createComments(
  comments: (typeof posts)[number]["comments"],
  postId: string,
  parentId: string | null,
  ids: Map<string, string>,
  now: number,
  usernames: string[],
  salt: number,
) {
  if (!comments) return;
  for (const [index, entry] of comments.entries()) {
    const authorId = ids.get(entry.author);
    if (!authorId) throw new Error(`Missing user ${entry.author}`);
    const created = await prisma.comment.create({
      data: {
        text: entry.text,
        authorId,
        postId,
        parentId,
        createdAt: new Date(now - entry.hoursAgo * 3_600_000),
      },
    });
    const voters = pickVoters(usernames, entry.author, entry.upvotes, salt + index + 11);
    if (voters.length > 0) {
      await prisma.commentVote.createMany({
        data: voters.map((username) => ({
          userId: ids.get(username)!,
          commentId: created.id,
        })),
      });
    }
    await createComments(entry.replies, postId, created.id, ids, now, usernames, salt + 100 + index);
  }
}

async function main() {
  assertSeedIntegrity();
  assertSeedRanking(new Date());

  await prisma.commentVote.deleteMany();
  await prisma.postVote.deleteMany();
  await prisma.comment.updateMany({ data: { parentId: null } });
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = Date.now();
  const usernames = allSeedUsernames();

  for (const user of namedUsers) {
    await prisma.user.create({
      data: { ...user, passwordHash },
    });
  }

  for (let index = 1; index <= READER_COUNT; index += 1) {
    const username = readerUsername(index);
    await prisma.user.create({
      data: {
        username,
        email: `${username}@example.com`,
        about: "Mostly lurking, occasionally voting.",
        passwordHash,
      },
    });
  }

  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  const ids = new Map(users.map((user) => [user.username, user.id]));

  for (const [index, post] of posts.entries()) {
    const authorId = ids.get(post.author);
    if (!authorId) throw new Error(`Missing user ${post.author}`);
    const created = await prisma.post.create({
      data: {
        title: post.title,
        url: post.url,
        text: post.text,
        authorId,
        createdAt: new Date(now - post.hoursAgo * 3_600_000),
      },
    });
    const voters = pickVoters(usernames, post.author, post.upvotes, index + 3);
    if (voters.length > 0) {
      await prisma.postVote.createMany({
        data: voters.map((username) => ({
          userId: ids.get(username)!,
          postId: created.id,
        })),
      });
    }
    await createComments(post.comments, created.id, null, ids, now, usernames, index * 17);
  }

  const [userCount, postCount, votes, commentVotes] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.postVote.count(),
    prisma.commentVote.count(),
  ]);
  console.log(
    `Seeded ${userCount} users, ${postCount} posts, ${commentCount()} comments, ${votes} post votes, ${commentVotes} comment votes.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
