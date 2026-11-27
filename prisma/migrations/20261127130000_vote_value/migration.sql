-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CommentVote" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "commentId"),
    CONSTRAINT "CommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CommentVote" ("commentId", "createdAt", "userId") SELECT "commentId", "createdAt", "userId" FROM "CommentVote";
DROP TABLE "CommentVote";
ALTER TABLE "new_CommentVote" RENAME TO "CommentVote";
CREATE INDEX "CommentVote_commentId_idx" ON "CommentVote"("commentId");
CREATE TABLE "new_PostVote" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "postId"),
    CONSTRAINT "PostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PostVote" ("createdAt", "postId", "userId") SELECT "createdAt", "postId", "userId" FROM "PostVote";
DROP TABLE "PostVote";
ALTER TABLE "new_PostVote" RENAME TO "PostVote";
CREATE INDEX "PostVote_postId_idx" ON "PostVote"("postId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
