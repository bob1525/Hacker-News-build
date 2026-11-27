-- CreateTable
CREATE TABLE "CommentCollapse" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "commentId"),
    CONSTRAINT "CommentCollapse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentCollapse_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CommentCollapse_userId_idx" ON "CommentCollapse"("userId");

-- CreateIndex
CREATE INDEX "CommentCollapse_commentId_idx" ON "CommentCollapse"("commentId");
