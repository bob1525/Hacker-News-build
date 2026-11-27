-- Appended after 0005_password_reset.sql. The empty-database job applies every *.sql file in filename order.
-- Statements match `prisma migrate diff --from-schema-datamodel --to-schema-datamodel --script`.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "textFold" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "titleFold" TEXT NOT NULL DEFAULT '';
