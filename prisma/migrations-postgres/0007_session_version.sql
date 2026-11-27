-- Appended after 0006_search_fold.sql. The empty-database job applies every *.sql file in filename order.
-- Statements match `prisma migrate diff --from-schema-datamodel --to-schema-datamodel --script`
-- after the provider is switched to postgresql.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;
