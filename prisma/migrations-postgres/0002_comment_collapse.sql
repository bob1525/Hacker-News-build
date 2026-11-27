-- Appended after 0001_init.sql. The empty-database job applies every *.sql file in filename order.
-- These statements are the CommentCollapse fragment of
-- `npx prisma migrate diff --from-empty --to-schema-datamodel --script`.

-- CreateTable
CREATE TABLE "CommentCollapse" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentCollapse_pkey" PRIMARY KEY ("userId","commentId")
);

-- CreateIndex
CREATE INDEX "CommentCollapse_userId_idx" ON "CommentCollapse"("userId");

-- CreateIndex
CREATE INDEX "CommentCollapse_commentId_idx" ON "CommentCollapse"("commentId");

-- AddForeignKey
ALTER TABLE "CommentCollapse" ADD CONSTRAINT "CommentCollapse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentCollapse" ADD CONSTRAINT "CommentCollapse_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
