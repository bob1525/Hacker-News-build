-- Appended after 0003_email_verification.sql. The empty-database job applies every *.sql file in filename order.
-- Statements match `prisma migrate diff --from-schema-datamodel --to-schema-datamodel --script`.

-- AlterTable
ALTER TABLE "PostVote" ADD COLUMN     "value" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "CommentVote" ADD COLUMN     "value" INTEGER NOT NULL DEFAULT 1;
